import React, { useState, useEffect, useMemo } from 'react';
import { 
  GitCommit, Activity, RefreshCw, Plus, CheckCircle2, AlertTriangle, 
  Trash2, Play, BookOpen, Layers, Clock, AlertCircle, HelpCircle, Check, Award,
  Sparkles, Search, Compass, ShieldAlert, ArrowRight, UserCheck
} from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import { learningGraphService } from '../../services/academic/learningGraphService';

export default function LearningGraphManagement({ showToast }) {
  const [activeTab, setActiveTab] = useState('diagnostics');
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);

  // Forms
  const [nodeForm, setNodeForm] = useState({
    topicId: '',
    subjectId: '',
    unitId: '',
    difficulty: 'Medium',
    estimatedTime: 30,
    knowledgeObjectId: '',
    learningObjectives: '',
    type: 'topic'
  });

  const [edgeForm, setEdgeForm] = useState({
    fromId: '',
    toId: '',
    type: 'prerequisite'
  });

  // Search/Filters
  const [nodeSearch, setNodeSearch] = useState('');
  const [edgeSearch, setEdgeSearch] = useState('');

  // Path Simulator Playground State
  const [simTarget, setSimTarget] = useState('');
  const [simCompleted, setSimCompleted] = useState({});
  const [simPerformance, setSimPerformance] = useState({});
  const [simulationResult, setSimulationResult] = useState(null);

  // Supported relationships list
  const relationshipTypes = [
    { value: 'prerequisite', label: 'Prerequisite (Blocks advanced)' },
    { value: 'builds_upon', label: 'Builds Upon (Structured transition)' },
    { value: 'related', label: 'Related Topic (Cross-linked)' },
    { value: 'confused_with', label: 'Frequently Confused With' },
    { value: 'recommended_next', label: 'Recommended Next' },
    { value: 'exam_sequence', label: 'Exam Sequence Priority' },
    { value: 'same_unit', label: 'Belongs to Same Unit' },
    { value: 'same_subject', label: 'Belongs to Same Subject' },
    { value: 'cross_subject', label: 'Cross Subject Connection' }
  ];

  // Load Graph Data
  const loadData = async () => {
    setLoading(true);
    try {
      await learningGraphService.ensureCacheLoaded(true);
      const allNodes = await learningGraphService.getAllNodes();
      const allEdges = await learningGraphService.getAllEdges();
      const report = await learningGraphService.validateGraph();
      
      setNodes(allNodes);
      setEdges(allEdges);
      setDiagnostics(report);
    } catch (err) {
      console.error(err);
      showToast("Error loading graph data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Pre-seed Demo Data for verification
  const handlePreseedDemo = async () => {
    setLoading(true);
    try {
      showToast("Seeding demo topics & edges...");
      
      const demoNodes = [
        // OS Subject
        { topicId: 'Operating_Systems', subjectId: 'subject_os', unitId: 'unit_os_1', difficulty: 'Medium', estimatedTime: 60, learningObjectives: ["Understand OS roles", "Hardware abstractions"] },
        { topicId: 'Process_Management', subjectId: 'subject_os', unitId: 'unit_os_1', difficulty: 'Medium', estimatedTime: 45, learningObjectives: ["Process states", "Context switching"] },
        { topicId: 'Threads', subjectId: 'subject_os', unitId: 'unit_os_1', difficulty: 'Easy', estimatedTime: 30, learningObjectives: ["Threads vs Processes", "Multi-threading models"] },
        { topicId: 'Synchronization', subjectId: 'subject_os', unitId: 'unit_os_2', difficulty: 'Hard', estimatedTime: 90, learningObjectives: ["Race conditions", "Semaphores and Mutexes"] },
        { topicId: 'Critical_Section', subjectId: 'subject_os', unitId: 'unit_os_2', difficulty: 'Hard', estimatedTime: 60, learningObjectives: ["Mutual exclusion rules", "Peterson's algorithm"] },
        { topicId: 'Deadlocks', subjectId: 'subject_os', unitId: 'unit_os_2', difficulty: 'Hard', estimatedTime: 75, learningObjectives: ["Four deadlock conditions", "Resource allocation graphs"] },
        { topicId: 'Bankers_Algorithm', subjectId: 'subject_os', unitId: 'unit_os_2', difficulty: 'Hard', estimatedTime: 90, learningObjectives: ["Avoidance techniques", "Safe vs Unsafe states"] },
        
        // Mathematics
        { topicId: 'Arithmetic', subjectId: 'subject_maths', unitId: 'unit_maths_1', difficulty: 'Easy', estimatedTime: 40 },
        { topicId: 'Percentage', subjectId: 'subject_maths', unitId: 'unit_maths_1', difficulty: 'Easy', estimatedTime: 50 },
        { topicId: 'Ratio', subjectId: 'subject_maths', unitId: 'unit_maths_1', difficulty: 'Easy', estimatedTime: 45 },
        { topicId: 'Profit_Loss', subjectId: 'subject_maths', unitId: 'unit_maths_2', difficulty: 'Medium', estimatedTime: 60 },

        // OOP
        { topicId: 'Classes_Objects', subjectId: 'subject_oop', unitId: 'unit_oop_1', difficulty: 'Easy', estimatedTime: 30 },
        { topicId: 'OOP_Basics', subjectId: 'subject_oop', unitId: 'unit_oop_1', difficulty: 'Easy', estimatedTime: 45 },
        { topicId: 'Inheritance', subjectId: 'subject_oop', unitId: 'unit_oop_2', difficulty: 'Medium', estimatedTime: 60 }
      ];

      const demoEdges = [
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
        { fromId: 'Ratio', toId: 'Profit_Loss', type: 'prerequisite' },

        // OOP Edges
        { fromId: 'Classes_Objects', toId: 'OOP_Basics', type: 'prerequisite' },
        { fromId: 'OOP_Basics', toId: 'Inheritance', type: 'prerequisite' }
      ];

      // Save nodes
      for (const node of demoNodes) {
        await learningGraphService.saveNode(node);
      }

      // Save edges
      for (const edge of demoEdges) {
        await learningGraphService.saveEdge(edge.fromId, edge.toId, edge.type);
      }

      showToast("Demo learning graph pre-seeded successfully!");
      loadData();
    } catch (err) {
      console.error(err);
      showToast("Pre-seed failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Node operations
  const handleSaveNode = async (e) => {
    e.preventDefault();
    if (!nodeForm.topicId) {
      showToast("Please enter a Topic ID");
      return;
    }
    setLoading(true);
    try {
      const data = {
        ...nodeForm,
        learningObjectives: nodeForm.learningObjectives
          ? nodeForm.learningObjectives.split(',').map(s => s.trim()).filter(Boolean)
          : []
      };
      await learningGraphService.saveNode(data);
      showToast("Graph node saved successfully!");
      setNodeForm({
        topicId: '',
        subjectId: '',
        unitId: '',
        difficulty: 'Medium',
        estimatedTime: 30,
        knowledgeObjectId: '',
        learningObjectives: '',
        type: 'topic'
      });
      loadData();
    } catch (err) {
      showToast("Failed to save node: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNode = async (topicId) => {
    if (!window.confirm(`Are you sure you want to delete node "${topicId}"? This will also remove any of its connected relationships.`)) {
      return;
    }
    setLoading(true);
    try {
      await learningGraphService.deleteNode(topicId);
      showToast(`Node "${topicId}" and relationships deleted.`);
      loadData();
    } catch (err) {
      showToast("Failed to delete node: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditNode = (node) => {
    setNodeForm({
      topicId: node.topicId,
      subjectId: node.subjectId || '',
      unitId: node.unitId || '',
      difficulty: node.difficulty || 'Medium',
      estimatedTime: node.estimatedTime || 30,
      knowledgeObjectId: node.knowledgeObjectId || '',
      learningObjectives: node.learningObjectives ? node.learningObjectives.join(', ') : '',
      type: node.type || 'topic'
    });
    setActiveTab('nodes');
    showToast(`Loaded node "${node.topicId}" for editing.`);
  };

  // Edge operations
  const handleSaveEdge = async (e) => {
    e.preventDefault();
    const { fromId, toId, type } = edgeForm;
    if (!fromId || !toId) {
      showToast("Please select both Source and Target nodes.");
      return;
    }
    if (fromId === toId) {
      showToast("A node cannot link to itself.");
      return;
    }
    setLoading(true);
    try {
      await learningGraphService.saveEdge(fromId, toId, type);
      showToast("Relationship saved successfully!");
      setEdgeForm({
        fromId: '',
        toId: '',
        type: 'prerequisite'
      });
      loadData();
    } catch (err) {
      showToast("Error saving relationship: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEdge = async (fromId, toId, type) => {
    if (!window.confirm(`Delete relationship ${fromId} -(${type})-> ${toId}?`)) {
      return;
    }
    setLoading(true);
    try {
      await learningGraphService.deleteEdge(fromId, toId, type);
      showToast("Relationship deleted successfully.");
      loadData();
    } catch (err) {
      showToast("Failed to delete: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Path Simulator Playground handlers
  const handleToggleComplete = (topicId) => {
    setSimCompleted(prev => ({
      ...prev,
      [topicId]: !prev[topicId]
    }));
  };

  const handleScoreChange = (topicId, score) => {
    setSimPerformance(prev => ({
      ...prev,
      [topicId]: { score: Number(score), status: Number(score) < 60 ? 'struggling' : 'mastered' }
    }));
  };

  const handleSimulate = async () => {
    if (!simTarget) {
      showToast("Please select a target topic to simulate!");
      return;
    }

    const progressMap = {};
    Object.keys(simCompleted).forEach(id => {
      if (simCompleted[id]) {
        progressMap[id] = { completed: true, lastStudied: new Date().toISOString() };
      }
    });

    try {
      setLoading(true);
      const targetNode = nodes.find(n => n.topicId === simTarget);
      if (!targetNode) return;

      const subId = targetNode.subjectId || 'default';
      const pathData = await learningGraphService.generatePersonalizedPath(
        'mock_student_1',
        subId,
        progressMap,
        simPerformance
      );
      
      // Calculate active learning context fallback
      // Check if target has incomplete prerequisites
      const directPrereqs = edges.filter(e => e.toId === simTarget && e.type === 'prerequisite');
      const incompletePrereqs = directPrereqs.filter(e => !progressMap[e.fromId]?.completed);
      
      setSimulationResult({
        ...pathData,
        incompletePrereqs: incompletePrereqs.map(p => p.fromId),
        directPrereqs: directPrereqs.map(p => p.fromId)
      });
      showToast("Personalized learning paths simulated!");
    } catch (err) {
      showToast("Simulation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtered lists
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => 
      node.topicId.toLowerCase().includes(nodeSearch.toLowerCase()) ||
      (node.subjectId || '').toLowerCase().includes(nodeSearch.toLowerCase()) ||
      (node.unitId || '').toLowerCase().includes(nodeSearch.toLowerCase())
    );
  }, [nodes, nodeSearch]);

  const filteredEdges = useMemo(() => {
    return edges.filter(edge => 
      edge.fromId.toLowerCase().includes(edgeSearch.toLowerCase()) ||
      edge.toId.toLowerCase().includes(edgeSearch.toLowerCase()) ||
      edge.type.toLowerCase().includes(edgeSearch.toLowerCase())
    );
  }, [edges, edgeSearch]);

  return (
    <div className="space-y-6">
      
      {/* Title & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
            <GitCommit className="w-6 h-6 text-indigo-500 animate-pulse" />
            HyperBrain Learning Graph Engine
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Build and optimize the semantic prerequisite connections, cycles validation, and adaptive paths.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 overflow-x-auto">
          {[
            { id: 'diagnostics', label: 'Diagnostics & Audit', icon: Activity },
            { id: 'nodes', label: 'Nodes Manager', icon: Layers },
            { id: 'edges', label: 'Relationship Builder', icon: GitCommit },
            { id: 'playground', label: 'Adaptive Path Simulator', icon: Compass }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  active 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4 flex items-center justify-center space-x-2.5 text-indigo-400 text-xs font-bold animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Synchronizing graph state...</span>
        </div>
      )}

      {/* DIAGNOSTICS & AUDIT TAB */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          
          {/* Quick Statistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-slate-900 border-slate-800 p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">Nodes/Topics</p>
                <h3 className="text-2xl font-black text-slate-100 mt-1">{nodes.length}</h3>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <Layers className="w-5 h-5" />
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">Relationships/Edges</p>
                <h3 className="text-2xl font-black text-slate-100 mt-1">{edges.length}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
                <GitCommit className="w-5 h-5" />
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">Integrity Warnings</p>
                <h3 className="text-2xl font-black text-slate-100 mt-1">
                  {diagnostics ? diagnostics.warnings.length + diagnostics.errors.length : 0}
                </h3>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </Card>
          </div>

          {/* Audit Results Board */}
          <Card className="bg-slate-900 border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <Activity className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Structural Diagnostic Report</h3>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Automated validation runs check for orphans, loops, and index timings.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePreseedDemo}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl active:scale-95 transition-all border border-slate-700 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Seed Demo Graph</span>
                </button>
                <button
                  onClick={loadData}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl active:scale-95 transition-all flex items-center"
                  title="Run Audit Sync"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                </button>
              </div>
            </div>

            {diagnostics ? (
              <div className="space-y-5">
                
                {/* Visual Status Indicator */}
                <div className={`p-4 rounded-xl border flex items-center space-x-3.5 ${
                  diagnostics.success 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {diagnostics.success ? (
                    <CheckCircle2 className="w-8 h-8 flex-shrink-0 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-8 h-8 flex-shrink-0 text-red-400 animate-bounce" />
                  )}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">
                      {diagnostics.success ? 'Graph Structure Verified: CLEAN' : 'Integrity Failures Detected'}
                    </h4>
                    <p className="text-[10px] font-semibold opacity-90 leading-relaxed mt-0.5">
                      {diagnostics.success 
                        ? 'No circular prerequisite chains detected. Traversals are valid and optimal.'
                        : 'Action required: Prerequisite cycle loops block topological path generation. Resolve immediately.'}
                    </p>
                  </div>
                </div>

                {/* Audit Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
                  
                  {/* Prerequisite Cycles Test */}
                  <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500 tracking-wider font-black">Prerequisite Cycles</div>
                      <p className="text-[10px] font-semibold text-slate-400 mt-1 leading-relaxed">Verifies that prerequisite dependencies form a true DAG with no cyclic lockouts.</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                      <span className="text-[10px] text-slate-500">Status</span>
                      {diagnostics.errors.length === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PASS</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">FAIL</span>
                      )}
                    </div>
                  </div>

                  {/* Orphan Nodes Test */}
                  <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500 tracking-wider font-black">Isolated Nodes</div>
                      <p className="text-[10px] font-semibold text-slate-400 mt-1 leading-relaxed">Identifies nodes with no prerequisites, dependent topics, or related references.</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                      <span className="text-[10px] text-slate-500">Count</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        diagnostics.orphanNodes.length === 0 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>{diagnostics.orphanNodes.length} Orphans</span>
                    </div>
                  </div>

                  {/* Traversals Speed Test */}
                  <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500 tracking-wider font-black">Query Traversals Speed</div>
                      <p className="text-[10px] font-semibold text-slate-400 mt-1 leading-relaxed">In-memory caching verification ensures high-speed sub-millisecond query results.</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                      <span className="text-[10px] text-slate-500">Latency</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {diagnostics.performance?.auditDurationMs ?? 0} ms
                      </span>
                    </div>
                  </div>

                </div>

                {/* Listing Warnings and Errors */}
                {(diagnostics.errors.length > 0 || diagnostics.warnings.length > 0) && (
                  <div className="space-y-3 bg-slate-950/20 border border-slate-800 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-slate-300">Detailed Action Items</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {diagnostics.errors.map((err, i) => (
                        <div key={i} className="flex items-start space-x-2 text-[10px] font-semibold text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>{err}</span>
                        </div>
                      ))}
                      {diagnostics.warnings.map((warn, i) => (
                        <div key={i} className="flex items-start space-x-2 text-[10px] font-semibold text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs font-bold">
                Run Diagnostic Audit to check structural health.
              </div>
            )}
          </Card>

        </div>
      )}

      {/* NODES MANAGER TAB */}
      {activeTab === 'nodes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Node Creation Form */}
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 lg:col-span-1 h-fit">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2">
              Save Graph Node
            </h3>

            <form onSubmit={handleSaveNode} className="space-y-3">
              <Input
                label="Topic ID (Unique Slug)"
                type="text"
                required
                value={nodeForm.topicId}
                onChange={e => setNodeForm({...nodeForm, topicId: e.target.value.replace(/\s+/g, '_')})}
                placeholder="e.g. Deadlocks"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Subject ID"
                  type="text"
                  value={nodeForm.subjectId}
                  onChange={e => setNodeForm({...nodeForm, subjectId: e.target.value})}
                  placeholder="subject_os"
                />
                <Input
                  label="Unit ID"
                  type="text"
                  value={nodeForm.unitId}
                  onChange={e => setNodeForm({...nodeForm, unitId: e.target.value})}
                  placeholder="unit_os_2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Difficulty</label>
                  <select
                    value={nodeForm.difficulty}
                    onChange={e => setNodeForm({...nodeForm, difficulty: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                
                <Input
                  label="Study Time (Mins)"
                  type="number"
                  value={nodeForm.estimatedTime}
                  onChange={e => setNodeForm({...nodeForm, estimatedTime: Number(e.target.value)})}
                />
              </div>

              <Input
                label="Knowledge Object ID"
                type="text"
                value={nodeForm.knowledgeObjectId}
                onChange={e => setNodeForm({...nodeForm, knowledgeObjectId: e.target.value})}
                placeholder="resource_link_or_id"
              />

              <Input
                label="Learning Objectives (Comma separated)"
                type="text"
                value={nodeForm.learningObjectives}
                onChange={e => setNodeForm({...nodeForm, learningObjectives: e.target.value})}
                placeholder="Conditions, banker, cycles"
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-2 rounded-xl"
                >
                  Save Node Record
                </Button>
              </div>
            </form>
          </Card>

          {/* Nodes Registry List */}
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">Nodes Registry</h3>
                <p className="text-[10px] font-semibold text-slate-500">Currently active vertices inside the engine.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search nodes slug..."
                  value={nodeSearch}
                  onChange={e => setNodeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5">Topic ID</th>
                    <th className="py-2.5">Subject / Unit</th>
                    <th className="py-2.5 text-center">Difficulty</th>
                    <th className="py-2.5 text-center">Est. Time</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredNodes.length > 0 ? (
                    filteredNodes.map(node => (
                      <tr key={node.topicId} className="hover:bg-slate-800/20 group transition-colors">
                        <td className="py-3 text-slate-200 font-black">{node.topicId}</td>
                        <td className="py-3 text-slate-400">
                          <div>{node.subjectId || '-'}</div>
                          <div className="text-[9px] text-slate-600 font-semibold">{node.unitId || '-'}</div>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] ${
                            node.difficulty === 'Easy' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : node.difficulty === 'Hard'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {node.difficulty}
                          </span>
                        </td>
                        <td className="py-3 text-center text-slate-400">
                          <span className="flex items-center justify-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {node.estimatedTime || 30}m
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditNode(node)}
                              className="px-2.5 py-1 hover:bg-slate-800 hover:text-slate-100 rounded text-[10px] text-indigo-400 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteNode(node.topicId)}
                              className="p-1 hover:bg-red-500/10 text-red-400 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-6 text-slate-500">
                        No nodes matched search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      )}

      {/* RELATIONSHIP BUILDER TAB */}
      {activeTab === 'edges' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Edge Builder Form */}
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 lg:col-span-1 h-fit">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2">
              Connect Nodes
            </h3>

            <form onSubmit={handleSaveEdge} className="space-y-4">
              
              {/* Source node */}
              <div className="text-xs font-bold">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Source Node</label>
                <select
                  value={edgeForm.fromId}
                  onChange={e => setEdgeForm({...edgeForm, fromId: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                  required
                >
                  <option value="">-- Choose Source --</option>
                  {nodes.map(n => (
                    <option key={n.topicId} value={n.topicId}>{n.topicId} ({n.subjectId})</option>
                  ))}
                </select>
              </div>

              {/* Relationship Type */}
              <div className="text-xs font-bold">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Relationship Type</label>
                <select
                  value={edgeForm.type}
                  onChange={e => setEdgeForm({...edgeForm, type: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                  required
                >
                  {relationshipTypes.map(rel => (
                    <option key={rel.value} value={rel.value}>{rel.label}</option>
                  ))}
                </select>
              </div>

              {/* Target node */}
              <div className="text-xs font-bold">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Target Node</label>
                <select
                  value={edgeForm.toId}
                  onChange={e => setEdgeForm({...edgeForm, toId: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                  required
                >
                  <option value="">-- Choose Target --</option>
                  {nodes.map(n => (
                    <option key={n.topicId} value={n.topicId}>{n.topicId} ({n.subjectId})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-2 rounded-xl"
                >
                  Create Edge Link
                </Button>
              </div>
            </form>
          </Card>

          {/* Relationship list */}
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">Edges & Linkages</h3>
                <p className="text-[10px] font-semibold text-slate-500">Currently active semantic relationships inside the graph.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search edge node or type..."
                  value={edgeSearch}
                  onChange={e => setEdgeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5">Source Node</th>
                    <th className="py-2.5 text-center">Relationship Type</th>
                    <th className="py-2.5">Target Node</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredEdges.length > 0 ? (
                    filteredEdges.map(edge => (
                      <tr key={edge.id || `${edge.fromId}-${edge.toId}-${edge.type}`} className="hover:bg-slate-800/20 group transition-colors">
                        <td className="py-3 text-slate-200 font-black">{edge.fromId}</td>
                        <td className="py-3 text-center text-indigo-400 text-[10px]">
                          <span className="px-2 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/10">
                            {edge.type}
                          </span>
                        </td>
                        <td className="py-3 text-slate-200 font-black">{edge.toId}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDeleteEdge(edge.fromId, edge.toId, edge.type)}
                            className="p-1 hover:bg-red-500/10 text-red-400 rounded opacity-60 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-6 text-slate-500">
                        No relationships found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      )}

      {/* ADAPTIVE PATH SIMULATOR PLAYGROUND */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Simulator Inputs Form */}
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 lg:col-span-1 h-fit">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2">
              Simulation Controller
            </h3>

            <div className="space-y-4 text-xs font-bold">
              
              {/* Select Target Topic */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Target Topic / Goal</label>
                <select
                  value={simTarget}
                  onChange={e => setSimTarget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="">-- Choose Target --</option>
                  {nodes.map(n => (
                    <option key={n.topicId} value={n.topicId}>{n.topicId} ({n.subjectId})</option>
                  ))}
                </select>
              </div>

              {/* Mock Student Progress Checkboxes */}
              {nodes.length > 0 && (
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400">Mock Completed Topics</label>
                  <p className="text-[9px] text-slate-500 font-semibold mb-1">Mark which topics the mock student has completed.</p>
                  
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-950 bg-slate-950/40 p-3.5 rounded-xl">
                    {nodes.map(n => (
                      <label key={n.topicId} className="flex items-center space-x-2 text-[10px] font-semibold text-slate-300 hover:text-slate-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!simCompleted[n.topicId]}
                          onChange={() => handleToggleComplete(n.topicId)}
                          className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{n.topicId}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Mock Scores for completed topics */}
              {Object.keys(simCompleted).filter(k => simCompleted[k]).length > 0 && (
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400">Mock Performance scores</label>
                  <p className="text-[9px] text-slate-500 font-semibold mb-1">Specify scores to test Weak Topic logic (&lt;60% triggers weak recommendation).</p>
                  
                  <div className="max-h-40 overflow-y-auto space-y-2 border border-slate-950 bg-slate-950/40 p-3 rounded-xl">
                    {Object.keys(simCompleted).filter(k => simCompleted[k]).map(topicId => (
                      <div key={topicId} className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-300 font-semibold">{topicId}</span>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={simPerformance[topicId]?.score ?? 85}
                            onChange={e => handleScoreChange(topicId, e.target.value)}
                            className="w-14 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200 text-center font-bold"
                          />
                          <span className="text-[9px] text-slate-500">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button
                  onClick={handleSimulate}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-2 rounded-xl flex items-center justify-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Simulate Recommendations</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* Simulator Outcomes Panel */}
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-5 lg:col-span-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-indigo-400" />
              Simulation Path Output
            </h3>

            {simulationResult ? (
              <div className="space-y-6">
                
                {/* 1. Recommended Next Topic */}
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-[9px] uppercase tracking-wider font-black text-slate-500 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                    Recommended Next Topic
                  </div>
                  {simulationResult.recommendedNext ? (
                    <div>
                      <h4 className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                        {simulationResult.recommendedNext.topicId}
                        <span className={`inline-block px-1.5 py-0.2 rounded text-[8px] ${
                          simulationResult.recommendedNext.difficulty === 'Easy' 
                            ? 'bg-emerald-500/10 text-emerald-400' 
                            : simulationResult.recommendedNext.difficulty === 'Hard'
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-blue-500/10 text-blue-400'
                        }`}>{simulationResult.recommendedNext.difficulty}</span>
                      </h4>
                      <p className="text-[9px] font-semibold text-slate-500 mt-1">
                        Est. study time: {simulationResult.recommendedNext.estimatedTime || 30} mins. 
                        Subject ID: {simulationResult.recommendedNext.subjectId}
                      </p>

                      {/* Adaptive Alert Trigger */}
                      {simulationResult.incompletePrereqs.length > 0 && (
                        <div className="mt-2.5 p-2 bg-amber-500/5 border border-amber-500/15 rounded-lg flex items-start space-x-2 text-[9px] font-semibold text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Adaptive Alert:</span> student is struggling or incomplete with prerequisite(s):{' '}
                            <span className="underline font-bold">{simulationResult.incompletePrereqs.join(', ')}</span>. 
                            Recommending to study prerequisites first!
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 italic">No recommendations available (Student has completed all topics in subject).</div>
                  )}
                </div>

                {/* 2. Today's Learning Path */}
                <div className="space-y-2.5">
                  <div className="text-[9px] uppercase tracking-wider font-black text-slate-500">Today's Learning Path (Topologically Sorted)</div>
                  {simulationResult.todaysPath.length > 0 ? (
                    <div className="relative border-l border-slate-800 ml-2.5 pl-4 space-y-3.5">
                      {simulationResult.todaysPath.map((item, idx) => (
                        <div key={item.topicId} className="relative">
                          {/* Dot marker */}
                          <div className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border ${
                            item.status === 'completed' 
                              ? 'bg-emerald-500 border-emerald-600' 
                              : item.status === 'ready_to_study'
                                ? 'bg-amber-500 border-amber-600 animate-pulse'
                                : 'bg-slate-800 border-slate-700'
                          }`} />
                          
                          <div className="flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-200">{item.topicId}</span>
                              <span className="text-[9px] text-slate-500 ml-2 font-semibold">Step {idx + 1}</span>
                            </div>
                            <span className={`inline-block px-2 py-0.2 rounded-full text-[8px] uppercase tracking-wider font-bold ${
                              item.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : item.status === 'ready_to_study'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                                  : 'bg-slate-950 text-slate-600 border border-slate-850'
                            }`}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 italic">No custom learning path created. Select a target topic.</div>
                  )}
                </div>

                {/* 3. Weak Topic Path */}
                <div className="space-y-2">
                  <div className="text-[9px] uppercase tracking-wider font-black text-slate-500">Weak Topics Prerequisite Path</div>
                  {simulationResult.weakTopicPath.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-bold">
                      {simulationResult.weakTopicPath.map(item => (
                        <div key={item.topicId} className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg flex items-center justify-between">
                          <div>
                            <div className="text-slate-200">{item.topicId}</div>
                            <div className="text-[9px] text-slate-500 font-semibold mt-0.5">Prerequisite to Master</div>
                          </div>
                          <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded font-black text-[9px]">
                            {item.score}% Score
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>All prerequisite scores are healthy! No weak topic paths found.</span>
                    </div>
                  )}
                </div>

                {/* 4. Revision Order & Exam Priority Path */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-[10px] font-bold">
                  
                  {/* Revision Order */}
                  <div className="space-y-2">
                    <div className="text-[9px] uppercase tracking-wider font-black text-slate-500">Revision Priority Order</div>
                    <div className="space-y-1.5">
                      {simulationResult.revisionOrder.length > 0 ? (
                        simulationResult.revisionOrder.map((item, index) => (
                          <div key={item.topicId} className="flex items-center justify-between p-2 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                            <span className="text-slate-300 font-semibold">{index + 1}. {item.topicId}</span>
                            <span className="text-amber-400 font-bold text-[9px]">Score: {item.score}%</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[9px] text-slate-500 italic">No revision topics yet. Complete more topics first.</div>
                      )}
                    </div>
                  </div>

                  {/* Exam Priority Path */}
                  <div className="space-y-2">
                    <div className="text-[9px] uppercase tracking-wider font-black text-slate-500">Exam Priority Path (Uncompleted)</div>
                    <div className="space-y-1.5">
                      {simulationResult.examPriorityPath.length > 0 ? (
                        simulationResult.examPriorityPath.slice(0, 4).map((item, index) => (
                          <div key={item.topicId} className="flex items-center justify-between p-2 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                            <span className="text-slate-300 font-semibold">{index + 1}. {item.topicId}</span>
                            <span className="text-slate-400 text-[9px]">{item.difficulty} • {item.estimatedTime || 30}m</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[9px] text-emerald-400 italic">All topics in subject are fully mastered! Ready for exam.</div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs font-bold border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center space-y-2">
                <Compass className="w-10 h-10 text-slate-700 animate-spin-slow" />
                <span>Configure student attributes on the left and run recommendation simulation.</span>
              </div>
            )}
          </Card>

        </div>
      )}

    </div>
  );
}
