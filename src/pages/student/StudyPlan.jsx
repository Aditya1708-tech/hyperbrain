import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import Sidebar from '../../components/layout/Sidebar';
import { ThemeContext } from '../../contexts/ThemeContext';
import { FileText, Calendar, Clock, Sparkles, CheckCircle2, Menu, Sun, Moon, Loader2, ShieldAlert } from 'lucide-react';
import Card from '../../components/common/Card';
import { userService } from '../../services/firebase/userService';
import aiService from "@/services/aiService";

export default function StudyPlanScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (window.innerWidth < 768) return false;
    return localStorage.getItem('sidebar_state') !== 'collapsed';
  });
  const [courses, setCourses] = useState([]);
  
  // Selection states
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [examDate, setExamDate] = useState("");
  const [studyHours, setStudyHours] = useState(4);
  
  // Roadmap states
  const [roadmap, setRoadmap] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const generatingRef = useRef(false);

  // Usage limit states
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [countdown, setCountdown] = useState('');

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar_state', isSidebarOpen ? 'expanded' : 'collapsed');
  }, [isSidebarOpen]);

  // Close mobile sidebar on navigate
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  // Countdown timer effect
  useEffect(() => {
    if (!isLimitReached) return;
    const interval = setInterval(() => {
      setCountdown(userService.getTimeUntilMidnight().formatted);
    }, 1000);
    setCountdown(userService.getTimeUntilMidnight().formatted);
    return () => clearInterval(interval);
  }, [isLimitReached]);

  // Load courses & restore selections
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
            const savedCourseId = localStorage.getItem('current_course_id');
            let matchedCourse = fetched.find(c => c.id === savedCourseId) || fetched[0];
            setSelectedCourse(matchedCourse);
          }
        }, (err) => {
          const local = JSON.parse(localStorage.getItem(`courses_${user.uid}`) || '[]');
          setCourses(local);
          if (local.length > 0) {
            const savedCourseId = localStorage.getItem('current_course_id');
            let matchedCourse = local.find(c => c.id === savedCourseId) || local[0];
            setSelectedCourse(matchedCourse);
          }
        });
        return () => unsubFirestore();
      }
    });
    return () => unsub();
  }, [navigate]);

  // Load existing study plan if any
  useEffect(() => {
    if (!selectedCourse) return;
    
    const loadPlan = async () => {
      setLoading(true);
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setLoading(false);
        return;
      }

      const docId = `plan_${selectedCourse.id}`;
      
      try {
        const docRef = doc(db, 'users', uid, 'studyPlans', docId);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
          setRoadmap(snap.data().roadmap || []);
          setExamDate(snap.data().examDate || "2026-07-15");
          setStudyHours(snap.data().studyHours || 3);
          setIsLimitReached(false);
        } else {
          setRoadmap([]);
        }
      } catch (err) {
        console.warn("Firestore study plan fetch failed, fallback local:", err);
        const localKey = `sp_${uid}_${docId}`;
        const localData = localStorage.getItem(localKey);
        if (localData) {
          const parsed = JSON.parse(localData);
          setRoadmap(parsed.roadmap || []);
          setExamDate(parsed.examDate || "2026-07-15");
          setStudyHours(parsed.studyHours || 3);
        } else {
          setRoadmap([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [selectedCourse]);

  const handleGenerateRoadmap = async () => {
    if (generatingRef.current) {
      console.log("Skipping duplicate request");
      return;
    }
    generatingRef.current = true;

    if (!selectedCourse) {
      setToastMessage("Please select a course first.");
      setTimeout(() => setToastMessage(''), 3000);
      generatingRef.current = false;
      return;
    }

    setLoading(true);
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      generatingRef.current = false;
      return;
    }

    const topics = selectedCourse.topics || [];
    if (topics.length === 0) {
      setToastMessage("No topics available in this course to map.");
      setTimeout(() => setToastMessage(''), 3000);
      setLoading(false);
      generatingRef.current = false;
      return;
    }

    // Check beta limits
    const check = await userService.checkLimit(uid, 'study_plans');
    if (!check.allowed) {
      setIsLimitReached(true);
      setLoading(false);
      generatingRef.current = false;
      return;
    }

    setIsLimitReached(false);
    const docId = `plan_${selectedCourse.id}`;

    try {
      // Query Gemini study plan generator
      const generatedRoadmap = await aiService.generateStudyPlan(
        selectedCourse.subject_name,
        topics,
        examDate,
        studyHours
      );

      // Add unique IDs to roadmap items
      const identifiedRoadmap = generatedRoadmap.map((item, index) => ({
        id: `plan-day-${index}`,
        ...item
      }));

      const docRef = doc(db, 'users', uid, 'studyPlans', docId);
      await setDoc(docRef, {
        subjectId: selectedCourse.id,
        examDate,
        studyHours,
        roadmap: identifiedRoadmap,
        createdAt: serverTimestamp()
      });

      // Increment usage metrics
      await userService.incrementUsage(uid, 'study_plans');

      setRoadmap(identifiedRoadmap);
      setToastMessage("Study roadmap compiled!");
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.warn("Could not compile study plan, using offline fallback:", err);
      const fallback = topics.map((t, idx) => ({
        id: `plan-day-${idx}`,
        day: `Day ${idx + 1}`,
        topic: t.title,
        tasks: [
          { text: `Review syllabus outline: ${t.title}`, completed: false },
          { text: `Generate flashcards & practice quiz`, completed: false }
        ],
        completed: false
      }));
      setRoadmap(fallback);
    } finally {
      setLoading(false);
      generatingRef.current = false;
    }
  };

  const handleToggleTask = async (dayIndex, taskIndex) => {
    if (roadmap.length === 0) return;
    
    const updated = [...roadmap];
    const task = updated[dayIndex].tasks[taskIndex];
    task.completed = !task.completed;

    // Recalculate day completed status
    updated[dayIndex].completed = updated[dayIndex].tasks.every(t => t.completed);

    setRoadmap(updated);

    // Save back to DB
    const uid = auth.currentUser?.uid;
    if (!uid || !selectedCourse) return;
    const docId = `plan_${selectedCourse.id}`;
    
    try {
      const docRef = doc(db, 'users', uid, 'studyPlans', docId);
      await setDoc(docRef, {
        subjectId: selectedCourse.id,
        examDate,
        studyHours,
        roadmap: updated,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      const localKey = `sp_${uid}_${docId}`;
      const payload = { examDate, studyHours, roadmap: updated };
      localStorage.setItem(localKey, JSON.stringify(payload));
    }
  };

  const handleCourseChange = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourse(course);
      localStorage.setItem('current_course_id', course.id);
    }
  };

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
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-bold tracking-tight font-sans">Syllabus Planner</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-hover-theme rounded-lg text-muted"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* BODY LAYOUT */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* MOBILE SIDEBAR BACKDROP */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9990] transition-opacity md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* LEFT SIDEBAR */}
        <div className={`fixed md:static top-0 left-0 bottom-0 h-full z-[9995] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-card border-r border-border-theme md:border-none ${
          isSidebarOpen ? 'w-[280px] translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'
        }`}>
          <Sidebar 
            selectedSubjectId={selectedCourse?.id}
            onSelectSubject={(id, course) => {
              setIsSidebarOpen(false);
              handleCourseChange(course.id);
            }}
            isCollapsed={!isSidebarOpen}
          />
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-bg-secondary transition-colors duration-300">
          
          <div className="pb-4 border-b border-border-theme">
            <h1 className="text-xl font-bold text-primary tracking-tight">
              Study Scheduler
            </h1>
            <p className="text-xs text-muted mt-1 font-semibold">
              Generate structured, day-by-day learning pathways to prepare for upcoming academic examinations.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* LEFT PANEL: Inputs configuration */}
            <div className="space-y-6">
              
              <Card className="bg-card border border-border-theme rounded-xl p-6 space-y-5">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Configure Schedule</span>
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

                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Exam Target Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-bg-secondary border border-border-theme rounded-xl text-xs font-semibold focus-ring text-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Daily Study hours ({studyHours}h)</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={studyHours}
                      onChange={(e) => setStudyHours(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold pt-1">
                      <span>1 hr</span>
                      <span>5 hrs</span>
                      <span>10 hrs</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerateRoadmap}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-750 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>GENERATE STUDY ROADMAP</span>
                </button>
              </Card>

            </div>

            {/* RIGHT PANEL: Roadmap Timeline view */}
            <div className="lg:col-span-2 space-y-6">
              
              {loading ? (
                <div className="p-8 text-center bg-card rounded-xl border border-border-theme flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="text-xs font-bold text-slate-455">Building study roadmap...</span>
                </div>
              ) : isLimitReached ? (
                <Card className="bg-card border border-red-500/20 p-6 text-center space-y-4 rounded-2xl max-w-sm mx-auto shadow-lg">
                  <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-red-500">You have reached today's beta limit.</h3>
                  <p className="text-xs text-muted leading-relaxed font-semibold">
                    To prevent resource exhaustion during the beta launch, daily limits are enforced. Your quota will reset in:
                  </p>
                  <div className="bg-bg-secondary p-3 rounded-xl border border-border-theme text-sm font-black text-primary font-mono tracking-wider">
                    {countdown}
                  </div>
                </Card>
              ) : roadmap.length === 0 ? (
                <div className="p-8 text-center bg-card rounded-xl border border-dashed border-slate-250 dark:border-slate-800 space-y-3">
                  <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">Configure parameters on the left to compile your study planner roadmap.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-muted uppercase tracking-widest px-1">
                    Study Roadmap Progress
                  </h3>
                  
                  {roadmap.map((node, dayIdx) => (
                    <Card key={node.id} className="bg-card border border-border-theme rounded-xl p-5 space-y-3 transition-colors duration-300">
                      <div className="flex items-center justify-between border-b border-border-theme/80 pb-2">
                        <div>
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block">{node.day}</span>
                          <h4 className="text-sm font-bold text-primary mt-0.5">{node.topic}</h4>
                        </div>
                        {node.completed ? (
                          <span className="text-[9px] font-black bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full select-none">
                            Done
                          </span>
                        ) : (
                          <span className="text-[9px] font-black bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full select-none">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="space-y-2.5 pt-1">
                        {node.tasks.map((task, taskIdx) => (
                          <label key={taskIdx} className="flex items-start space-x-3 text-xs font-semibold text-muted cursor-pointer select-none group">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => handleToggleTask(dayIdx, taskIdx)}
                              className="mt-0.5 rounded border-border-theme text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                            />
                            <span className={`group-hover:text-slate-900 dark:group-hover:text-white transition-colors ${
                              task.completed ? 'line-through opacity-55 text-slate-400' : ''
                            }`}>{task.text}</span>
                          </label>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

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
