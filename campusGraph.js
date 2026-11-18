// campusGraph.js
// LPU Blocks 25-38 topology (14 blocks, 94 total floors) with calibrated floor & persona metrics
const BLOCK_CONFIG = {
  // Top Horizontal Row (25-30 separated; 30-31 joined)
  25: { floors: 8, hasLift: true,  x: 42,  y: 92,  w: 66, h: 66, entrances: ['north', 'east_gap'] },
  26: { floors: 6, hasLift: false, x: 132, y: 92,  w: 66, h: 66, entrances: ['north', 'south'] },
  27: { floors: 5, hasLift: false, x: 222, y: 92,  w: 66, h: 66, entrances: ['north', 'south'] },
  28: { floors: 5, hasLift: false, x: 312, y: 92,  w: 66, h: 66, entrances: ['north', 'south'] },
  29: { floors: 5, hasLift: false, x: 402, y: 92,  w: 66, h: 66, entrances: ['north', 'south'] },
  30: { floors: 6, hasLift: true,  x: 492, y: 92,  w: 66, h: 66, entrances: ['north', 'south'] },
  31: { floors: 6, hasLift: true,  x: 558, y: 92,  w: 66, h: 66, entrances: [] },

  // Right Vertical Column (32-35 joined vertically)
  32: { floors: 8, hasLift: false, x: 558, y: 185, w: 66, h: 64, entrances: ['west', 'east'] },
  33: { floors: 6, hasLift: false, x: 558, y: 249, w: 66, h: 64, entrances: ['west', 'east'] },
  34: { floors: 6, hasLift: false, x: 558, y: 313, w: 66, h: 64, entrances: ['west', 'east'] },
  35: { floors: 6, hasLift: false, x: 558, y: 377, w: 66, h: 64, entrances: ['west', 'east'] },

  // Bottom Unified Complex (38, 37, 36 joined horizontally)
  38: { floors: 9, hasLift: true,  x: 68,  y: 355, w: 136, h: 86, entrances: ['north'] },
  37: { floors: 9, hasLift: true,  x: 204, y: 355, w: 136, h: 86, entrances: ['north'] },
  36: { floors: 9, hasLift: true,  x: 340, y: 355, w: 136, h: 86, entrances: ['south'] }
};

const BLOCK_ORDER = [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38];

const ENTRANCE_LABELS = {
  north: 'Robo Park / North Side Entrance (F1)',
  south: 'Central Road / South Side Entrance (F1)',
  west: 'Inner Courtyard / West Side Entrance (F1)',
  east: 'East Road Side Entrance (F1)',
  east_gap: 'East Passage Entrance between Blk 25 & 26 (F1)'
};

function getEntranceCoords(block, side) {
  const c = BLOCK_CONFIG[block];
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  if (side === 'north') return { x: cx, y: c.y - 12 };
  if (side === 'south') return { x: cx, y: c.y + c.h + 12 };
  if (side === 'west')  return { x: c.x - 12, y: cy };
  if (side === 'east')  return { x: c.x + c.w + 12, y: cy };
  if (side === 'east_gap') return { x: c.x + c.w + 12, y: cy + 8 };
  return { x: cx, y: cy };
}

function buildCampusGraph() {
  const nodes = {};
  const edges = [];

  function addNode(id, label, block, floor, type, x, y) {
    nodes[id] = { id, label, block, floor, type, x, y };
  }

  function addBidirectionalEdge(u, v, type, distance, time, effort, accessible, description) {
    edges.push({
      id: `${u}->${v}`, from: u, to: v, type, distance, time, effort,
      accessible, blocked: false, crowded: false, description
    });
    edges.push({
      id: `${v}->${u}`, from: v, to: u, type, distance, time, effort,
      accessible, blocked: false, crowded: false, description
    });
  }

  // 1. Intra-Block Vertical Edges & Entrances
  for (const block of BLOCK_ORDER) {
    const cfg = BLOCK_CONFIG[block];
    const cx = cfg.x + cfg.w / 2;
    const cy = cfg.y + cfg.h / 2;

    for (let f = 1; f <= cfg.floors; f++) {
      const hubId = `B${block}_F${f}`;
      addNode(hubId, `Block ${block} — Floor ${f}`, block, f, 'corridor', cx, cy);

      if (f < cfg.floors) {
        const nextHubId = `B${block}_F${f + 1}`;
        // Stairs: 28m, 20 seconds per floor, high physical effort (14 pts)
        addBidirectionalEdge(
          hubId, nextHubId, 'stairs', 28, 20, 14, false,
          `Stairs in Block ${block} (Floor ${f} → Floor ${f + 1})`
        );

        // Lift: 25m vertical shaft equivalent, 5 seconds per floor, minimal effort (1 pt)
        if (cfg.hasLift) {
          addBidirectionalEdge(
            hubId, nextHubId, 'lift', 25, 5, 1, true,
            `Lift in Block ${block} (Floor ${f} → Floor ${f + 1})`
          );
        }
      }
    }

    // Ground entrances (base 15m / 12s; pathfinder scales ramp distance/time for wheelchair users)
    cfg.entrances.forEach((side, idx) => {
      const pt = getEntranceCoords(block, side);
      const entId = `B${block}_ENT_${side.toUpperCase()}`;
      const gateTag = idx === 0 ? 'Gate A' : 'Gate B';
      addNode(entId, `Block ${block} — ${gateTag} (${ENTRANCE_LABELS[side]})`, block, 1, 'entrance', pt.x, pt.y);

      addBidirectionalEdge(
        entId, `B${block}_F1`, 'ramp', 15, 12, 2, true,
        `Accessible entrance into Block ${block} Floor 1 (${ENTRANCE_LABELS[side]})`
      );
    });
  }

  // 2. Ground-Level Outdoor Walkways
  const groundChain = [
    'B25_ENT_NORTH', 'B25_ENT_EAST_GAP', 'B26_ENT_NORTH', 'B26_ENT_SOUTH',
    'B27_ENT_SOUTH', 'B28_ENT_SOUTH', 'B29_ENT_SOUTH', 'B30_ENT_SOUTH',
    'B32_ENT_WEST', 'B33_ENT_WEST', 'B34_ENT_WEST', 'B35_ENT_WEST',
    'B36_ENT_SOUTH', 'B37_ENT_NORTH', 'B38_ENT_NORTH'
  ];
  for (let i = 0; i < groundChain.length - 1; i++) {
    const u = groundChain[i];
    const v = groundChain[i + 1];
    addBidirectionalEdge(
      u, v, 'outdoor_walkway', 38, 30, 3, true,
      `Accessible ground walkway: ${nodes[u].label.split('—')[0].trim()} ↔ ${nodes[v].label.split('—')[0].trim()}`
    );
  }

  const northChain = ['B25_ENT_NORTH', 'B26_ENT_NORTH', 'B27_ENT_NORTH', 'B28_ENT_NORTH', 'B29_ENT_NORTH', 'B30_ENT_NORTH'];
  for (let i = 0; i < northChain.length - 1; i++) {
    addBidirectionalEdge(
      northChain[i], northChain[i + 1], 'outdoor_walkway', 35, 28, 3, true,
      `Robo Park side accessible pathway (${northChain[i].split('_')[0]} ↔ ${northChain[i+1].split('_')[0]})`
    );
  }

  const eastChain = ['B32_ENT_EAST', 'B33_ENT_EAST', 'B34_ENT_EAST', 'B35_ENT_EAST'];
  for (let i = 0; i < eastChain.length - 1; i++) {
    addBidirectionalEdge(
      eastChain[i], eastChain[i + 1], 'outdoor_walkway', 30, 24, 2, true,
      `East Road accessible pathway (${eastChain[i].split('_')[0]} ↔ ${eastChain[i+1].split('_')[0]})`
    );
  }

  // 3. Inter-Block Upper Connections (Floor 3 upwards)
  const joinedPairs = new Set(['30-31', '32-33', '33-34', '34-35', '36-37', '37-38']);

  for (let i = 0; i < BLOCK_ORDER.length - 1; i++) {
    const b1 = BLOCK_ORDER[i];
    const b2 = BLOCK_ORDER[i + 1];
    const maxSharedFloor = Math.min(BLOCK_CONFIG[b1].floors, BLOCK_CONFIG[b2].floors);
    const pairKey = `${Math.min(b1, b2)}-${Math.max(b1, b2)}`;
    const isUnified36to38 = (b1 >= 36 && b2 <= 38);
    const isInternalJoined = joinedPairs.has(pairKey);

    const startFloor = isUnified36to38 ? 1 : 3;
    const connType = isUnified36to38 ? 'shared_corridor' : (isInternalJoined ? 'internal_link' : 'skybridge');

    for (let f = startFloor; f <= maxSharedFloor; f++) {
      const desc = isUnified36to38
        ? `Walk through unified 36–38 corridor (Block ${b1} ↔ Block ${b2}, Floor ${f})`
        : (isInternalJoined
          ? `Pass through internal Floor ${f} passage between joined Blocks ${b1} & ${b2}`
          : `Cross elevated Floor ${f} skybridge between Block ${b1} & Block ${b2}`);
      addBidirectionalEdge(`B${b1}_F${f}`, `B${b2}_F${f}`, connType, 28, 22, 2, true, desc);
    }
  }

  // 4. Cross-Road 3rd-Floor Skybridges
  addBidirectionalEdge(
    'B26_F3', 'B38_F3', 'cross_skybridge', 78, 58, 4, true,
    'Cross-road 3rd-floor skybridge: Block 26 ↔ Block 38 (Floor 3)'
  );

  addBidirectionalEdge(
    'B28_F3', 'B37_F3', 'cross_skybridge', 75, 55, 4, true,
    'Cross-road 3rd-floor skybridge: Block 28 ↔ Block 36–38 Common Corridor (Floor 3)'
  );

  return { nodes, edges, BLOCK_CONFIG, BLOCK_ORDER, getEntranceCoords };
}
