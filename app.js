// app.js
const graph = buildCampusGraph();
let activeProfile = 'student'; // Default: Normal Student
let routeGenerated = false;

const startInput = document.getElementById('startInput');
const goalInput = document.getElementById('goalInput');
const algoSelect = document.getElementById('algoSelect');
const svg = document.getElementById('campusSvg');
const mapWrapper = document.getElementById('mapWrapper');
const mapEmptyState = document.getElementById('mapEmptyState');
const locationsDatalist = document.getElementById('campusLocationsList');

const sortedNodes = Object.values(graph.nodes).sort((a, b) =>
  a.block !== b.block ? a.block - b.block : a.floor - b.floor
);

// Populate searchable datalist & lookup map (start & destination stay empty initially)
const labelToNodeId = {};
for (const node of sortedNodes) {
  labelToNodeId[node.label.toLowerCase()] = node.id;
  const opt = document.createElement('option');
  opt.value = node.label;
  locationsDatalist.appendChild(opt);
}

function resolveNodeId(inputText) {
  const clean = (inputText || '').trim().toLowerCase();
  if (!clean) return null;
  if (labelToNodeId[clean]) return labelToNodeId[clean];
  // Partial / smart match if user typed e.g. "Block 26" or "Block 26 Floor 3"
  const exactPrefix = sortedNodes.find(n => n.label.toLowerCase().startsWith(clean));
  if (exactPrefix) return exactPrefix.id;
  const substringMatch = sortedNodes.find(n => n.label.toLowerCase().includes(clean));
  return substringMatch ? substringMatch.id : null;
}

document.getElementById('clearStartBtn').addEventListener('click', () => {
  startInput.value = '';
  startInput.focus();
  resetMapToWaitingState();
});

document.getElementById('clearGoalBtn').addEventListener('click', () => {
  goalInput.value = '';
  goalInput.focus();
  resetMapToWaitingState();
});

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    if (btn.dataset.view === 'benchmark') renderBenchmarkTable();
  });
});

document.querySelectorAll('.persona-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    activeProfile = card.dataset.profile;
    document.getElementById('activePersonaBadge').textContent = USER_PROFILES[activeProfile].badge;
    if (routeGenerated) updateNavigation();
  });
});

document.getElementById('swapBtn').addEventListener('click', () => {
  const temp = startInput.value;
  startInput.value = goalInput.value;
  goalInput.value = temp;
  if (routeGenerated) updateNavigation();
});

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function resetMapToWaitingState() {
  routeGenerated = false;
  svg.style.display = 'none';
  mapEmptyState.style.display = 'block';
  mapWrapper.classList.remove('map-active');
  document.getElementById('floorSummaryTag').textContent = 'Awaiting route input';
  document.getElementById('floorStrip').innerHTML =
    '<span class="muted-hint">Enter starting point & destination to inspect floor transitions.</span>';
  document.getElementById('explanationBox').className = 'explain-alert';
  document.getElementById('explanationBox').innerHTML =
    'Select a <strong>Starting Point</strong> and <strong>Destination</strong>, then click <strong>Generate Route</strong> to compute your personalized path.';
  document.getElementById('metricsBox').innerHTML = '';
  document.getElementById('stepCountBadge').textContent = '0 steps';
  document.getElementById('stepsList').innerHTML =
    '<li style="list-style:none;color:#64748b;margin-left:-1.2rem;">No route generated yet. Enter your origin and destination to see step-by-step guidance.</li>';
}

function applyDynamicObstacles() {
  const b36 = document.getElementById('obsLift36').checked;
  const b30 = document.getElementById('obsLift30').checked;
  const b31 = document.getElementById('obsLift31').checked;
  const br26_38 = document.getElementById('obsBridge26_38').checked;
  const cr36_38 = document.getElementById('obsCrowd36_38').checked;

  for (const edge of graph.edges) {
    edge.blocked = false;
    edge.crowded = false;

    if (b36 && edge.type === 'lift' && edge.from.startsWith('B36_')) edge.blocked = true;
    if (b30 && edge.type === 'lift' && edge.from.startsWith('B30_')) edge.blocked = true;
    if (b31 && edge.type === 'lift' && edge.from.startsWith('B31_')) edge.blocked = true;
    if (br26_38 && edge.type === 'cross_skybridge' &&
       ((edge.from === 'B26_F3' && edge.to === 'B38_F3') || (edge.from === 'B38_F3' && edge.to === 'B26_F3'))) {
      edge.blocked = true;
    }
    if (cr36_38 && edge.type === 'shared_corridor') edge.crowded = true;
  }
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function renderArchitecturalMap(activePathNodes = []) {
  svg.innerHTML = '';
  const activeBlocks = new Set(activePathNodes.map(n => n.block));

  // 1. Campus Lawn Background
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: 880, height: 510, fill: '#9ec495' }));

  const rp = svgEl('text', { x: 265, y: 34, 'text-anchor': 'middle', fill: '#1e293b', 'font-size': '15', 'font-weight': '600' });
  rp.textContent = 'Robo Park';
  svg.appendChild(rp);

  // 2. Campus Roads
  const roads = [
    { x: 0,   y: 52,  w: 690, h: 16 },
    { x: 0,   y: 232, w: 515, h: 18 },
    { x: 515, y: 52,  w: 20,  h: 432 },
    { x: 642, y: 165, w: 24,  h: 319 },
    { x: 0,   y: 468, w: 666, h: 18 }
  ];
  for (const r of roads) {
    svg.appendChild(svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, fill: '#8a8d8f' }));
  }

  const dashes = [
    { x1: 10, y1: 60, x2: 685, y2: 60 },
    { x1: 10, y1: 241, x2: 515, y2: 241 },
    { x1: 525, y1: 65, x2: 525, y2: 475 },
    { x1: 654, y1: 170, x2: 654, y2: 475 },
    { x1: 10, y1: 477, x2: 660, y2: 477 }
  ];
  for (const d of dashes) {
    svg.appendChild(svgEl('line', {
      x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
      stroke: '#e2e8f0', 'stroke-width': '1.5', 'stroke-dasharray': '8,8'
    }));
  }

  const roadTexts = [
    { x: 255, y: 245, txt: 'Road', rot: 0 },
    { x: 355, y: 481, txt: 'Road', rot: 0 },
    { x: 658, y: 250, txt: 'Road', rot: -90 }
  ];
  for (const rt of roadTexts) {
    const t = svgEl('text', {
      x: rt.x, y: rt.y, 'text-anchor': 'middle', fill: '#0f172a',
      'font-size': '13', 'font-weight': '600',
      transform: rt.rot ? `rotate(${rt.rot} ${rt.x} ${rt.y})` : ''
    });
    t.textContent = rt.txt;
    svg.appendChild(t);
  }

  // 3. Elevated Skybridges
  const bridges = [
    { x1: 108, y1: 118, x2: 132, y2: 118 },
    { x1: 198, y1: 118, x2: 222, y2: 118 },
    { x1: 288, y1: 118, x2: 312, y2: 118 },
    { x1: 378, y1: 118, x2: 402, y2: 118 },
    { x1: 468, y1: 118, x2: 492, y2: 118 },
    { x1: 591, y1: 158, x2: 591, y2: 185 },
    { x1: 165, y1: 158, x2: 165, y2: 355 },
    { x1: 345, y1: 158, x2: 345, y2: 355 },
    { x1: 476, y1: 398, x2: 558, y2: 398 }
  ];
  for (const b of bridges) {
    svg.appendChild(svgEl('line', {
      x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2,
      stroke: '#2563eb', 'stroke-width': '4', 'stroke-dasharray': '4,3', opacity: '0.65'
    }));
  }

  // 4. Draw Buildings
  for (const block of graph.BLOCK_ORDER) {
    const c = graph.BLOCK_CONFIG[block];
    const isSelected = activeBlocks.has(block);

    svg.appendChild(svgEl('rect', {
      x: c.x, y: c.y, width: c.w, height: c.h,
      fill: isSelected ? '#fed7aa' : '#d1d5db',
      stroke: isSelected ? '#ea580c' : '#6b7280',
      'stroke-width': isSelected ? '2.5' : '1.5'
    }));

    svg.appendChild(svgEl('rect', {
      x: c.x, y: c.y + c.h - 10, width: c.w, height: 10,
      fill: isSelected ? '#fdba74' : '#9ca3af',
      stroke: '#6b7280', 'stroke-width': '1'
    }));

    const label = svgEl('text', {
      x: c.x + c.w / 2, y: c.y + c.h / 2 + 2,
      'text-anchor': 'middle', fill: '#111827',
      'font-size': block >= 36 ? '14' : '15', 'font-weight': '600'
    });
    label.textContent = block >= 36 ? `${block} block` : `${block}`;
    svg.appendChild(label);

    if (c.hasLift) {
      svg.appendChild(svgEl('circle', {
        cx: c.x + c.w - 9, cy: c.y + 9, r: 4,
        fill: '#10b981', stroke: '#ffffff', 'stroke-width': '1'
      }));
    }
  }

  // 5. Active Route Path Overlay
  if (activePathNodes.length > 1) {
    for (let i = 0; i < activePathNodes.length - 1; i++) {
      const n1 = activePathNodes[i];
      const n2 = activePathNodes[i + 1];
      if (n1.x !== n2.x || n1.y !== n2.y) {
        svg.appendChild(svgEl('line', {
          x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y,
          stroke: '#ea580c', 'stroke-width': '4.5', 'stroke-linecap': 'round'
        }));
      }
    }
  }

  // 6. Verified Circular Entrance Icons
  for (const block of graph.BLOCK_ORDER) {
    const c = graph.BLOCK_CONFIG[block];
    for (const side of c.entrances) {
      const pt = graph.getEntranceCoords(block, side);
      svg.appendChild(svgEl('circle', {
        cx: pt.x, cy: pt.y, r: 10.5,
        fill: '#e5e7eb', stroke: '#4b5563', 'stroke-width': '1.4'
      }));
      [-3.5, 0, 3.5].forEach(dx => {
        svg.appendChild(svgEl('line', {
          x1: pt.x + dx, y1: pt.y - 5, x2: pt.x + dx, y2: pt.y + 5,
          stroke: '#374151', 'stroke-width': '1.4'
        }));
      });
    }
  }

  // 7. Start (Green) & Goal (Red) Markers placed strictly at the selected start & goal node coordinates
  if (activePathNodes.length > 0) {
    const sNode = activePathNodes[0];
    const gNode = activePathNodes[activePathNodes.length - 1];
    svg.appendChild(svgEl('circle', { cx: sNode.x, cy: sNode.y, r: 7, fill: '#059669', stroke: '#fff', 'stroke-width': '2' }));
    svg.appendChild(svgEl('circle', { cx: gNode.x, cy: gNode.y, r: 7, fill: '#dc2626', stroke: '#fff', 'stroke-width': '2' }));
  }
}

function renderElevationStrip(pathNodes, pathEdges) {
  const strip = document.getElementById('floorStrip');
  const summaryTag = document.getElementById('floorSummaryTag');
  if (!pathNodes.length) {
    strip.innerHTML = '';
    summaryTag.textContent = 'No active path';
    return;
  }

  const maxFloor = Math.max(...pathNodes.map(n => n.floor));
  summaryTag.textContent = `Peak Elevation: Floor ${maxFloor}`;

  const waypoints = [];
  for (let i = 0; i < pathNodes.length; i++) {
    const n = pathNodes[i];
    const prev = waypoints[waypoints.length - 1];
    if (!prev || prev.block !== n.block || prev.floor !== n.floor) {
      const incoming = i > 0 ? pathEdges[i - 1] : null;
      waypoints.push({
        block: n.block,
        floor: n.floor,
        via: incoming ? incoming.type : 'start',
        isGoal: i === pathNodes.length - 1
      });
    }
  }

  strip.innerHTML = waypoints
    .map((wp, idx) => {
      const cls = wp.isGoal ? 'goal-chip' : (wp.via === 'lift' ? 'lift-chip' : (wp.via.includes('bridge') || wp.via.includes('internal') ? 'bridge-chip' : ''));
      const arrow = idx < waypoints.length - 1 ? ' → ' : '';
      return `<span class="floor-chip ${cls}">Blk ${wp.block} (F${wp.floor}${wp.isGoal ? ' Goal' : ''})</span>${arrow}`;
    })
    .join('');
}

function updateNavigation() {
  const startId = resolveNodeId(startInput.value);
  const goalId = resolveNodeId(goalInput.value);
  const expBox = document.getElementById('explanationBox');

  if (!startId || !goalId) {
    expBox.className = 'explain-alert warning';
    expBox.innerHTML = !startId && !goalId
      ? 'Please select both a valid <strong>Starting Point</strong> and <strong>Destination</strong> from the search suggestions.'
      : (!startId
        ? 'Please select a valid <strong>Starting Point</strong> from the search list.'
        : 'Please select a valid <strong>Destination</strong> from the search list.');
    return;
  }

  // Normalize input text to exact canonical label
  startInput.value = graph.nodes[startId].label;
  goalInput.value = graph.nodes[goalId].label;

  routeGenerated = true;
  mapEmptyState.style.display = 'none';
  svg.style.display = 'block';
  mapWrapper.classList.add('map-active');

  applyDynamicObstacles();
  const algo = algoSelect.value;

  const result = runSearch(graph, startId, goalId, activeProfile, algo);
  const exp = explainRoute(graph, startId, goalId, activeProfile, result);

  expBox.className = exp.isWarning ? 'explain-alert warning' : 'explain-alert';
  expBox.innerHTML = exp.messages.map(m => `• ${m}`).join('<br/>');

  const metricsBox = document.getElementById('metricsBox');
  const stepsList = document.getElementById('stepsList');
  const stepBadge = document.getElementById('stepCountBadge');

  if (!result.found) {
    metricsBox.innerHTML = '';
    stepsList.innerHTML = '<li>No valid accessible route under active maintenance closures.</li>';
    stepBadge.textContent = '0 steps';
    renderArchitecturalMap([]);
    renderElevationStrip([], []);
    return;
  }

  metricsBox.innerHTML = `
    <div class="kpi-card"><span>Total Distance</span><strong>${result.totals.distance} m</strong></div>
    <div class="kpi-card"><span>Estimated Time</span><strong>${formatDuration(result.totals.time)}</strong></div>
    <div class="kpi-card"><span>Physical Effort</span><strong>${result.totals.effort} pts</strong></div>
    <div class="kpi-card"><span>Nodes Expanded (${result.algorithm})</span><strong>${result.nodesExpanded} (${result.executionMs} ms)</strong></div>
  `;

  stepBadge.textContent = `${result.pathEdges.length} steps`;
  stepsList.innerHTML = result.pathEdges
    .map(e => {
      const m = getEffectiveEdgeMetrics(e, activeProfile);
      return `<li><span class="edge-tag tag-${e.type}">${e.type.replace('_', ' ')}</span>${e.description} <strong>(${m.distance}m • ${m.time}s)</strong></li>`;
    })
    .join('');

  renderArchitecturalMap(result.pathNodes);
  renderElevationStrip(result.pathNodes, result.pathEdges);
}

function renderBenchmarkTable() {
  applyDynamicObstacles();
  const startId = resolveNodeId(startInput.value) || 'B25_ENT_NORTH';
  const goalId = resolveNodeId(goalInput.value) || 'B32_F6';
  const algos = [
    { key: 'ASTAR', name: 'A* Search', strategy: '3D Euclidean + Floor Delta Admissible Heuristic (Weighted)' },
    { key: 'UCS', name: 'Uniform Cost Search', strategy: 'Exact Dijkstra Minimum Cumulative Cost (Weighted)' },
    { key: 'BFS', name: 'Breadth-First Search', strategy: 'Unweighted Fewest-Edges Exploration (Ignores Distance/Time Weights)' }
  ];

  const tbody = document.getElementById('benchmarkTableBody');
  tbody.innerHTML = algos.map(a => {
    const res = runSearch(graph, startId, goalId, activeProfile, a.key);
    return `
      <tr>
        <td><strong>${a.name}</strong></td>
        <td>${a.strategy}</td>
        <td>${res.found ? '✅ Yes' : '❌ Blocked'}</td>
        <td>${res.found ? res.pathEdges.length + ' steps' : '—'}</td>
        <td>${res.found ? res.totals.distance + ' m' : '—'}</td>
        <td>${res.found ? formatDuration(res.totals.time) : '—'}</td>
        <td>${res.found ? res.totals.effort + ' pts' : '—'}</td>
        <td><strong>${res.nodesExpanded}</strong></td>
        <td>${res.executionMs} ms</td>
      </tr>
    `;
  }).join('');
}

function populateDirectoryTable() {
  const tbody = document.getElementById('directoryTableBody');
  tbody.innerHTML = graph.BLOCK_ORDER.map(b => {
    const cfg = graph.BLOCK_CONFIG[b];
    const liftBadge = cfg.hasLift
      ? `<span class="edge-tag tag-lift">♿ Lift Available (F1–F${cfg.floors})</span>`
      : `<span class="edge-tag tag-stairs">Stairs Only (Reachable via F3+ Links)</span>`;
    const entText = cfg.entrances.length
      ? cfg.entrances.map(s => ENTRANCE_LABELS[s].replace(' (F1)', '')).join(' & ')
      : 'Internal entry only from Block 30 (F3+)';
    return `
      <tr>
        <td><strong>Block ${b}</strong></td>
        <td>${cfg.floors} Floors</td>
        <td>${liftBadge}</td>
        <td>${entText}</td>
        <td>Connected from Floor 3 upwards</td>
      </tr>
    `;
  }).join('');
}

document.getElementById('findRouteBtn').addEventListener('click', updateNavigation);
document.getElementById('runBenchmarkBtn').addEventListener('click', renderBenchmarkTable);
algoSelect.addEventListener('change', () => { if (routeGenerated) updateNavigation(); });
document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => { if (routeGenerated) updateNavigation(); });
});

// Start in clean waiting state until user searches and clicks Generate Route
populateDirectoryTable();
resetMapToWaitingState();
