import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../services/firebase/firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { 
  BrainCircuit, Menu, MessageSquare, ChevronRight, BookOpen, 
  ArrowLeft, Sun, Moon, Sparkles, Award, Clock,
  Calendar, CheckCircle2, Trash2, Loader2, ArrowUpRight, Bell
} from 'lucide-react';
import Sidebar from '../../components/layout/Sidebar';
import TutorDrawer from '../../components/tutor/TutorDrawer';
import { ThemeContext } from '../../contexts/ThemeContext';
import Card from '../../components/common/Card';
import { notificationService } from '../../services/firebase/firestoreService';

export default function DashboardScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (window.innerWidth < 768) return false;
    return localStorage.getItem('sidebar_state') !== 'collapsed';
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebar_state', isSidebarOpen ? 'expanded' : 'collapsed');
  }, [isSidebarOpen]);

  // Close mobile sidebar on navigate
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Sync user notifications
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const unsubNotifs = notificationService.listenToStudentNotifications(user.uid, (list) => {
          setNotifications(list);
        });
        return () => unsubNotifs();
      }
    });
    return () => unsubAuth();
  }, []);

  const handleMarkAllRead = async () => {
    for (const n of notifications) {
      if (!n.read) {
        await notificationService.markAsRead(n.id);
      }
    }
  };

  const handleMarkSingleRead = async (id) => {
    await notificationService.markAsRead(id);
  };

  // Study tasks checklist state
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Resume active recall module', completed: false },
    { id: 2, text: 'Review 5 smart flashcards', completed: false },
    { id: 3, text: 'Discuss concept gaps with AI Tutor', completed: false },
    { id: 4, text: 'Generate an AI Mock exam', completed: false }
  ]);

  // Authenticate user & sync subjects
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
      } else {
        const local = localStorage.getItem(`courses_${user.uid}`);
        if (local) {
          setCourses(JSON.parse(local));
        }

        if (db) {
          const subjectsRef = collection(db, 'users', user.uid, 'subjects');
          const q = query(subjectsRef, orderBy('createdAt', 'desc'));
          return onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data()
            }));
            setCourses(fetched);
            localStorage.setItem(`courses_${user.uid}`, JSON.stringify(fetched));
          }, (err) => {
            console.warn("Firestore listener failed in dashboard:", err);
          });
        }
      }
    });
    return () => unsub();
  }, [navigate]);

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  // Focus active session
  const getFocusSession = () => {
    if (courses.length > 0) {
      const firstCourse = courses[0];
      if (firstCourse.topics && firstCourse.topics.length > 0) {
        return {
          course: firstCourse,
          topic: firstCourse.topics[0],
          available: true
        };
      }
    }
    return {
      course: null,
      topic: null,
      available: false
    };
  };

  const focusSession = getFocusSession();

  return (
    <div className="h-screen w-screen bg-bg-secondary text-primary flex flex-col overflow-hidden transition-colors duration-300">
      
      {/* APP HEADER */}
      <header className="h-16 border-b border-border-theme bg-card flex items-center justify-between px-6 flex-shrink-0 z-10 transition-colors">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-hover-theme rounded-lg text-muted"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5 text-muted" />
          </button>
          
          <div className="flex items-center space-x-2.5 cursor-pointer">
            <BrainCircuit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight leading-none font-sans">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Hyper</span>
                <span className="text-primary">Brain</span>
              </span>
              <span className="hidden sm:inline text-[9px] font-black uppercase tracking-wider text-muted mt-0.5 leading-none">
                AI-Powered Academic Intelligence
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Notifications bell button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="p-2 hover:bg-hover-theme rounded-lg text-muted relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-muted" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-blue-600 rounded-full border border-card" />
              )}
            </button>
            {showNotifPanel && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-border-theme rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] p-4 space-y-3 z-50 text-xs text-primary transition-all">
                <div className="flex justify-between items-center pb-2.5 border-b border-border-theme">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    Notifications
                  </span>
                  {notifications.some(n => !n.read) && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[9px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                    No notifications
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkSingleRead(n.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          n.read
                            ? 'bg-transparent border-transparent hover:bg-bg-secondary'
                            : 'bg-blue-600/5 border-blue-500/10 hover:bg-blue-600/10'
                        }`}
                      >
                        <div className="flex items-start space-x-2.5">
                          <span className="text-base flex-shrink-0 mt-0.5">{n.emoji || '✨'}</span>
                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[11px] tracking-tight">{n.title}</span>
                              <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">{n.time}</span>
                            </div>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-snug">{n.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-hover-theme rounded-lg text-muted"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-slate-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
          
          <button
            onClick={() => setIsChatOpen(true)}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Open AI Tutor Drawer"
          >
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>AI Tutor</span>
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
        <div
          className={`fixed md:static top-0 left-0 bottom-0 h-full z-[9995] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-card border-r border-border-theme md:border-none ${
            isSidebarOpen ? 'w-[280px] translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar
            selectedSubjectId={null}
            onSelectSubject={(id) => {
              setIsSidebarOpen(false);
              navigate(`/course/${id}`);
            }}
            isCollapsed={!isSidebarOpen}
          />
        </div>

        {/* OVERVIEW CONTENT PANEL */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-bg-secondary transition-colors duration-300">
          
          {/* Welcome header & stats */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border-theme gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-primary tracking-tight">
                Study Workspace
              </h1>
              <p className="text-xs text-slate-500 font-semibold">Welcome back to your personalized study desk.</p>
            </div>
            
            <div className="flex items-center space-x-2 text-xs font-bold text-muted bg-card px-3 py-2 rounded-xl border border-border-theme shadow-sm">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Study Session Mode</span>
            </div>
          </div>

          {/* 1. TOP SECTION: Resume Learning Active Module */}
          <Card className="bg-card border border-border-theme rounded-xl p-6 relative overflow-hidden hover:border-blue-500/20 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block">Continue Learning</span>
                {focusSession.available ? (
                  <>
                    <h2 className="text-lg font-bold text-primary tracking-tight leading-tight">
                      {focusSession.topic.title}
                    </h2>
                    <p className="text-xs text-muted font-semibold mt-1">
                      Active Course: <strong className="text-primary font-bold">{focusSession.course.subject_name}</strong>
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-base font-bold text-primary tracking-tight">
                      Syllabus Synced
                    </h2>
                    <p className="text-xs text-muted font-semibold">
                      Please import or add a new course syllabus module to begin study sessions.
                    </p>
                  </>
                )}
              </div>
            </div>
            
            {focusSession.available && (
              <button
                onClick={() => navigate(`/course/${focusSession.course.id}`)}
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-755 text-white font-bold text-xs py-3 px-5 rounded-xl transition-all shadow-sm active:scale-[0.97]"
              >
                Resume Learning
              </button>
            )}
          </Card>

          {/* 2. MIDDLE SECTION: Continue Learning Cards list */}
          <div className="space-y-3">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest block px-1">
              Continue Learning
            </span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {courses.length === 0 ? (
                <div className="col-span-full p-8 border border-dashed border-border-theme text-center rounded-xl font-bold text-xs text-slate-400 bg-card">
                  No courses generated yet. Sync a course syllabus in the sidebar to start!
                </div>
              ) : (
                courses.map((course, idx) => {
                  const topicCount = course.topics?.length || 0;
                  const currentTopicName = topicCount > 0 ? course.topics[0].title : "General Summary";
                  const progresses = [66, 33, 75, 10];
                  const progress = progresses[idx % progresses.length];
                  return (
                    <div 
                      key={course.id}
                      onClick={() => navigate(`/course/${course.id}`)}
                      className="group p-5 rounded-xl border border-border-theme bg-card hover:border-blue-500/40 cursor-pointer transition-all space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-black text-primary truncate group-hover:text-blue-600 transition-colors" title={course.subject_name}>
                            {course.subject_name}
                          </h3>
                          <span className="text-[10px] text-slate-505 dark:text-slate-450 font-bold block mt-0.5 truncate">
                            Topic: {currentTopicName}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="w-full bg-bg-secondary h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-455 font-bold">
                          <span>Curriculum Covered</span>
                          <span className="text-blue-600 dark:text-blue-400 font-extrabold">{progress}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. BOTTOM SECTION: Upcoming Tasks & Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Upcoming Tasks checklist */}
            <Card className="bg-card border border-border-theme rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-border-theme pb-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">
                  Upcoming Tasks
                </h3>
              </div>

              <div className="space-y-3 pt-1">
                {tasks.map((task) => (
                  <label 
                    key={task.id} 
                    className="flex items-start space-x-3 text-xs font-semibold text-muted cursor-pointer select-none group"
                  >
                    <input 
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      className="mt-0.5 rounded border-border-theme text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                    />
                    <span className={`group-hover:text-slate-900 dark:group-hover:text-white transition-all ${
                      task.completed ? 'line-through opacity-55 text-muted' : ''
                    }`}>
                      {task.text}
                    </span>
                  </label>
                ))}
              </div>
            </Card>

            {/* Recent Activity log */}
            <Card className="bg-card border border-border-theme rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-border-theme pb-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">
                  Recent Activity Log
                </h3>
              </div>

              <div className="space-y-3 pt-1 text-xs text-muted font-semibold">
                <div className="flex items-start space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5" />
                  <span>Completed 70-mark Mock Exam evaluation</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5" />
                  <span>Recall practice deck completed (5 cards flipped)</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5" />
                  <span>Discussed 'Types of Entrepreneurs' topics with AI Tutor</span>
                </div>
              </div>
            </Card>

          </div>

        </div>

      </div>

      {/* AI Tutor Drawer slide-over */}
      <TutorDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        currentCourse={focusSession.course}
        currentTopic={focusSession.topic}
      />

    </div>
  );
}