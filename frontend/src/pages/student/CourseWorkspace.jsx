import React, { useState, useContext, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import Sidebar from '../../components/layout/Sidebar';
import TopicContent from '../../components/dashboard/TopicContent';
import TutorDrawer from '../../components/tutor/TutorDrawer';
import FlashcardsWorkspace from '../../components/workspace/FlashcardsWorkspace';
import TutorWorkspace from '../../components/workspace/TutorWorkspace';
import { ThemeContext } from '../../contexts/ThemeContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { Book, Award, BookOpen, MessageSquare, Trash2, ArrowLeft, Loader2, Sparkles, Menu, Sun, Moon } from 'lucide-react';
import Card from '../../components/common/Card';
import { firestoreRepository } from '../../repositories/academic/firestoreRepository';

export default function CourseWorkspaceScreen() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  
  const { 
    desktopSidebarOpen, 
    mobileSidebarOpen, 
    setMobileSidebarOpen, 
    toggleDesktopSidebar, 
    toggleMobileSidebar 
  } = useSidebar();

  const [activeTab, setActiveTab] = useState('topics'); // 'topics' | 'notes' | 'exams' | 'flashcards' | 'tutor'
  const [courseData, setCourseData] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTopicTitle, setActiveTopicTitle] = useState(null);
  const isReadingNotes = (activeTab === 'topics' && activeTopicTitle) || activeTab === 'flashcards' || activeTab === 'tutor';

  // Deletion modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };
  const [collectionName, setCollectionName] = useState('workspaces');

  // Load course details
  useEffect(() => {
    if (!courseId) return;

    setLoading(true);
    
    const loadWorkspace = async (user) => {
      try {
        let isWs = true;
        let docRef = doc(db, 'users', user.uid, 'workspaces', courseId);
        let snap = await getDoc(docRef);
        if (!snap.exists()) {
          docRef = doc(db, 'users', user.uid, 'subjects', courseId);
          snap = await getDoc(docRef);
          isWs = false;
        }

        setCollectionName(isWs ? 'workspaces' : 'subjects');

        if (snap.exists()) {
          const wsData = snap.data();
          const mappedData = {
            id: snap.id,
            subject_name: wsData.name || wsData.subject_name,
            ...wsData
          };

          if (mappedData.subjectId && !mappedData.topics) {
            // Ingested/linked course: Retrieve topics dynamically from Academic Repository
            const topicsList = await firestoreRepository.queryDocs('topics', [
              { field: 'subjectId', op: '==', value: mappedData.subjectId }
            ], 100);
            const sortedTopics = topicsList.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
            mappedData.topics = sortedTopics.map(t => ({
              chapterNumber: t.chapterNumber || 1,
              title: t.displayName,
              description: t.description || '',
              difficulty: t.difficulty || 'Medium',
              summary: t.summary || '',
              completed: mappedData.completedTopics?.includes(t.displayName) || false
            }));
          } else if (mappedData.topics) {
            mappedData.topics = mappedData.topics.map(t => ({
              ...t,
              completed: mappedData.completedTopics?.includes(t.title) || t.completed || false
            }));
          }
          setCourseData(mappedData);
        } else {
          setToastMessage("Course workspace not found.");
          navigate('/dashboard');
        }
      } catch (err) {
        console.error("Firestore course fetch error:", err);
        setToastMessage("Error loading course workspace.");
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      await loadWorkspace(user);
    });

    const handleWorkspaceSync = () => {
      const user = auth.currentUser;
      if (user) loadWorkspace(user);
    };
    window.addEventListener('hb_workspace_updated', handleWorkspaceSync);

    return () => {
      unsub();
      window.removeEventListener('hb_workspace_updated', handleWorkspaceSync);
    };
  }, [courseId, navigate]);

  const handleToggleTopicComplete = async (topicTitle) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !courseId || !courseData) return;

    try {
      const subjectRef = doc(db, 'users', uid, collectionName, courseId);
      const freshSnap = await getDoc(subjectRef);
      if (freshSnap.exists()) {
        const ws = freshSnap.data();
        let completedList = ws.completedTopics || [];
        
        const isCurrentlyCompleted = completedList.includes(topicTitle);
        if (isCurrentlyCompleted) {
          completedList = completedList.filter(t => t !== topicTitle);
        } else {
          completedList = [...completedList, topicTitle];
        }

        const totalCount = courseData.topics?.length || 1;
        const progressPercent = Math.round((completedList.length / totalCount) * 100);

        // Update Firestore
        await updateDoc(subjectRef, {
          completedTopics: completedList,
          progress: progressPercent
        });

        // Update local React state instantly
        setCourseData(prev => {
          if (!prev) return prev;
          const updatedTopics = prev.topics?.map(t => 
            t.title === topicTitle ? { ...t, completed: !isCurrentlyCompleted } : t
          );
          return {
            ...prev,
            completedTopics: completedList,
            progress: progressPercent,
            topics: updatedTopics
          };
        });

        showToast(isCurrentlyCompleted ? "Topic marked as In Progress." : "Topic completed!");
        
        // Dispatch window event so sidebar/progress pages update
        window.dispatchEvent(new Event('hb_courses_updated'));
      }
    } catch (err) {
      console.error("Failed to toggle completion:", err);
    }
  };

  const handleDeleteCourse = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !courseId) return;
    
    setIsDeleting(true);
    try {
      // 1. Delete course doc from Firestore
      const subjectDocRef = doc(db, 'users', uid, collectionName, courseId);
      await deleteDoc(subjectDocRef);

      // 2. Delete associated flashcards, plans and exams (or local storage keys)
      const fcDocId = `${courseId}_${courseData?.subject_name?.replace(/\s+/g, '_')}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'flashcards', fcDocId));
        await deleteDoc(doc(db, 'users', uid, 'studyPlans', `plan_${courseId}`));
      } catch (e) {
        console.warn("Sub-document removal failed:", e);
      }

      // Purge local storage
      localStorage.removeItem(`fc_${uid}_${fcDocId}`);
      localStorage.removeItem(`sp_${uid}_plan_${courseId}`);
      
      // Update local storage courses cache list
      const local = JSON.parse(localStorage.getItem(`courses_${uid}`) || '[]');
      const filtered = local.filter(c => c.id !== courseId);
      localStorage.setItem(`courses_${uid}`, JSON.stringify(filtered));

      setToastMessage("Course workspace deleted successfully.");
      setTimeout(() => {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        navigate('/dashboard');
      }, 1500);

    } catch (err) {
      console.warn("Delete course failed, removing local cache list item:", err);
      const local = JSON.parse(localStorage.getItem(`courses_${uid}`) || '[]');
      const filtered = local.filter(c => c.id !== courseId);
      localStorage.setItem(`courses_${uid}`, JSON.stringify(filtered));
      
      setToastMessage("Course deleted successfully.");
      setTimeout(() => {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        navigate('/dashboard');
      }, 1500);
    }
  };

  const activeTopic = courseData?.topics?.find(t => t.title === activeTopicTitle);

  return (
    <div className={`w-full bg-bg-secondary text-primary flex flex-col transition-colors duration-300 ${isReadingNotes ? 'min-h-screen' : 'h-screen overflow-hidden'}`}>
      
      {/* APP HEADER */}
      <header className="sticky top-0 h-16 border-b border-border-theme bg-card flex items-center justify-between px-6 flex-shrink-0 z-10 transition-colors bg-opacity-95 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (window.innerWidth >= 1024) {
                toggleDesktopSidebar();
              } else {
                toggleMobileSidebar();
              }
            }}
            className="p-2 hover:bg-hover-theme rounded-lg text-slate-655 dark:text-slate-400"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 hover:bg-hover-theme rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center space-x-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold">Dashboard</span>
          </button>
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
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Open AI Tutor Drawer"
          >
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>AI Tutor</span>
          </button>
        </div>
      </header>

      {/* BODY LAYOUT */}
      <div className={`flex-1 flex relative ${!isReadingNotes ? 'overflow-hidden' : ''}`}>
        
        {/* MOBILE/TABLET SIDEBAR BACKDROP */}
        {mobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9990] transition-opacity lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* LEFT SIDEBAR */}
        <div className={`fixed ${
          isReadingNotes 
            ? 'lg:sticky lg:top-16 lg:h-[calc(100vh-64px)]' 
            : 'lg:static lg:h-full'
        } left-0 bottom-0 z-[9995] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-card border-r border-border-theme lg:border-none ${
          // Mobile & Tablet styling (<1024px)
          mobileSidebarOpen 
            ? 'w-[280px] translate-x-0 block lg:hidden' 
            : 'w-0 -translate-x-full hidden lg:block'
        } ${
          // Desktop styling (>=1024px)
          desktopSidebarOpen 
            ? 'lg:w-[280px] lg:translate-x-0' 
            : 'lg:w-0 lg:-translate-x-full'
        }`}>
          <Sidebar 
            selectedSubjectId={courseId}
            onSelectSubject={(id) => {
              setMobileSidebarOpen(false);
              navigate(`/course/${id}`);
            }}
            isCollapsed={false}
          />
        </div>

        {/* WORKSPACE CONTENT */}
        <div className={`flex-1 flex flex-col bg-bg-secondary ${!isReadingNotes ? 'overflow-hidden' : ''}`}>
          
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-bold text-slate-500">Opening Course Workspace...</span>
            </div>
          ) : !courseData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <Book className="w-12 h-12 text-slate-400" />
              <p className="text-xs font-bold text-slate-500">Failed to load course workspace.</p>
            </div>
          ) : (
            <div className={`flex-1 flex flex-col ${activeTab !== 'notes' ? 'overflow-hidden' : ''}`}>
              
              {/* Workspace Navigation Header & Tab Controls */}
              <div className="p-6 bg-card border-b border-border-theme flex-shrink-0 space-y-4 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-bg-secondary rounded-xl text-blue-600 dark:text-blue-400">
                      <Book className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-primary tracking-tight leading-tight">
                        {courseData.subject_name}
                      </h1>
                      <div className="flex items-center space-x-2.5 mt-1 select-none">
                        <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold block">
                          {courseData.progress || 0}% Completed ({courseData.completedTopics?.length || 0} of {courseData.topics?.length || 0} topics)
                        </span>
                        <div className="w-20 h-1.5 bg-bg-secondary rounded-full overflow-hidden border border-border-theme">
                          <div className="h-full bg-blue-650" style={{ width: `${courseData.progress || 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center justify-center space-x-1.5 px-4.5 py-2.5 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 border border-red-200 dark:border-red-900/40 text-red-500 rounded-xl text-xs font-bold transition-all shadow-xs"
                    title="Delete Course Workspace"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Workspace</span>
                  </button>
                </div>

                {/* Workspace Horizontal Tab List */}
              <div className="flex space-x-2 border-t border-slate-100 dark:border-slate-900 pt-4 overflow-x-auto custom-scrollbar">
                {[
                  { id: 'topics', label: 'Topics', icon: BookOpen },
                  { id: 'flashcards', label: 'Flashcards', icon: BookOpen },
                  { id: 'exams', label: 'Exam Practice', icon: Award },
                  { id: 'tutor', label: 'AI Tutor', icon: MessageSquare }
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setActiveTopicTitle(null); }}
                        className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all select-none ${
                          isSelected
                            ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-extrabold border-b-2 border-blue-600'
                            : 'text-slate-500 hover:bg-hover-theme hover:text-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Workspace Active View Body Container */}
              <div className={`bg-bg-secondary p-6 md:p-8 ${!isReadingNotes ? 'flex-1 overflow-hidden' : ''}`}>
                
                {/* 1. TOPICS VIEW */}
                {activeTab === 'topics' && (
                  <div className="h-full flex flex-col overflow-hidden">
                    {!activeTopicTitle ? (
                      <div className="space-y-4 overflow-y-auto h-full custom-scrollbar pr-2 pb-6">
                        {courseData.topics?.map((topic, i) => (
                          <div
                            key={i}
                            onClick={() => setActiveTopicTitle(topic.title)}
                            className="bg-card p-6 rounded-xl border border-border-theme hover:border-blue-500/40 cursor-pointer transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center space-x-3 pr-2 select-none">
                              <input
                                type="checkbox"
                                checked={!!topic.completed}
                                onChange={(e) => {
                                  e.stopPropagation(); // Prevent triggering activeTopicTitle selection
                                  handleToggleTopicComplete(topic.title);
                                }}
                                className="w-4.5 h-4.5 rounded border-border-theme text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <div className="space-y-1">
                                <h4 className={`text-sm font-bold leading-snug ${topic.completed ? 'line-through text-slate-400 opacity-60' : 'text-primary'}`}>{topic.title}</h4>
                                <p className="text-xs text-muted font-semibold truncate max-w-lg">{topic.summary || 'Click to review concepts.'}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full select-none ${
                              topic.difficulty === 'Easy' 
                                ? 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400' 
                                : topic.difficulty === 'Medium'
                                ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/20 dark:text-yellow-400'
                                : 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
                            }`}>
                              {topic.difficulty || 'Easy'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col overflow-hidden">
                        <div className="flex items-center space-x-2 border-b border-border-theme pb-3 flex-shrink-0 mb-4">
                          <button
                            onClick={() => setActiveTopicTitle(null)}
                            className="p-1 hover:bg-hover-theme rounded-lg text-slate-500"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Back to Topics • Studying: {activeTopicTitle}</span>
                        </div>
                        <div className={isReadingNotes ? "w-full" : "flex-1 overflow-hidden"}>
                          <TopicContent
                            subjectId={courseId}
                            subjectName={courseData.subject_name}
                            topicName={activeTopicTitle}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. EXAMS SHORTCUT */}
                {activeTab === 'exams' && (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="max-w-sm space-y-4">
                      <Award className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto" />
                      <h3 className="text-base font-bold text-primary">Custom University Exam</h3>
                      <p className="text-xs text-muted leading-relaxed font-semibold">
                        Ready to test your memory limits? Start a blueprint exam setup for "{courseData.subject_name}" using university guidelines.
                      </p>
                      <button
                        onClick={() => navigate('/mock-exam')}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1.5 mx-auto"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Setup Exam Now</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. FLASHCARDS WORKSPACE */}
                {activeTab === 'flashcards' && (
                  <div className="w-full">
                    <FlashcardsWorkspace
                      courseData={courseData}
                      activeTopicTitle={activeTopicTitle}
                      onSelectTopic={(title) => {
                        setActiveTopicTitle(title);
                        setToastMessage(`Switched active topic to: ${title}`);
                        setTimeout(() => setToastMessage(''), 2500);
                      }}
                    />
                  </div>
                )}                {/* 5. TUTOR WORKSPACE */}
                {activeTab === 'tutor' && (
                  <div className="w-full">
                    <TutorWorkspace
                      courseData={courseData}
                      activeTopicTitle={activeTopicTitle}
                      onSelectTopic={(title) => {
                        setActiveTopicTitle(title);
                        setToastMessage(`Switched active topic to: ${title}`);
                        setTimeout(() => setToastMessage(''), 2500);
                      }}
                    />
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

      </div>

      {/* Course Deletion Confirmation Modal Overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border-theme p-6 rounded-2xl w-full max-w-sm shadow-xl space-y-4 text-primary transition-colors duration-300">
            <h3 className="text-sm font-black text-red-500 uppercase tracking-widest">
              Delete course?
            </h3>
            <p className="text-xs text-muted font-semibold leading-relaxed">
              This removes syllabus, notes, flashcards, exams, and progress data. This action is irreversible.
            </p>
            <div className="flex justify-end space-x-2.5 pt-2 border-t border-border-theme">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-2xl text-muted hover:bg-hover-theme transition-colors duration-300 disabled:opacity-50 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteCourse}
                className="px-4 py-2 bg-red-650 hover:bg-red-750 active:scale-[0.98] text-white text-xs font-semibold rounded-2xl transition-all shadow-sm focus-ring flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer font-bold animate-pulse"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging Workspace...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Tutor Drawer slide-over */}
      <TutorDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        currentCourse={courseData}
        currentTopic={activeTopic}
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
