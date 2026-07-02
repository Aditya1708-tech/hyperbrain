import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import Sidebar from '../../components/layout/Sidebar';
import { ThemeContext } from '../../contexts/ThemeContext';
import { Award, Sparkles, CheckCircle2, ChevronRight, Menu, Sun, Moon } from 'lucide-react';
import Card from '../../components/common/Card';
import TutorDrawer from '../../components/tutor/TutorDrawer';
import { analyticsService } from '../../services/firebase/firestoreService';

export default function MockExamSetupScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  
  // Selection states
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [marks, setMarks] = useState(70);
  const [difficulty, setDifficulty] = useState("Mixed");
  const [toastMessage, setToastMessage] = useState('');

  // Exam blueprints configuration
  const blueprints = {
    20: {
      name: "Short Assessment",
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 5, marksPerQuest: 1, total: 5 },
        { name: "Section B (Short Answer)", type: "theory", count: 3, marksPerQuest: 5, total: 15 }
      ]
    },
    30: {
      name: "Continuous Evaluation Test",
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 5, marksPerQuest: 1, total: 5 },
        { name: "Section B (Short Answer)", type: "theory", count: 5, marksPerQuest: 3, total: 15 },
        { name: "Section C (Long Answer)", type: "theory", count: 2, marksPerQuest: 5, total: 10 }
      ]
    },
    50: {
      name: "Mid Term Examination",
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 10, marksPerQuest: 1, total: 10 },
        { name: "Section B (Short Answer)", type: "theory", count: 5, marksPerQuest: 4, total: 20 },
        { name: "Section C (Long Answer)", type: "theory", count: 2, marksPerQuest: 10, total: 20 }
      ]
    },
    70: {
      name: "University Term-End Standard",
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 10, marksPerQuest: 1, total: 10 },
        { name: "Section B (Short Answer)", type: "theory", count: 4, marksPerQuest: 5, total: 20 },
        { name: "Section C (Long Answer)", type: "theory", count: 2, marksPerQuest: 10, total: 20 },
        { name: "Section D (Case Study)", type: "theory", count: 1, marksPerQuest: 20, total: 20 }
      ]
    },
    100: {
      name: "Full Term-End Examination",
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 20, marksPerQuest: 1, total: 20 },
        { name: "Section B (Short Answer)", type: "theory", count: 10, marksPerQuest: 3, total: 30 },
        { name: "Section C (Long Answer)", type: "theory", count: 5, marksPerQuest: 10, total: 50 }
      ]
    }
  };

  // Load courses
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      if (db) {
        const subjectsRef = collection(db, 'users', user.uid, 'subjects');
        const q = query(subjectsRef, orderBy('createdAt', 'desc'));
        const unsubFirestore = onSnapshot(q, (snapshot) => {
          const fetched = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));
          setCourses(fetched);
          if (fetched.length > 0) {
            setSelectedCourse(fetched[0]);
            setSelectedTopics(fetched[0].topics || []);
          }
        }, (err) => {
          const local = JSON.parse(localStorage.getItem(`courses_${user.uid}`) || '[]');
          setCourses(local);
          if (local.length > 0) {
            setSelectedCourse(local[0]);
            setSelectedTopics(local[0].topics || []);
          }
        });
        return () => unsubFirestore();
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleCourseChange = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourse(course);
      setSelectedTopics(course.topics || []);
    }
  };

  const toggleTopic = (topicTitle) => {
    const topic = selectedCourse?.topics?.find(t => t.title === topicTitle);
    if (!topic) return;
    
    if (selectedTopics.some(t => t.title === topicTitle)) {
      setSelectedTopics(prev => prev.filter(t => t.title !== topicTitle));
    } else {
      setSelectedTopics(prev => [...prev, topic]);
    }
  };

  const handleSelectAllTopics = () => {
    if (selectedCourse) {
      setSelectedTopics(selectedCourse.topics || []);
    }
  };

  const handleDeselectAllTopics = () => {
    setSelectedTopics([]);
  };

  const handleGenerate = () => {
    if (!selectedCourse) {
      setToastMessage("Please select a course first.");
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }
    if (selectedTopics.length === 0) {
      setToastMessage("Please select at least one syllabus topic.");
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    analyticsService.logExamGenerated(selectedCourse.subject_name, marks, difficulty);

    // Navigate to exam screen with location state config
    navigate(`/exam/${encodeURIComponent(selectedCourse.subject_name)}`, {
      state: {
        selectedTopics,
        marks,
        difficulty,
        subjectId: selectedCourse.id,
        autoTrigger: true
      }
    });
  };

  const activeBlueprint = blueprints[marks] || blueprints[70];

  return (
    <div className="h-screen w-screen bg-bg-secondary text-primary flex flex-col overflow-hidden transition-colors duration-300">
      
      {/* APP HEADER */}
      <header className="h-16 border-b border-border-theme bg-card flex items-center justify-between px-6 flex-shrink-0 z-10 transition-colors">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-hover-theme rounded-lg text-slate-655 dark:text-slate-400"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2.5">
            <Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-bold tracking-tight font-sans">University Mock Exams</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-hover-theme rounded-lg text-slate-655 dark:text-slate-400"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsChatOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Open AI Tutor Drawer"
          >
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>AI Tutor</span>
          </button>
        </div>
      </header>

      {/* BODY LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <div className={`transition-all duration-250 overflow-hidden flex-shrink-0 h-full ${
          isSidebarOpen ? 'w-[280px]' : 'w-0'
        }`}>
          <Sidebar 
            selectedSubjectId={selectedCourse?.id}
            onSelectSubject={(id, course) => handleCourseChange(course.id)}
            isCollapsed={!isSidebarOpen}
          />
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-bg-secondary transition-colors duration-300">
          
          <div className="pb-4 border-b border-border-theme">
            <h1 className="text-xl font-bold text-primary tracking-tight">
              Exam Generator Wizard
            </h1>
            <p className="text-xs text-muted mt-1 font-semibold">
              Create university-standard customized question papers based on specific syllabus modules.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* LEFT / CENTER PANEL: Setup Options */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Step 1 & 2: Course & Topics */}
              <Card className="bg-card border border-border-theme rounded-xl p-6 space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">
                  1. Select Syllabus Coverage
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Select Course</label>
                    <select
                      value={selectedCourse?.id || ''}
                      onChange={(e) => handleCourseChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-bg-secondary border border-border-theme rounded-xl text-xs font-semibold focus-ring"
                    >
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.subject_name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedCourse && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-muted uppercase tracking-wider">Select Topics ({selectedTopics.length} selected)</label>
                        <div className="flex space-x-2 text-[10px] font-bold">
                          <button onClick={handleSelectAllTopics} className="text-blue-600 hover:underline">Select All</button>
                          <span className="text-slate-300">|</span>
                          <button onClick={handleDeselectAllTopics} className="text-slate-400 hover:underline">Deselect All</button>
                        </div>
                      </div>
                      
                      <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-3 bg-bg-secondary max-h-56 overflow-y-auto space-y-2 custom-scrollbar">
                        {selectedCourse.topics?.map((topic, index) => {
                          const isChecked = selectedTopics.some(t => t.title === topic.title);
                          return (
                            <label key={index} className="flex items-center space-x-3 text-xs font-semibold text-primary cursor-pointer select-none group">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleTopic(topic.title)}
                                className="rounded border-border-theme text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                              />
                              <span className="group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{topic.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Step 3 & 4: Marks and Difficulty */}
              <Card className="bg-card border border-border-theme rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">
                    2. Configure Parameters
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2.5">Total Marks Target</label>
                    <div className="flex flex-wrap gap-2">
                      {[20, 30, 50, 70, 100].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setMarks(val)}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                            marks === val 
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-bg-secondary border border-border-theme text-muted hover:bg-slate-200'
                          }`}
                        >
                          {val} Marks
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2.5">Difficulty Profile</label>
                    <div className="flex flex-wrap gap-2">
                      {["Easy", "Medium", "Hard", "Mixed"].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setDifficulty(val)}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                            difficulty === val 
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-bg-secondary border border-border-theme text-muted hover:bg-slate-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

            </div>

            {/* RIGHT PANEL: Blueprint Review */}
            <div className="space-y-6">
              
              <Card className="bg-card border border-border-theme rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2 border-b border-border-theme pb-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest">
                    Blueprint Preview
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Blueprint Type</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{activeBlueprint.name}</span>
                  </div>
                  
                  <div className="border border-border-theme rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-bg-secondary text-muted font-bold border-b border-border-theme">
                          <th className="p-2">Section</th>
                          <th className="p-2 text-center">Items</th>
                          <th className="p-2 text-right">Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-semibold text-muted">
                        {activeBlueprint.sections.map((sec, i) => (
                          <tr key={i}>
                            <td className="p-2 truncate max-w-[120px]">{sec.name}</td>
                            <td className="p-2 text-center">{sec.count} × {sec.marksPerQuest}</td>
                            <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">{sec.total}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50/50 dark:bg-slate-900/30 font-bold text-primary">
                          <td className="p-2">Total Exam Value</td>
                          <td className="p-2"></td>
                          <td className="p-2 text-right text-blue-600 dark:text-blue-400 font-black">{marks} Marks</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3.5 bg-blue-50/50 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-800 rounded-xl space-y-1">
                    <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Blueprint Validation</h4>
                    <p className="text-[10px] text-muted leading-relaxed font-semibold">
                      This blueprint is university-standard. No arbitrary mark offsets. The generation bounds question templates strictly to the {selectedTopics.length} selected topics.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>GENERATE PAPER Blueprint</span>
                </button>
              </Card>

            </div>

          </div>

        </div>

      </div>

      {/* AI Tutor Drawer slide-over */}
      <TutorDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        currentCourse={selectedCourse}
        currentTopic={null}
      />

      {/* Floating Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-card border border-border-theme px-5 py-3.5 rounded-2xl shadow-xl z-50 flex items-center space-x-3 text-xs font-bold text-primary transition-all duration-300 transform translate-y-0 opacity-100">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
