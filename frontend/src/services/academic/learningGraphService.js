import { firestoreRepository } from '../../repositories/academic/firestoreRepository';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';

/**
 * =========================================================================
 * HYPERBRAIN LEARNING GRAPH ENGINE (Phase 2.5)
 * =========================================================================
 * Intelligence layer that manages nodes, relationships, caching, topological 
 * traversals, cycle prevention, and adaptive recommendations.
 * =========================================================================
 */

// In-memory Graph Representation Caching
let nodesCache = new Map(); // topicId -> Node Object
let edgesCache = [];        // Array of Edge Objects
let incomingPrereqsMap = new Map(); // targetTopicId -> list of prerequisite edges
let outgoingPrereqsMap = new Map(); // sourceTopicId -> list of dependent edges
let cachesInitialized = false;

// LRU/Traversal Cache for common paths
const traversalCache = new Map();

function rebuildIndexMaps() {
  incomingPrereqsMap.clear();
  outgoingPrereqsMap.clear();
  edgesCache.forEach(edge => {
    if (edge.type === 'prerequisite') {
      if (!incomingPrereqsMap.has(edge.toId)) incomingPrereqsMap.set(edge.toId, []);
      incomingPrereqsMap.get(edge.toId).push(edge);

      if (!outgoingPrereqsMap.has(edge.fromId)) outgoingPrereqsMap.set(edge.fromId, []);
      outgoingPrereqsMap.get(edge.fromId).push(edge);
    }
  });
}

export const learningGraphService = {
  
  /**
   * Initialize in-memory cache from Firestore database
   * Ensures sub-millisecond graph query traversals
   */
  async ensureCacheLoaded(forceReload = false) {
    if (cachesInitialized && !forceReload) return;

    try {
      console.log("[GraphEngine] Loading graph into memory cache...");
      const startTime = Date.now();

      // Retrieve all graph nodes and edges
      const nodesData = await firestoreRepository.queryDocs('learning_graph_nodes', [], 3000);
      const edgesData = await firestoreRepository.queryDocs('learning_graph_edges', [], 8000);

      nodesCache.clear();
      nodesData.forEach(node => {
        if (node.topicId) {
          nodesCache.set(node.topicId, node);
        }
      });

      edgesCache = edgesData || [];
      rebuildIndexMaps();
      traversalCache.clear();
      cachesInitialized = true;

      console.log(`[GraphEngine] Cache loaded in ${Date.now() - startTime}ms. Nodes: ${nodesCache.size}, Edges: ${edgesCache.length}`);
    } catch (error) {
      console.warn("[GraphEngine] Failed to load cache from Firestore. Defaulting to local memory:", error);
      // Ensure local memory fallback is initialized and doesn't block the app
      if (!nodesCache) nodesCache = new Map();
      if (!edgesCache) edgesCache = [];
      rebuildIndexMaps();
      cachesInitialized = true;
    }
  },

  /**
   * Reset/Clear the graph in-memory state
   */
  clearLocalCache() {
    nodesCache.clear();
    edgesCache = [];
    incomingPrereqsMap.clear();
    outgoingPrereqsMap.clear();
    traversalCache.clear();
    cachesInitialized = false;
  },

  // ==========================================
  // NODE CRUD OPERATIONS
  // ==========================================

  /**
   * Save or Update a Graph Node
   * @param {Object} nodeData - Node object
   */
  async saveNode(nodeData) {
    await this.ensureCacheLoaded();
    const { topicId, subjectId, unitId, difficulty, estimatedTime, knowledgeObjectId, learningObjectives = [], type = 'topic', metadata = {} } = nodeData;

    if (!topicId) throw new Error("topicId is required to save a graph node.");

    const nodeDoc = {
      id: topicId,
      topicId,
      subjectId: subjectId || '',
      unitId: unitId || '',
      difficulty: difficulty || 'Medium',
      estimatedTime: Number(estimatedTime) || 30, // in minutes
      knowledgeObjectId: knowledgeObjectId || '',
      learningObjectives: Array.isArray(learningObjectives) ? learningObjectives : [],
      type: type || 'topic',
      metadata: metadata || {},
      updatedAt: new Date().toISOString()
    };

    // Save in Firestore
    await firestoreRepository.save('learning_graph_nodes', topicId, nodeDoc);

    // Sync memory cache
    nodesCache.set(topicId, nodeDoc);
    traversalCache.clear(); // Invalidate traversals

    return topicId;
  },

  /**
   * Get a node by its ID
   */
  async getNode(topicId) {
    await this.ensureCacheLoaded();
    return nodesCache.get(topicId) || null;
  },

  /**
   * Delete a Node and all of its associated edges
   */
  async deleteNode(topicId) {
    await this.ensureCacheLoaded();

    // 1. Delete Node Document
    await firestoreRepository.delete('learning_graph_nodes', topicId);

    // 2. Query and delete associated edges from Firestore in a batch (both incoming and outgoing)
    const associatedEdges = edgesCache.filter(e => e.fromId === topicId || e.toId === topicId);
    
    if (associatedEdges.length > 0 && db) {
      const batch = writeBatch(db);
      associatedEdges.forEach(edge => {
        const edgeId = edge.id || `edge_${edge.fromId}_${edge.toId}_${edge.type}`;
        const docRef = doc(db, 'learning_graph_edges', edgeId);
        batch.delete(docRef);
      });
      await batch.commit();
    }

    // 3. Sync memory cache
    nodesCache.delete(topicId);
    edgesCache = edgesCache.filter(e => e.fromId !== topicId && e.toId !== topicId);
    rebuildIndexMaps();
    traversalCache.clear();

    return topicId;
  },

  /**
   * Get all cached nodes
   */
  async getAllNodes() {
    await this.ensureCacheLoaded();
    return Array.from(nodesCache.values());
  },

  // ==========================================
  // EDGE / RELATIONSHIP CRUD OPERATIONS
  // ==========================================

  /**
   * Save a Relationship/Edge between two Nodes
   */
  async saveEdge(fromId, toId, type, metadata = {}) {
    await this.ensureCacheLoaded();

    if (!fromId || !toId || !type) {
      throw new Error("Missing fromId, toId, or type for graph edge registration.");
    }

    // 1. Verify that both nodes exist in the graph
    if (!nodesCache.has(fromId) || !nodesCache.has(toId)) {
      throw new Error(`Cannot connect nodes. One or both nodes do not exist: ${fromId}, ${toId}`);
    }

    // 2. Avoid duplicate edges
    const exists = edgesCache.some(e => e.fromId === fromId && e.toId === toId && e.type === type);
    if (exists) return `edge_${fromId}_${toId}_${type}`;

    // 3. Run cycle detection for structural prerequisite/builds-upon linkages
    if (type === 'prerequisite' || type === 'builds_upon') {
      const wouldCauseCycle = this.detectPrerequisiteCycle(fromId, toId);
      if (wouldCauseCycle) {
        throw new Error(`Circular prerequisite chain detected! Connecting ${fromId} -> ${toId} is blocked.`);
      }
    }

    const edgeId = `edge_${fromId}_${toId}_${type}`;
    const edgeDoc = {
      id: edgeId,
      fromId,
      toId,
      type,
      metadata: metadata || {},
      createdAt: new Date().toISOString()
    };

    // Save in Firestore
    await firestoreRepository.save('learning_graph_edges', edgeId, edgeDoc);

    // Sync memory cache
    edgesCache.push(edgeDoc);
    rebuildIndexMaps();
    traversalCache.clear();

    return edgeId;
  },

  /**
   * Delete an Edge/Relationship
   */
  async deleteEdge(fromId, toId, type) {
    await this.ensureCacheLoaded();
    const edgeId = `edge_${fromId}_${toId}_${type}`;

    // Delete in Firestore
    await firestoreRepository.delete('learning_graph_edges', edgeId);

    // Sync memory cache
    edgesCache = edgesCache.filter(e => !(e.fromId === fromId && e.toId === toId && e.type === type));
    rebuildIndexMaps();
    traversalCache.clear();

    return edgeId;
  },

  /**
   * Get all cached edges
   */
  async getAllEdges() {
    await this.ensureCacheLoaded();
    return edgesCache;
  },

  // ==========================================
  // GRAPH SERVICE TRAVERSALS
  // ==========================================

  /**
   * Retrieve direct prerequisites for a given topic
   */
  async getPrerequisites(topicId) {
    await this.ensureCacheLoaded();
    const prRefs = incomingPrereqsMap.get(topicId) || [];
    return prRefs
      .map(ref => nodesCache.get(ref.fromId))
      .filter(Boolean);
  },

  /**
   * Retrieve topics that depend on the given topic (i.e. this topic is their prerequisite)
   * or are marked as next topics
   */
  async getNextTopics(topicId) {
    await this.ensureCacheLoaded();
    // Pre-indexed outgoing prerequisites
    const depRefs = outgoingPrereqsMap.get(topicId) || [];
    // Outgoing recommended_next or builds_upon
    const otherRefs = edgesCache.filter(e => e.fromId === topicId && (e.type === 'recommended_next' || e.type === 'builds_upon'));
    const allRefs = [...depRefs, ...otherRefs];

    const targetIds = new Set(allRefs.map(ref => ref.toId));
    return Array.from(targetIds)
      .map(id => nodesCache.get(id))
      .filter(Boolean);
  },

  /**
   * Retrieve related topics (siblings, confused with, same unit/subject)
   */
  async getRelatedTopics(topicId) {
    await this.ensureCacheLoaded();
    const relatedTypes = ['related', 'confused_with', 'same_unit', 'same_subject', 'cross_subject'];
    
    const relRefs = edgesCache.filter(e => 
      (e.fromId === topicId || e.toId === topicId) && 
      relatedTypes.includes(e.type)
    );

    const relatedIds = new Set();
    relRefs.forEach(edge => {
      if (edge.fromId !== topicId) relatedIds.add(edge.fromId);
      if (edge.toId !== topicId) relatedIds.add(edge.toId);
    });

    return Array.from(relatedIds)
      .map(id => nodesCache.get(id))
      .filter(Boolean);
  },

  /**
   * Generate complete learning path to master a target topic
   * Resolves recursive prerequisite structures and outputs a topologically sorted checklist
   * 
   * @param {string} targetTopicId 
   * @param {Object} studentProgress - Map of { [topicId]: { completed: boolean } }
   */
  async getLearningPath(targetTopicId, studentProgress = {}) {
    await this.ensureCacheLoaded();

    const cacheKey = `path_${targetTopicId}_${JSON.stringify(studentProgress)}`;
    if (traversalCache.has(cacheKey)) {
      return traversalCache.get(cacheKey);
    }

    // 1. DFS to find all transitive prerequisites (dependency sub-graph)
    const subNodes = new Set();
    const visited = new Set();

    const collectDependencies = (id) => {
      if (visited.has(id)) return;
      visited.add(id);

      // Add node if it exists
      const node = nodesCache.get(id);
      if (node) {
        subNodes.add(id);
      }

      // Find prerequisites using index map
      const prereqs = incomingPrereqsMap.get(id) || [];
      prereqs.forEach(edge => collectDependencies(edge.fromId));
    };

    collectDependencies(targetTopicId);

    // 2. Topological Sort (Kahn's or DFS) on the collected subNodes
    const sortedIds = [];
    const tempVisited = new Set();
    const permVisited = new Set();

    const visit = (id) => {
      if (permVisited.has(id)) return;
      if (tempVisited.has(id)) {
        throw new Error("Cycle detected during topological sorting. Path cannot be computed.");
      }

      tempVisited.add(id);

      // Find prerequisites of this node in our sub-graph using index map
      const prereqs = incomingPrereqsMap.get(id) || [];
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

    // 3. Annotate nodes with completion statuses
    const path = sortedIds.map(id => {
      const node = nodesCache.get(id);
      const isCompleted = !!studentProgress[id]?.completed;

      // Determine readiness status
      let status = 'locked';
      if (isCompleted) {
        status = 'completed';
      } else {
        // Check if all direct prerequisites are completed
        const directPrereqs = incomingPrereqsMap.get(id) || [];
        const allPrereqsMet = directPrereqs.every(edge => !!studentProgress[edge.fromId]?.completed);
        
        if (allPrereqsMet) {
          status = 'ready_to_study';
        }
      }

      return {
        ...node,
        completed: isCompleted,
        status // 'completed' | 'ready_to_study' | 'locked'
      };
    });

    traversalCache.set(cacheKey, path);
    return path;
  },

  /**
   * Detect weak prerequisite topics if a student struggles with a topic
   * 
   * @param {string} topicId - The topic the student is struggling with
   * @param {Object} studentPerformance - Map of { [topicId]: { score: number, status: string } }
   */
  async findWeakDependencies(topicId, studentPerformance = {}) {
    await this.ensureCacheLoaded();

    // 1. Gather all prerequisites recursively using index map
    const prereqsSet = new Set();
    const collectPrereqs = (id) => {
      const direct = incomingPrereqsMap.get(id) || [];
      direct.forEach(edge => {
        if (!prereqsSet.has(edge.fromId)) {
          prereqsSet.add(edge.fromId);
          collectPrereqs(edge.fromId);
        }
      });
    };

    collectPrereqs(topicId);

    // 2. Identify prerequisites where student struggles (score < 60% or marked weak)
    const weakList = [];
    prereqsSet.forEach(prId => {
      const perf = studentPerformance[prId];
      const node = nodesCache.get(prId);
      if (node) {
        const isStruggling = perf && (perf.score < 60 || perf.status === 'struggling' || perf.completed === false);
        const hasNoRecord = !perf; // If they haven't studied it and are struggling in advanced topic, it's incomplete
        
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
  },

  /**
   * Recommend the next best topic for a student to study in a subject
   * 
   * @param {string} studentId 
   * @param {string} subjectId 
   * @param {Object} studentProgress - Map of { [topicId]: { completed: boolean } }
   */
  async recommendNextTopic(studentId, subjectId, studentProgress = {}) {
    await this.ensureCacheLoaded();

    // 1. Get all nodes in the subject
    const subjectNodes = Array.from(nodesCache.values()).filter(n => n.subjectId === subjectId);
    if (subjectNodes.length === 0) return null;

    // 2. Filter out topics already completed
    const uncompletedNodes = subjectNodes.filter(node => !studentProgress[node.topicId]?.completed);
    if (uncompletedNodes.length === 0) return null; // Fully completed subject!

    // 3. Find uncompleted nodes where all prerequisites are completed using index map
    const readyToStudy = [];
    for (const node of uncompletedNodes) {
      const directPrereqs = incomingPrereqsMap.get(node.topicId) || [];
      const allPrereqsMet = directPrereqs.every(edge => !!studentProgress[edge.fromId]?.completed);

      if (allPrereqsMet) {
        readyToStudy.push(node);
      }
    }

    if (readyToStudy.length === 0) {
      // Students have stuck paths (e.g. prerequisite chains not in subject, or cycles in DB not checked)
      // Return the first uncompleted node as fallback, but ideally should not happen.
      return uncompletedNodes[0];
    }

    // 4. Sort ready-to-study nodes: Difficulty ('Easy' -> 'Medium' -> 'Hard') then estimatedTime
    const diffValues = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
    readyToStudy.sort((a, b) => {
      const diffA = diffValues[a.difficulty] || 2;
      const diffB = diffValues[b.difficulty] || 2;
      if (diffA !== diffB) return diffA - diffB;
      return (a.estimatedTime || 30) - (b.estimatedTime || 30);
    });

    return readyToStudy[0];
  },

  /**
   * Generate a Personalized Study Bundle containing paths, next recommendations, and revision list
   * 
   * @param {string} studentId
   * @param {string} subjectId
   * @param {Object} studentProgress - Map of { [topicId]: { completed: boolean, lastStudied: string } }
   * @param {Object} studentPerformance - Map of { [topicId]: { score: number, status: string } }
   */
  async generatePersonalizedPath(studentId, subjectId, studentProgress = {}, studentPerformance = {}) {
    await this.ensureCacheLoaded();

    // 1. Recommended Next Topic
    const recommendedNext = await this.recommendNextTopic(studentId, subjectId, studentProgress);

    // 2. Today's Learning Path
    let todaysPath = [];
    if (recommendedNext) {
      todaysPath = await this.getLearningPath(recommendedNext.topicId, studentProgress);
    }

    // 3. Revision Order (Completed items with lowest scores or oldest lastStudied date)
    const completedSubjectNodes = Array.from(nodesCache.values()).filter(n => 
      n.subjectId === subjectId && !!studentProgress[n.topicId]?.completed
    );

    const revisionOrder = completedSubjectNodes.map(node => {
      const perf = studentPerformance[node.topicId] || {};
      const score = perf.score ?? 100;
      const lastStudied = studentProgress[node.topicId]?.lastStudied || '2000-01-01T00:00:00.000Z';
      return { ...node, score, lastStudied };
    }).sort((a, b) => {
      // Prioritize low scores first, then older study times
      if (a.score !== b.score) return a.score - b.score;
      return new Date(a.lastStudied) - new Date(b.lastStudied);
    });

    // 4. Weak Topic Path
    let weakTopicPath = [];
    if (recommendedNext) {
      weakTopicPath = await this.findWeakDependencies(recommendedNext.topicId, studentPerformance);
    }

    // 5. Exam Priority Path (Uncompleted nodes ordered by difficulty and estimated study time)
    const uncompletedNodes = Array.from(nodesCache.values()).filter(n => 
      n.subjectId === subjectId && !studentProgress[n.topicId]?.completed
    );
    const examPriorityPath = [...uncompletedNodes].sort((a, b) => {
      const diffValues = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
      const diffA = diffValues[a.difficulty] || 2;
      const diffB = diffValues[b.difficulty] || 2;
      if (diffA !== diffB) return diffA - diffB;
      return (a.estimatedTime || 30) - (b.estimatedTime || 30);
    });

    return {
      recommendedNext,
      todaysPath,
      revisionOrder: revisionOrder.slice(0, 5), // Keep top 5 for revision
      weakTopicPath,
      examPriorityPath
    };
  },

  // ==========================================
  // GRAPH INTEGRITY VALIDATIONS
  // ==========================================

  /**
   * Run structural diagnostics checks on the graph
   */
  async validateGraph() {
    await this.ensureCacheLoaded();
    const startTime = Date.now();

    const errors = [];
    const warnings = [];
    const orphanNodes = [];

    // 1. Identify Orphan Nodes
    nodesCache.forEach((node, topicId) => {
      const hasEdges = edgesCache.some(e => e.fromId === topicId || e.toId === topicId);
      if (!hasEdges) {
        orphanNodes.push(node);
        warnings.push(`Orphan node detected: ${node.topicId} (${node.difficulty}) has no connections.`);
      }
    });

    // 2. Verify No Circular Prerequisites (Cycle Detection)
    const visited = new Set();
    const recStack = new Set();
    const adj = new Map();

    edgesCache.forEach(edge => {
      if (edge.type === 'prerequisite' || edge.type === 'builds_upon') {
        if (!adj.has(edge.fromId)) adj.set(edge.fromId, []);
        adj.get(edge.fromId).push(edge.toId);
      }
    });

    const dfs = (id) => {
      if (recStack.has(id)) return true; // Cycle!
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

    let hasCycle = false;
    for (const id of adj.keys()) {
      if (!visited.has(id)) {
        if (dfs(id)) {
          hasCycle = true;
          errors.push(`Prerequisite cycle detected involving node: ${id}`);
          break;
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: errors.length === 0,
      errors,
      warnings,
      orphanNodes,
      performance: {
        nodeCount: nodesCache.size,
        edgeCount: edgesCache.length,
        auditDurationMs: duration
      }
    };
  },

  /**
   * Helper DFS cycle validation specifically used for saveEdge
   */
  detectPrerequisiteCycle(fromId, toId) {
    const adj = new Map();
    // Simulate proposed edge insertion
    const tempEdges = [...edgesCache, { fromId, toId, type: 'prerequisite' }];

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
};
