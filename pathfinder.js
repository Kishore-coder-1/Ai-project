// pathfinder.js
// Persona-calibrated travel metrics and search solvers (A*, UCS, and unweighted BFS)
const USER_PROFILES = {
  handicapped: {
    name: 'Handicapped / Wheelchair',
    badge: '♿ Handicapped',
    requireAccessible: true,
    horizontalTimeMultiplier: 1.4, // Safe wheelchair cruising speed (~0.95 m/s vs ~1.35 m/s walking)
    rampDistMultiplier: 1.6,       // Gentle switchback ramp detour (+60% entrance distance)
    effortMultiplier: 1.5,
    weights: { distance: 0.8, time: 0.8, effort: 1.5 }
  },
  student: {
    name: 'Normal Student',
    badge: '🎒 Student',
    requireAccessible: false,
    horizontalTimeMultiplier: 1.0,
    rampDistMultiplier: 1.0,
    effortMultiplier: 1.0,
    weights: { distance: 1.0, time: 0.7, effort: 0.25 }
  },
  faculty: {
    name: 'Faculty / Staff',
    badge: '💼 Faculty',
    requireAccessible: false,
    horizontalTimeMultiplier: 1.15,
    rampDistMultiplier: 1.0,
    effortMultiplier: 1.2,
    weights: { distance: 0.6, time: 0.8, effort: 2.8 }
  },
  visitor: {
    name: 'Parent / Campus Visitor',
    badge: '🧭 Visitor',
    requireAccessible: false,
    horizontalTimeMultiplier: 1.25,
    rampDistMultiplier: 1.1,
    effortMultiplier: 1.3,
    weights: { distance: 0.7, time: 0.7, effort: 2.0 }
  }
};

function getEffectiveEdgeMetrics(edge, profileKey) {
  const p = USER_PROFILES[profileKey];
  const crowdMult = edge.crowded ? 2.4 : 1.0;

  let dist = edge.distance;
  let time = edge.time;
  let effort = edge.effort;

  if (edge.type === 'ramp') {
    dist = Math.round(edge.distance * p.rampDistMultiplier);
    time = Math.round(edge.time * p.rampDistMultiplier * p.horizontalTimeMultiplier);
  } else if (edge.type !== 'lift' && edge.type !== 'stairs') {
    // Horizontal corridors, skybridges, and outdoor walkways scale with persona speed
    time = Math.round(edge.time * p.horizontalTimeMultiplier * crowdMult);
  } else {
    time = Math.round(edge.time * crowdMult);
  }

  effort = Math.round(edge.effort * p.effortMultiplier * crowdMult);
  return { distance: dist, time, effort };
}

function getEdgeCost(edge, profileKey) {
  if (edge.blocked) return Infinity;
  const profile = USER_PROFILES[profileKey];
  if (profile.requireAccessible && !edge.accessible) return Infinity;

  const m = getEffectiveEdgeMetrics(edge, profileKey);
  const w = profile.weights;
  return w.distance * m.distance + w.time * m.time + w.effort * m.effort;
}

function heuristic(nodeA, nodeB) {
  const dx = (nodeA.x - nodeB.x) * 0.45;
  const dy = (nodeA.y - nodeB.y) * 0.45;
  const dz = Math.abs(nodeA.floor - nodeB.floor) * 18;
  return Math.sqrt(dx * dx + dy * dy) + dz;
}

function runSearch(graph, startId, goalId, profileKey = 'handicapped', algorithm = 'ASTAR') {
  const startTime = performance.now();
  const adj = {};
  for (const id of Object.keys(graph.nodes)) adj[id] = [];
  for (const e of graph.edges) adj[e.from].push(e);

  // BFS uses a strict FIFO queue on an unweighted graph (minimizes edge count, NOT weighted cost)
  if (algorithm === 'BFS') {
    const queue = [startId];
    const visited = new Set([startId]);
    const cameFrom = {};
    const edgeUsed = {};
    let nodesExpanded = 0;

    while (queue.length > 0) {
      const currentId = queue.shift();
      nodesExpanded++;

      if (currentId === goalId) {
        const pathNodes = [];
        const pathEdges = [];
        let curr = goalId;
        while (curr) {
          pathNodes.unshift(graph.nodes[curr]);
          if (edgeUsed[curr]) pathEdges.unshift(edgeUsed[curr]);
          curr = cameFrom[curr];
        }

        const totals = pathEdges.reduce(
          (acc, e) => {
            const m = getEffectiveEdgeMetrics(e, profileKey);
            return {
              distance: acc.distance + m.distance,
              time: acc.time + m.time,
              effort: acc.effort + m.effort
            };
          },
          { distance: 0, time: 0, effort: 0 }
        );

        return {
          found: true,
          algorithm: 'BFS',
          pathNodes,
          pathEdges,
          totals,
          nodesExpanded,
          executionMs: (performance.now() - startTime).toFixed(2)
        };
      }

      for (const edge of adj[currentId]) {
        if (visited.has(edge.to)) continue;
        // BFS still respects hard feasibility (blocked edges & stairs for wheelchair),
        // but ignores edge weights (distance/time/effort) and takes whichever valid edge reaches goal in fewest hops.
        if (!isFinite(getEdgeCost(edge, profileKey))) continue;

        visited.add(edge.to);
        cameFrom[edge.to] = currentId;
        edgeUsed[edge.to] = edge;
        queue.push(edge.to);
      }
    }

    return {
      found: false,
      algorithm: 'BFS',
      nodesExpanded,
      executionMs: (performance.now() - startTime).toFixed(2)
    };
  }

  // A* and UCS (Dijkstra) operate on weighted edges using a priority queue
  const openSet = [{ id: startId, f: 0, g: 0 }];
  const gScore = { [startId]: 0 };
  const cameFrom = {};
  const edgeUsed = {};
  const visited = new Set();
  let nodesExpanded = 0;

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();

    if (visited.has(current.id)) continue;
    visited.add(current.id);
    nodesExpanded++;

    if (current.id === goalId) {
      const pathNodes = [];
      const pathEdges = [];
      let curr = goalId;
      while (curr) {
        pathNodes.unshift(graph.nodes[curr]);
        if (edgeUsed[curr]) pathEdges.unshift(edgeUsed[curr]);
        curr = cameFrom[curr];
      }

      const totals = pathEdges.reduce(
        (acc, e) => {
          const m = getEffectiveEdgeMetrics(e, profileKey);
          return {
            distance: acc.distance + m.distance,
            time: acc.time + m.time,
            effort: acc.effort + m.effort
          };
        },
        { distance: 0, time: 0, effort: 0 }
      );

      return {
        found: true,
        algorithm,
        pathNodes,
        pathEdges,
        totals,
        nodesExpanded,
        executionMs: (performance.now() - startTime).toFixed(2)
      };
    }

    for (const edge of adj[current.id]) {
      if (visited.has(edge.to)) continue;
      const stepCost = getEdgeCost(edge, profileKey);
      if (!isFinite(stepCost)) continue;

      const tentativeG = gScore[current.id] + stepCost;
      if (gScore[edge.to] === undefined || tentativeG < gScore[edge.to]) {
        cameFrom[edge.to] = current.id;
        edgeUsed[edge.to] = edge;
        gScore[edge.to] = tentativeG;

        const h = algorithm === 'ASTAR' ? heuristic(graph.nodes[edge.to], graph.nodes[goalId]) : 0;
        openSet.push({ id: edge.to, g: tentativeG, f: tentativeG + h });
      }
    }
  }

  return {
    found: false,
    algorithm,
    nodesExpanded,
    executionMs: (performance.now() - startTime).toFixed(2)
  };
}

function explainRoute(graph, startId, goalId, profileKey, activeResult) {
  const studentBaseline = runSearch(graph, startId, goalId, 'student', 'ASTAR');
  const reasons = [];

  if (!activeResult.found) {
    return {
      isWarning: true,
      messages: [
        'No step-free / valid path is currently reachable under the active maintenance closures. Re-enable a lift or switch traveler profile.'
      ]
    };
  }

  const activeIds = activeResult.pathEdges.map(e => e.id).join('|');
  const baseIds = studentBaseline.found ? studentBaseline.pathEdges.map(e => e.id).join('|') : '';

  if (activeIds === baseIds && profileKey === 'student') {
    reasons.push('Direct optimal path selected with zero stairway barriers or active blockages.');
  } else if (studentBaseline.found) {
    const distDiff = activeResult.totals.distance - studentBaseline.totals.distance;
    const timeDiff = activeResult.totals.time - studentBaseline.totals.time;

    reasons.push(
      `Adapted route (${distDiff >= 0 ? '+' + distDiff : distDiff}m, ${timeDiff >= 0 ? '+' + timeDiff : timeDiff}s vs. standard student baseline) calibrated for ${USER_PROFILES[profileKey].name}.`
    );

    const baselineUsedStairs = studentBaseline.pathEdges.some(e => e.type === 'stairs');
    const activeUsedLift = activeResult.pathEdges.some(e => e.type === 'lift');
    if (baselineUsedStairs && activeUsedLift) {
      const liftBlocks = [...new Set(activeResult.pathEdges.filter(e => e.type === 'lift').map(e => e.from.split('_')[0].replace('B', 'Block ')))];
      reasons.push(
        `Eliminated all staircases: used Lift in ${liftBlocks.join(' & ')} (5s/floor) and traversed Floor 3+ internal/skybridge links to reach the destination.`
      );
    }

    if (activeResult.algorithm === 'BFS') {
      reasons.push('BFS minimized total graph edge hops (unweighted) rather than physical distance or time.');
    }

    const crossBridge = activeResult.pathEdges.find(e => e.type === 'cross_skybridge');
    if (crossBridge) {
      reasons.push(`Utilized 3rd-floor cross-road skybridge (${crossBridge.description}) for step-free crossing.`);
    }

    if (studentBaseline.pathEdges.some(e => e.blocked)) {
      reasons.push('Dynamically rerouted around out-of-service lifts or closed skybridges.');
    }
    if (studentBaseline.pathEdges.some(e => e.crowded)) {
      reasons.push('Detoured around crowded 36–38 corridors to ensure smooth travel.');
    }
  }

  return { isWarning: false, messages: reasons };
}
