/**
 * =========================================================================
 * HYPERBRAIN GRAPH ENGINE VERIFICATION SUITE
 * =========================================================================
 * Tests prerequisite cycle detection, topological sorting, path traversals,
 * weak dependency detection, adaptive recommendations, and performance.
 * =========================================================================
 */

// Mocked Nodes
const mockNodes = {
  // OS Subject
  'Operating_Systems': { topicId: 'Operating_Systems', subjectId: 'subject_os', unitId: 'unit_os_1', difficulty: 'Medium', estimatedTime: 60 },
  'Process_Management': { topicId: 'Process_Management', subjectId: 'subject_os', unitId: 'unit_os_1', difficulty: 'Medium', estimatedTime: 45 },
  'Threads': { topicId: 'Threads', subjectId: 'subject_os', unitId: 'unit_os_1', difficulty: 'Easy', estimatedTime: 30 },
  'Synchronization': { topicId: 'Synchronization', subjectId: 'subject_os', unitId: 'unit_os_2', difficulty: 'Hard', estimatedTime: 90 },
  'Critical_Section': { topicId: 'Critical_Section', subjectId: 'subject_os', unitId: 'unit_os_2', difficulty: 'Hard', estimatedTime: 60 },
  'Deadlocks': { topicId: 'Deadlocks', subjectId: 'subject_os', unitId: 'unit_os_2', difficulty: 'Hard', estimatedTime: 75 },
  'Bankers_Algorithm': { topicId: 'Bankers_Algorithm', subjectId: 'subject_os', unitId: 'unit_os_2', difficulty: 'Hard', estimatedTime: 90 },

  // Mathematics
  'Arithmetic': { topicId: 'Arithmetic', subjectId: 'subject_maths', unitId: 'unit_maths_1', difficulty: 'Easy', estimatedTime: 40 },
  'Percentage': { topicId: 'Percentage', subjectId: 'subject_maths', unitId: 'unit_maths_1', difficulty: 'Easy', estimatedTime: 50 },
  'Ratio': { topicId: 'Ratio', subjectId: 'subject_maths', unitId: 'unit_maths_1', difficulty: 'Easy', estimatedTime: 45 },
  'Profit_Loss': { topicId: 'Profit_Loss', subjectId: 'subject_maths', unitId: 'unit_maths_2', difficulty: 'Medium', estimatedTime: 60 }
};

// Mocked Edges
let mockEdges = [
  // OS Edges
  { fromId: 'Operating_Systems', toId: 'Process_Management', type: 'prerequisite' },
  { fromId: 'Process_Management', toId: 'Threads', type: 'prerequisite' },
  { fromId: 'Process_Management', toId: 'Synchronization', type: 'prerequisite' },
  { fromId: 'Critical_Section', toId: 'Synchronization', type: 'related' },
  { fromId: 'Synchronization', toId: 'Deadlocks', type: 'prerequisite' },
  { fromId: 'Deadlocks', toId: 'Bankers_Algorithm', type: 'prerequisite' },

  // Maths Edges
  { fromId: 'Arithmetic', toId: 'Percentage', type: 'prerequisite' },
  { fromId: 'Arithmetic', toId: 'Ratio', type: 'prerequisite' },
  { fromId: 'Percentage', toId: 'Profit_Loss', type: 'prerequisite' },
  { fromId: 'Ratio', toId: 'Profit_Loss', type: 'prerequisite' }
];

// Helper algorithm replicas from learningGraphService.js

/**
 * Cycle Detection
 */
function detectPrerequisiteCycle(fromId, toId, edges) {
  const adj = new Map();
  const tempEdges = [...edges, { fromId, toId, type: 'prerequisite' }];

  tempEdges.forEach(edge => {
    if (edge.type === 'prerequisite' || edge.type === 'builds_upon') {
      if (!adj.has(edge.fromId)) adj.set(edge.fromId, []);
      adj.get(edge.fromId).push(edge.toId);
    }
  });

  const visited = new Set();
  const recStack = new Set();

  const dfs = (id) => {
    if (recStack.has(id)) return true;
    if (visited.has(id)) return false;

    visited.add(id);
    recStack.add(id);

    const neighbors = adj.get(id) || [];
    for (const nextId of neighbors) {
      if (dfs(nextId)) return true;
    }

    recStack.delete(id);
    return false;
  };

  for (const node of adj.keys()) {
    if (dfs(node)) return true;
  }
  return false;
}

/**
 * Get Prerequisite Chain (Topologically Sorted)
 */
function getLearningPath(targetTopicId, edges, nodes, studentProgress = {}) {
  // Pre-index edges for fast O(1) lookup
  const incomingMap = new Map();
  edges.forEach(e => {
    if (e.type === 'prerequisite') {
      if (!incomingMap.has(e.toId)) incomingMap.set(e.toId, []);
      incomingMap.get(e.toId).push(e);
    }
  });

  const subNodes = new Set();
  const visited = new Set();

  const collectDependencies = (id) => {
    if (visited.has(id)) return;
    visited.add(id);

    if (nodes[id]) {
      subNodes.add(id);
    }

    const prereqs = incomingMap.get(id) || [];
    prereqs.forEach(edge => collectDependencies(edge.fromId));
  };

  collectDependencies(targetTopicId);

  const sortedIds = [];
  const tempVisited = new Set();
  const permVisited = new Set();

  const visit = (id) => {
    if (permVisited.has(id)) return;
    if (tempVisited.has(id)) {
      throw new Error("Cycle detected during topological sorting.");
    }

    tempVisited.add(id);

    const prereqs = incomingMap.get(id) || [];
    const filteredPrereqs = prereqs.filter(e => subNodes.has(e.fromId));
    filteredPrereqs.forEach(edge => visit(edge.fromId));

    tempVisited.delete(id);
    permVisited.add(id);
    sortedIds.push(id);
  };

  Array.from(subNodes).forEach(id => {
    if (!permVisited.has(id)) {
      visit(id);
    }
  });

  return sortedIds.map(id => {
    const node = nodes[id];
    const isCompleted = !!studentProgress[id]?.completed;

    let status = 'locked';
    if (isCompleted) {
      status = 'completed';
    } else {
      const directPrereqs = incomingMap.get(id) || [];
      const allPrereqsMet = directPrereqs.every(edge => !!studentProgress[edge.fromId]?.completed);
      if (allPrereqsMet) {
        status = 'ready_to_study';
      }
    }

    return {
      ...node,
      completed: isCompleted,
      status
    };
  });
}

/**
 * Weak Dependencies Inspection
 */
function findWeakDependencies(topicId, edges, nodes, studentPerformance = {}) {
  const prereqsSet = new Set();
  const collectPrereqs = (id) => {
    const direct = edges.filter(e => e.toId === id && e.type === 'prerequisite');
    direct.forEach(edge => {
      if (!prereqsSet.has(edge.fromId)) {
        prereqsSet.add(edge.fromId);
        collectPrereqs(edge.fromId);
      }
    });
  };

  collectPrereqs(topicId);

  const weakList = [];
  prereqsSet.forEach(prId => {
    const perf = studentPerformance[prId];
    const node = nodes[prId];
    if (node) {
      const isStruggling = perf && (perf.score < 60 || perf.status === 'struggling' || perf.completed === false);
      const hasNoRecord = !perf;
      
      if (isStruggling || hasNoRecord) {
        weakList.push({
          ...node,
          score: perf?.score ?? 0,
          perfStatus: perf?.status ?? 'incomplete'
        });
      }
    }
  });

  return weakList;
}

/**
 * Adaptive Recommendation logic
 */
function recommendNextTopic(subjectId, edges, nodes, studentProgress = {}) {
  const subjectNodes = Object.values(nodes).filter(n => n.subjectId === subjectId);
  const uncompletedNodes = subjectNodes.filter(node => !studentProgress[node.topicId]?.completed);
  
  if (uncompletedNodes.length === 0) return null;

  const readyToStudy = [];
  for (const node of uncompletedNodes) {
    const directPrereqs = edges.filter(e => e.toId === node.topicId && e.type === 'prerequisite');
    const allPrereqsMet = directPrereqs.every(edge => !!studentProgress[edge.fromId]?.completed);

    if (allPrereqsMet) {
      readyToStudy.push(node);
    }
  }

  if (readyToStudy.length === 0) {
    return uncompletedNodes[0];
  }

  const diffValues = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
  readyToStudy.sort((a, b) => {
    const diffA = diffValues[a.difficulty] || 2;
    const diffB = diffValues[b.difficulty] || 2;
    if (diffA !== diffB) return diffA - diffB;
    return (a.estimatedTime || 30) - (b.estimatedTime || 30);
  });

  return readyToStudy[0];
}

// ==========================================
// TEST EXECUTION RUNS
// ==========================================

console.log("-------------------------------------------------------------------");
console.log("🧪 RUNNING HYPERBRAIN GRAPH ENGINE ALGORITHM TESTS");
console.log("-------------------------------------------------------------------");

let passed = true;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.error(`❌ [FAIL] ${message}`);
    passed = false;
  }
}

// Test 1: Cycle Detection Prevention
const hasCycle1 = detectPrerequisiteCycle('Deadlocks', 'Synchronization', mockEdges);
assert(hasCycle1 === true, "Adding Deadlocks -> Synchronization prerequisite creates a loop (Expected: TRUE)");

const hasCycle2 = detectPrerequisiteCycle('Arithmetic', 'Profit_Loss', mockEdges);
assert(hasCycle2 === false, "Adding Arithmetic -> Profit_Loss prerequisite (no loop) (Expected: FALSE)");


// Test 2: Topological Sorting for Study Paths (Deadlocks)
try {
  const path = getLearningPath('Deadlocks', mockEdges, mockNodes, {});
  const sortedIds = path.map(p => p.topicId);
  const correctOrder = sortedIds.indexOf('Operating_Systems') < sortedIds.indexOf('Process_Management') &&
                     sortedIds.indexOf('Process_Management') < sortedIds.indexOf('Synchronization') &&
                     sortedIds.indexOf('Synchronization') < sortedIds.indexOf('Deadlocks');
  
  assert(correctOrder === true, "Topological sort orders Deadlocks dependencies correctly (OS -> Process -> Synch -> Deadlocks)");
  assert(sortedIds.includes('Operating_Systems') && sortedIds.includes('Process_Management') && sortedIds.includes('Synchronization'), "All prerequisites present in Deadlock path");
} catch (e) {
  assert(false, "Topological sort failed with error: " + e.message);
}


// Test 3: Adaptive Learning Block (prerequisites not met)
const mockProgress = {
  'Operating_Systems': { completed: true },
  'Process_Management': { completed: true },
  'Synchronization': { completed: false } // Synchronization is incomplete
};

const pathWithProgress = getLearningPath('Deadlocks', mockEdges, mockNodes, mockProgress);
const deadlocksStep = pathWithProgress.find(p => p.topicId === 'Deadlocks');
const synchStep = pathWithProgress.find(p => p.topicId === 'Synchronization');

assert(synchStep.status === 'ready_to_study', "Synchronization status is 'ready_to_study' (all its prereqs are done)");
assert(deadlocksStep.status === 'locked', "Deadlocks status is 'locked' because Synchronization is incomplete");


// Test 4: Recommendation Picker ordering by difficulty and chapter prerequisites
const mathsProgress = {
  'Arithmetic': { completed: true },
  // Percentage and Ratio are uncompleted but ready to study
};

const recommendation = recommendNextTopic('subject_maths', mockEdges, mockNodes, mathsProgress);
assert(recommendation !== null, "Maths recommendations list has values");
assert(recommendation.topicId === 'Ratio' || recommendation.topicId === 'Percentage', "Recommended topic is Percentage or Ratio (prerequisites met)");


// Test 5: Weak Topic Detection
const mockPerformance = {
  'Operating_Systems': { score: 90, status: 'mastered' },
  'Process_Management': { score: 45, status: 'struggling' }, // Struggling with process management
  'Synchronization': { score: 50, status: 'struggling' }   // Struggling with synchronization
};

const weakDeps = findWeakDependencies('Deadlocks', mockEdges, mockNodes, mockPerformance);
const weakIds = weakDeps.map(w => w.topicId);

assert(weakIds.includes('Process_Management'), "Weak dependency checker flagged 'Process_Management' (score 45%)");
assert(weakIds.includes('Synchronization'), "Weak dependency checker flagged 'Synchronization' (score 50%)");
assert(!weakIds.includes('Operating_Systems'), "Weak dependency checker did NOT flag 'Operating_Systems' (score 90%)");


// Test 6: Performance check (sub-millisecond latency check on queries)
const totalNodesCount = 1000;
const speedNodes = {};
const speedEdges = [];

// Populate a huge simulated graph with 1,000 nodes and linear prerequisites
for (let i = 1; i <= totalNodesCount; i++) {
  speedNodes[`node_${i}`] = { topicId: `node_${i}`, subjectId: 'speed_test', difficulty: 'Medium', estimatedTime: 30 };
  if (i > 1) {
    speedEdges.push({ fromId: `node_${i-1}`, toId: `node_${i}`, type: 'prerequisite' });
  }
}

const speedStart = Date.now();
const speedPath = getLearningPath(`node_${totalNodesCount}`, speedEdges, speedNodes, {});
const speedDuration = Date.now() - speedStart;

assert(speedPath.length === totalNodesCount, `Successfully traversed 1000 nodes prerequisite chain`);
assert(speedDuration < 15, `Traversal queries speed audit check: ${speedDuration}ms (Expected < 15ms)`);

console.log("-------------------------------------------------------------------");
if (passed) {
  console.log("⭐ ALL GRAPH ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
} else {
  console.error("💥 SYSTEM AUDIT FAILURES DETECTED IN ALGORITHMS.");
  process.exit(1);
}
