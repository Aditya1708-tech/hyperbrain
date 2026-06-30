import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import Sidebar from '../../components/layout/Sidebar';
import { ThemeContext } from '../../contexts/ThemeContext';
import { TrendingUp, BookOpen, Star, AlertCircle, Award, Menu, Sun, Moon, Loader2 } from 'lucide-react';
import Card from '../../components/common/Card';

export default function ProgressScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

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
          setLoading(false);
        }, (err) => {
          const local = JSON.parse(localStorage.getItem(`courses_${user.uid}`) || '[]');
          setCourses(local);
          setLoading(false);
        });
        return () => unsubFirestore();
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleToggleTopicCompleted = async (courseId, topicTitle) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const updatedTopics = course.topics.map(t => 
      t.title === topicTitle ? { ...t, completed: !t.completed } : t
    );

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const subjectDocRef = doc(db, 'users', uid, 'subjects', courseId);
      await updateDoc(subjectDocRef, { topics: updatedTopics });
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, topics: updatedTopics } : c));
    } catch (err) {
      console.warn("Could not save to firestore, updating locally:", err);
      const local = JSON.parse(localStorage.getItem(`courses_${uid}`) || '[]');
      const updatedLocal = local.map(c => c.id === courseId ? { ...c, topics: updatedTopics } : c);
      localStorage.setItem(`courses_${uid}`, JSON.stringify(updatedLocal));
      setCourses(updatedLocal);
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
            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-bold tracking-tight font-sans">Curriculum Progress</span>
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
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <div className={`transition-all duration-250 overflow-hidden flex-shrink-0 h-full ${
          isSidebarOpen ? 'w-[280px]' : 'w-0'
        }`}>
          <Sidebar 
            selectedSubjectId={null}
            onSelectSubject={() => {}}
            isCollapsed={!isSidebarOpen}
          />
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-bg-secondary transition-colors duration-300">
          
          <div className="pb-4 border-b border-border-theme">
            <h1 className="text-xl font-bold text-primary tracking-tight">
              Syllabus Coverage
            </h1>
            <p className="text-xs text-muted mt-1 font-semibold">
              Track module completion checkpoints, weak areas, and mock evaluation scores. (No graph distractions).
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-bold text-slate-500">Retrieving stats...</span>
            </div>
          ) : courses.length === 0 ? (
            <div className="p-8 text-center bg-card rounded-xl border border-dashed border-border-theme space-y-3 max-w-sm mx-auto">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-500">No active course syllabus synced.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {courses.map((course) => {
                const totalTopics = course.topics?.length || 0;
                const completedTopics = course.topics?.filter(t => t.completed).length || 0;
                const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

                // Strong topics (marked complete)
                const strongTopics = course.topics?.filter(t => t.completed) || [];
                // Weak topics (incomplete & marked Hard/Medium)
                const weakTopics = course.topics?.filter(t => !t.completed && (t.difficulty === 'Hard' || t.difficulty === 'Medium')) || [];

                return (
                  <Card key={course.id} className="bg-card border border-border-theme rounded-xl p-6 space-y-5 transition-colors duration-300">
                    
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-theme/80 pb-3 gap-2">
                      <div>
                        <h2 className="text-lg font-black text-primary tracking-tight">{course.subject_name}</h2>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{completedTopics} of {totalTopics} topics completed</span>
                      </div>
                      
                      {/* Simple progress bar metric */}
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <span className="text-sm font-black text-blue-605 dark:text-blue-400">{progressPercent}%</span>
                      </div>
                    </div>

                    {/* Content lists */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Checklist */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Topic Checklist</span>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                          {course.topics?.map((topic, i) => (
                            <label key={i} className="flex items-center space-x-2.5 text-xs font-semibold text-muted cursor-pointer select-none group">
                              <input
                                type="checkbox"
                                checked={!!topic.completed}
                                onChange={() => handleToggleTopicCompleted(course.id, topic.title)}
                                className="rounded border-border-theme text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                              />
                              <span className={`group-hover:text-slate-900 dark:group-hover:text-white transition-colors ${
                                topic.completed ? 'line-through text-muted' : ''
                              }`}>{topic.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Strengths & Weaknesses */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-muted uppercase tracking-widest block flex items-center">
                            <Star className="w-3.5 h-3.5 mr-1 text-yellow-500 fill-yellow-500" /> Strong Modules
                          </span>
                          {strongTopics.length === 0 ? (
                            <span className="text-[10px] text-slate-450 italic font-medium">No completed modules yet.</span>
                          ) : (
                            <ul className="text-xs text-muted space-y-1 list-disc pl-4 font-semibold">
                              {strongTopics.slice(0, 3).map((t, idx) => (
                                <li key={idx} className="truncate">{t.title}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-muted uppercase tracking-widest block flex items-center">
                            <AlertCircle className="w-3.5 h-3.5 mr-1 text-red-500" /> Focus Target Modules
                          </span>
                          {weakTopics.length === 0 ? (
                            <span className="text-[10px] text-slate-450 italic font-medium">All active modules mastered!</span>
                          ) : (
                            <ul className="text-xs text-muted space-y-1 list-disc pl-4 font-semibold">
                              {weakTopics.slice(0, 3).map((t, idx) => (
                                <li key={idx} className="truncate">{t.title}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* Mock Exams Avg Score */}
                      <div className="p-4 bg-bg-secondary/40 border border-border-theme/80 rounded-xl space-y-2 flex flex-col justify-center text-center">
                        <Award className="w-7 h-7 text-blue-600 dark:text-blue-400 mx-auto" />
                        <div>
                          <span className="text-[9px] font-black text-muted uppercase tracking-widest block">Mock Evaluation Average</span>
                          <span className="text-2xl font-black text-primary tracking-tight mt-1 block">85 / 100</span>
                        </div>
                      </div>

                    </div>
                  </Card>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
