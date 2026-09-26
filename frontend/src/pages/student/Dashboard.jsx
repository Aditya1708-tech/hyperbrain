import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../services/firebase/firebase';
import { collection, onSnapshot, query, orderBy, doc, addDoc } from 'firebase/firestore';
import { 
  BrainCircuit, Menu, MessageSquare, ChevronRight, BookOpen, 
  ArrowLeft, Sun, Moon, Sparkles, Award, Clock,
  Calendar, CheckCircle2, Trash2, Loader2, ArrowUpRight, Bell,
  Search, X, Upload, Check, Sliders, Play, Plus, Book, FileText,
  Activity, Sparkle, Compass, User, CreditCard, Brain
} from 'lucide-react';
import Sidebar from '../../components/layout/Sidebar';
import TutorDrawer from '../../components/tutor/TutorDrawer';
import { ThemeContext } from '../../contexts/ThemeContext';
import { useSidebar } from '../../contexts/SidebarContext';
import Card from '../../components/common/Card';
import { notificationService } from '../../services/firebase/firestoreService';
import { motion } from 'framer-motion';
import { INDIAN_EDUCATION_DATA } from '../../utils/indianEducationData';
import aiService from '../../services/aiService';

// Dynamic Browser-based PDFJS Script Loader
const loadPdfJs = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjs = window.pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjs);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

export default function DashboardScreen() {
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

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [loadProgress, setLoadProgress] = useState(false);

  // Search and Suggestions States
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // Creator Stepper States
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [creationStep, setCreationStep] = useState(1);
  const [selectedPathway, setSelectedPathway] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState('NEP Default Board');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [customWorkspaceName, setCustomWorkspaceName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Custom Syllabus upload states
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedChapters, setExtractedChapters] = useState([]);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  useEffect(() => {
    setLoadProgress(true);
  }, []);

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
    notifications.forEach(n => {
      notificationService.markAsRead(n.id);
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleMarkSingleRead = async (notifId) => {
    await notificationService.markAsRead(notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? ({ ...n, read: true }) : n));
  };

  // Listen to Window Event or URL parameter to open the creator
  useEffect(() => {
    const handleOpenCreator = () => {
      setIsCreatorOpen(true);
      setCreationStep(1);
    };
    window.addEventListener('hb_open_workspace_creator', handleOpenCreator);
    
    const params = new URLSearchParams(location.search);
    if (params.get('create') === 'true') {
      setIsCreatorOpen(true);
      setCreationStep(1);
      navigate('/dashboard', { replace: true });
    }
    
    return () => {
      window.removeEventListener('hb_open_workspace_creator', handleOpenCreator);
    };
  }, [location, navigate]);

  // Authenticate user & sync workspaces sorted by updatedAt DESC
  useEffect(() => {
    setIsLoading(true);
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
      } else {
        if (db) {
          const wsRef = collection(db, 'users', user.uid, 'workspaces');
          const wsQuery = query(wsRef, orderBy('updatedAt', 'desc'));
          return onSnapshot(wsQuery, (snapshot) => {
            const fetched = snapshot.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data()
            }));
            setWorkspaces(fetched);
            setIsLoading(false);
          }, (err) => {
            console.warn("Firestore workspaces sync failed:", err);
            setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      }
    });
    return () => unsub();
  }, [navigate]);

  // Slice to limit 8
  const recentWorkspaces = workspaces.slice(0, 8);

  // Focus active session
  const getFocusSession = () => {
    if (workspaces.length > 0) {
      const active = workspaces[0];
      if (active.topics && active.topics.length > 0) {
        return {
          course: active,
          topic: active.topics[0],
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

  // Unified catalog flattening for search suggestions
  const getSearchCatalog = () => {
    const catalog = [];
    Object.entries(INDIAN_EDUCATION_DATA).forEach(([category, coursesObj]) => {
      Object.entries(coursesObj).forEach(([courseName, semestersObj]) => {
        catalog.push({
          name: courseName,
          category: category,
          semesters: semestersObj,
          type: 'Curriculum'
        });
      });
    });
    return catalog;
  };

  const handleSearchChange = (queryText) => {
    setSearchQuery(queryText);
    if (!queryText.trim()) {
      setSuggestions([]);
      return;
    }
    const cleanQuery = queryText.toLowerCase();
    const catalog = getSearchCatalog();
    const matches = catalog.filter(item => 
      item.name.toLowerCase().includes(cleanQuery) ||
      item.category.toLowerCase().includes(cleanQuery)
    );
    setSuggestions(matches.slice(0, 5));
  };

  const handleSuggestionClick = (sug) => {
    setSearchQuery('');
    setSuggestions([]);
    setSelectedPathway(sug.category);
    setSelectedCourse(sug.name);
    setCustomWorkspaceName(`${sug.name} Workspace`);
    setIsCreatorOpen(true);
    setCreationStep(3); // skip pathway select
  };

  const handleCategoryClick = (catId) => {
    if (catId === 'custom-upload') {
      setSelectedPathway('custom-upload');
      setCreationStep(2); // directly to file uploader
    } else {
      setSelectedPathway(catId);
      setCreationStep(2); // to degree selector
    }
    setIsCreatorOpen(true);
  };

  const selectPathway = (pathwayId) => {
    setSelectedPathway(pathwayId);
    setCreationStep(2);
  };

  const selectCourse = (course) => {
    setSelectedCourse(course);
    setCustomWorkspaceName(`${course} Core Workspace`);
    setCreationStep(3);
  };

  const selectSemester = (sem) => {
    setSelectedSemester(sem);
    setCreationStep(4);
  };

  const handleSubjectSelectToggle = (sub) => {
    setSelectedSubject(sub);
    setCustomWorkspaceName(`${sub} - ${selectedSemester}`);
  };

  const handleCustomFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFile(file);
    setCustomWorkspaceName(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
  };

  // PDF outline extractor effect
  useEffect(() => {
    if (creationStep === 3 && selectedPathway === 'custom-upload' && uploadedFile) {
      const extractPdfOutline = async () => {
        try {
          const pdfjs = await loadPdfJs();
          const arrayBuffer = await uploadedFile.arrayBuffer();
          const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          let pdfText = "";
          const maxPages = Math.min(pdfDoc.numPages, 10);
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            pdfText += pageText + "\n";
          }

          const extraction = await aiService.classifyAndExtractDocument(uploadedFile.name, uploadedFile.size, pdfText);
          const chapters = (extraction.chapters || []).map((ch, idx) => ({
            chapterNumber: ch.chapterNumber || ch.chapter_number || (idx + 1),
            title: ch.title || `Chapter ${idx + 1}`,
            description: ch.description || 'Extracted textbook module.',
            difficulty: ch.difficulty || 'Medium',
            pageRange: ch.pageRange || 'N/A',
            completed: false,
            summary: ''
          }));

          setExtractedChapters(chapters);
          setCreationStep(4);
        } catch (err) {
          console.error("Textbook outline extraction failed, fallback static indices:", err);
          const fallback = [
            { chapterNumber: 1, title: 'Introduction & Core Foundations' },
            { chapterNumber: 2, title: 'Main Theories and Models' },
            { chapterNumber: 3, title: 'Advanced Topics & Case Studies' }
          ];
          setExtractedChapters(fallback);
          setCreationStep(4);
        }
      };
      extractPdfOutline();
    }
  }, [creationStep, selectedPathway, uploadedFile]);

  const handleGenerateWorkspace = async () => {
    setIsGenerating(true);
    const user = auth.currentUser;
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const workspaceName = customWorkspaceName.trim() || (selectedPathway === 'custom-upload' ? uploadedFile.name : `${selectedSubject} - ${selectedSemester}`);
      let newWorkspaceData = {};

      if (selectedPathway === 'custom-upload') {
        newWorkspaceData = {
          name: workspaceName,
          type: 'custom',
          docType: "Textbook",
          docConfidence: 0.95,
          topicSource: "ai_generated",
          semester: "Custom Level",
          institution: "User Document",
          progress: 0,
          goals: [`Master chapters of: ${workspaceName}`, `Complete MCQs & Quizzes for study plan`],
          syllabus: "Custom uploaded curriculum workspace.",
          files: [{ name: uploadedFile.name, uploadedAt: new Date().toISOString() }],
          topics: extractedChapters,
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (db) {
          await addDoc(collection(db, 'users', user.uid, 'workspaces'), newWorkspaceData);
        } else {
          const currentLocal = JSON.parse(localStorage.getItem(`hb_workspaces_${user.uid}`) || '[]');
          localStorage.setItem(`hb_workspaces_${user.uid}`, JSON.stringify([newWorkspaceData, ...currentLocal]));
        }
      } else {
        const topicsList = INDIAN_EDUCATION_DATA[selectedPathway]?.[selectedCourse]?.[selectedSemester]?.[selectedSubject] || [];
        const mappedTopics = topicsList.map((t, idx) => ({
          chapterNumber: idx + 1,
          title: t,
          description: `Core study module: ${t}.`,
          difficulty: 'Medium',
          summary: '',
          completed: false
        }));

        newWorkspaceData = {
          name: workspaceName,
          type: 'standard',
          docType: "Curriculum",
          semester: selectedSemester,
          institution: selectedUniversity || 'NEP default Board',
          progress: 0,
          topics: mappedTopics,
          nepMetadata: {
            pathway: 'Major Core',
            courseType: 'Disciplinary Core',
            credits: 4,
            eligibility: 'Level 4.5 standard'
          },
          academicMetadata: {
            pathway: selectedCourse,
            institution: selectedUniversity || 'NEP Mapped Institution',
            level: selectedSemester,
            revisionStatus: 'Not Started',
            estimatedDuration: '40 Hours'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (db) {
          await addDoc(collection(db, 'users', user.uid, 'workspaces'), newWorkspaceData);
        } else {
          const currentLocal = JSON.parse(localStorage.getItem(`hb_workspaces_${user.uid}`) || '[]');
          localStorage.setItem(`hb_workspaces_${user.uid}`, JSON.stringify([newWorkspaceData, ...currentLocal]));
        }
      }

      window.dispatchEvent(new Event('hb_courses_updated'));
      showToast("Workspace generated successfully!");
      closeCreator();
    } catch (err) {
      console.error("Workspace generation failed:", err);
      showToast("Workspace generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const closeCreator = () => {
    setIsCreatorOpen(false);
    setCreationStep(1);
    setSelectedPathway('');
    setSelectedCourse('');
    setSelectedSemester('');
    setSelectedSubject('');
    setCustomWorkspaceName('');
    setUploadedFile(null);
    setExtractedChapters([]);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const formatLastOpened = (dateStr) => {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getWorkspaceProgress = (item) => {
    if (typeof item.progress === 'number' && item.progress > 0) return item.progress;
    if (item.topics && item.topics.length > 0) {
      const completedCount = item.topics.filter(t => t.completed).length;
      return Math.round((completedCount / item.topics.length) * 100);
    }
    return 0;
  };

  return (
    <div className="h-screen w-full bg-bg-secondary text-primary flex flex-col overflow-hidden transition-colors duration-300">
      
      {/* 1. TOP HEADER PANEL */}
      <header className="h-16 border-b border-border-theme bg-card flex items-center justify-between px-6 flex-shrink-0 z-[12] transition-colors duration-300 relative select-none">
        
        {/* Left Toggle buttons */}
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
          
          <div className="flex items-center space-x-2.5">
            <BrainCircuit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-bold tracking-tight font-sans">HyperBrain AI</span>
          </div>
        </div>

        {/* Right action metrics */}
        <div className="flex items-center space-x-4">
          
          {/* Notifications Panel Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="p-2 hover:bg-hover-theme rounded-lg relative text-slate-500 hover:text-primary transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-ping" />
              )}
            </button>

            {showNotifPanel && (
              <div className="absolute right-0 mt-2.5 w-80 bg-card border border-border-theme rounded-2xl shadow-2xl p-4 z-[9999] text-left space-y-3.5 transition-all">
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Inbox Notifications</h4>
                  <button onClick={handleMarkAllRead} className="text-[9px] font-bold text-blue-600 hover:underline">Mark all read</button>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2.5">
                  {notifications.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic text-center py-4">No notifications in your inbox</p>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} onClick={() => handleMarkSingleRead(n.id)} className={`p-2.5 rounded-xl border border-border-theme text-[10px] font-medium leading-normal cursor-pointer transition-colors ${n.read ? 'opacity-60 bg-bg-secondary/40' : 'bg-blue-500/5 hover:bg-blue-500/10'}`}>
                        <div className="font-bold text-primary mb-0.5">{n.title}</div>
                        <div className="text-muted">{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-hover-theme rounded-lg text-slate-655"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

      </header>

      {/* BODY LAYOUT */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* MOBILE SIDEBAR BACKDROP */}
        {mobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9990] transition-opacity lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* LEFT SIDEBAR */}
        <div
          className={`fixed lg:static top-0 left-0 bottom-0 h-full z-[9995] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-card border-r border-border-theme lg:border-none ${
            mobileSidebarOpen 
              ? 'w-[280px] translate-x-0 block lg:hidden' 
              : 'w-0 -translate-x-full hidden lg:block'
          } ${
            desktopSidebarOpen 
              ? 'lg:w-[280px] lg:translate-x-0' 
              : 'lg:w-0 lg:-translate-x-full'
          }`}
        >
          <Sidebar
            selectedSubjectId={null}
            onSelectSubject={(id) => {
              setMobileSidebarOpen(false);
              navigate(`/course/${id}`);
            }}
            isCollapsed={false}
          />
        </div>

        {/* OVERVIEW CONTENT PANEL */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar bg-bg-secondary transition-colors duration-300"
        >
          
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

          {/* 1. TOP SECTION: ChatGPT-style Onboarding Hero */}
          <div className="bg-card border border-border-theme rounded-3xl p-8 relative overflow-hidden shadow-sm flex flex-col items-center text-center space-y-6 max-w-4xl mx-auto py-10 transition-all duration-300">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-primary tracking-tight leading-tight">
                What do you want to learn today?
              </h2>
              <p className="text-xs text-slate-500 max-w-lg leading-relaxed mx-auto font-semibold">
                Choose an academic pathway, professional certification, competitive exam, government exam, or upload your own syllabus. HyperBrain will generate a personalized AI workspace automatically.
              </p>
            </div>
            
            {/* Search Input Box */}
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-4.5 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search any degree, semester, subject, government exam, certification, entrance exam, or upload your own syllabus..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border-theme rounded-2xl text-xs font-semibold focus-ring transition-colors"
              />
              
              {/* Autocomplete Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute top-14 left-0 right-0 bg-card border border-border-theme rounded-2xl shadow-2xl p-2.5 z-50 text-left space-y-1">
                  {suggestions.map((sug, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSuggestionClick(sug)}
                      className="p-3 hover:bg-hover-theme rounded-xl cursor-pointer transition-colors text-xs flex justify-between items-center font-semibold"
                    >
                      <div className="flex items-center space-x-2.5">
                        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-bold text-primary">{sug.name}</span>
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase bg-bg-secondary px-2.5 py-0.5 rounded-md">
                        {sug.category}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Quick learning categories grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 w-full pt-4">
              {[
                { id: 'Degree Programs', name: 'Higher Ed', icon: BookOpen },
                { id: 'School Boards', name: 'School Boards', icon: Book },
                { id: 'Government Exams', name: 'Gov Exams', icon: Award },
                { id: 'Entrance Exams', name: 'Entrance Exams', icon: Compass },
                { id: 'Professional Courses', name: 'Professional', icon: Sliders },
                { id: 'Skill Development', name: 'Skill Dev', icon: BrainCircuit },
                { id: 'custom-upload', name: 'Upload Custom', icon: Upload }
              ].map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className="p-4 bg-bg-secondary/40 border border-border-theme hover:border-blue-500/40 rounded-2xl transition-all flex flex-col items-center justify-center space-y-2 text-center text-primary group hover:-translate-y-0.5"
                  >
                    <Icon className="w-5 h-5 text-blue-655 dark:text-blue-400 group-hover:scale-105 transition-transform" />
                    <span className="text-[10px] font-black leading-none">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. MIDDLE SECTION: Unified Workspaces List */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest block px-1">
              Recent Workspaces
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse p-5 rounded-xl border border-border-theme bg-card space-y-4 h-36">
                    <div className="h-4 bg-bg-secondary rounded w-2/3"></div>
                    <div className="h-3 bg-bg-secondary rounded w-1/3 mt-2"></div>
                    <div className="h-2 bg-bg-secondary rounded w-full mt-6"></div>
                  </div>
                ))
              ) : workspaces.length === 0 ? (
                <div className="col-span-full border border-dashed border-border-theme text-center rounded-3xl p-8 bg-card max-w-lg mx-auto space-y-4 shadow-sm select-none">
                  <Brain className="w-10 h-10 text-blue-600 dark:text-blue-400 mx-auto animate-pulse" />
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-black text-primary">No workspaces yet</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                      Choose a course, entrance exam, certification, government exam, or upload your own syllabus to create your first AI-powered study workspace.
                    </p>
                  </div>
                  <div className="space-y-3 pt-1">
                    <button
                      onClick={() => {
                        setIsCreatorOpen(true);
                        setCreationStep(1);
                      }}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 mx-auto active:scale-[0.98] transform"
                    >
                      <Plus className="w-4 h-4 text-white" />
                      <span>Create Workspace</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedPathway('custom-upload');
                        setCreationStep(2);
                        setIsCreatorOpen(true);
                      }}
                      className="text-[10px] font-black text-blue-655 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 uppercase tracking-widest block mx-auto underline transition-colors"
                    >
                      Upload your own syllabus
                    </button>
                  </div>
                </div>
              ) : (
                recentWorkspaces.map((item) => {
                  const progress = getWorkspaceProgress(item);
                  const progressText = progress === 0 ? "Not Started" : `${progress}%`;
                  const lastOpened = formatLastOpened(item.updatedAt || item.createdAt);
                  return (
                    <div 
                      key={item.id}
                      onClick={() => navigate(`/course/${item.id}`)}
                      className="group p-5 rounded-xl border border-border-theme bg-card hover:border-blue-500/40 cursor-pointer transition-all space-y-4 relative flex flex-col justify-between"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-sm font-black text-primary truncate group-hover:text-blue-650 transition-colors" title={item.name}>
                            {item.name}
                          </h3>
                          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform flex-shrink-0" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                            Level: {item.semester || "Custom"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                            Inst: {item.institution || "NEP Board"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-border-theme">
                        <div className="flex justify-between items-center text-[9px] text-slate-455 font-bold">
                          <span>Last Opened</span>
                          <span className="text-primary font-bold">{lastOpened}</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="w-full bg-bg-secondary h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out" 
                              style={{ width: loadProgress ? `${progress}%` : '0%' }} 
                            />
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-455 font-bold">
                            <span>Progress</span>
                            <span className="text-blue-650 dark:text-blue-400 font-extrabold">{progressText}</span>
                          </div>
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
                {workspaces.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No active study tasks yet.</p>
                ) : (
                  workspaces.slice(0, 4).map((ws, i) => (
                    <label 
                      key={ws.id} 
                      className="flex items-start space-x-3 text-xs font-semibold text-muted cursor-pointer select-none group"
                    >
                      <input 
                        type="checkbox"
                        checked={false}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-border-theme text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                      />
                      <span className="group-hover:text-slate-900 dark:group-hover:text-white transition-all">
                        Study next module of: {ws.name}
                      </span>
                    </label>
                  ))
                )}
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
                {workspaces.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No study history recorded.</p>
                ) : (
                  workspaces.slice(0, 3).map((ws) => (
                    <div key={ws.id} className="flex items-start space-x-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5" />
                      <span>Generated workspace for "{ws.name}" on {formatLastOpened(ws.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

          </div>

          {/* 4. AI Recommendations cockpit */}
          <Card className="bg-card border border-border-theme rounded-2xl p-6 relative overflow-hidden transition-all duration-300">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0">
                <Sparkle className="w-6 h-6 text-blue-500" />
              </div>
              <div className="space-y-1 text-left">
                <span className="text-[9px] font-black text-blue-655 dark:text-blue-450 uppercase tracking-widest block">AI Learning Insights</span>
                {workspaces.length === 0 ? (
                  <>
                    <h3 className="text-base font-black text-primary tracking-tight font-sans">AI Recommendations Engine Offline</h3>
                    <p className="text-xs text-muted leading-relaxed max-w-2xl font-semibold">
                      No study recommendations. Create your first workspace to activate the AI Tutor recommendations engine.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-black text-primary tracking-tight font-sans">Generate Spaced Repetition Roadmap</h3>
                    <p className="text-xs text-muted leading-relaxed max-w-2xl font-semibold">
                      HyperBrain recommends generating a 4-week spaced repetition study roadmap for "{workspaces[0].name}" to optimize recall curves before exam review cycles.
                    </p>
                  </>
                )}
              </div>
            </div>
          </Card>

        </motion.div>

      </div>

      {/* 5. WORKSPACE CREATOR STEPPER MODAL */}
      {isCreatorOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border-theme w-full max-w-lg rounded-3xl p-6 shadow-2xl relative space-y-6 text-primary max-h-[90vh] overflow-y-auto custom-scrollbar transition-all duration-300 font-sans">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-border-theme pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-widest text-primary">AI Workspace Creator</h3>
              </div>
              <button 
                onClick={closeCreator}
                className="p-1.5 hover:bg-hover-theme rounded-xl text-muted hover:text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Progress indicator */}
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-muted tracking-widest border-b border-border-theme pb-3">
              <span>Step {creationStep} of 5</span>
              <span className="text-primary font-black">
                {creationStep === 1 && 'Select Pathway'}
                {creationStep === 2 && 'Select Course'}
                {creationStep === 3 && 'Level & Syllabus Details'}
                {creationStep === 4 && 'Review Curriculum'}
                {creationStep === 5 && 'Create Workspace'}
              </span>
            </div>

            {/* Step Content */}
            {creationStep === 1 && (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider">Choose Learning Pathway</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'Degree Programs', name: 'Higher Education (BCA, BTech, BCom, etc.)' },
                    { id: 'School Boards', name: 'School Education Boards (CBSE, ICSE, etc.)' },
                    { id: 'Government Exams', name: 'Government Recruitment Exams (UPSC, SSC, Banking)' },
                    { id: 'Entrance Exams', name: 'Academic Entrance Exams (JEE, NEET, GATE, CAT)' },
                    { id: 'Professional Courses', name: 'Professional Qualifications (CA, CS, CFA)' },
                    { id: 'Skill Development', name: 'Skill Enhancement courses (Web Dev, AI)' },
                    { id: 'custom-upload', name: 'Upload custom book / Syllabus PDF' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectPathway(p.id)}
                      className="w-full text-left p-4 bg-bg-secondary/40 hover:bg-hover-theme rounded-2xl border border-border-theme text-xs font-bold transition-all"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {creationStep === 2 && (
              <div className="space-y-4">
                {selectedPathway === 'custom-upload' ? (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Upload textbook or syllabus PDF</label>
                    <div className="p-6 border border-dashed border-border-theme bg-bg-secondary/20 rounded-2xl text-center space-y-3 relative">
                      <Upload className="w-8 h-8 text-blue-500 mx-auto" />
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleCustomFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="text-xs font-bold text-primary">
                        {uploadedFile ? `Selected: ${uploadedFile.name}` : 'Click or drop PDF here to upload'}
                      </div>
                      <p className="text-[10px] text-muted">Supports textbooks, handwritten notes, lecture files, or syllabus guides.</p>
                    </div>
                    
                    {uploadedFile && (
                      <button
                        onClick={() => setCreationStep(3)}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all"
                      >
                        Continue to Extraction →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Select Course Curriculum</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto custom-scrollbar">
                      {Object.keys(INDIAN_EDUCATION_DATA[selectedPathway] || {}).map(course => (
                        <button
                          key={course}
                          onClick={() => selectCourse(course)}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs font-bold transition-all ${
                            selectedCourse === course 
                              ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400' 
                              : 'bg-card border-border-theme hover:bg-hover-theme'
                          }`}
                        >
                          {course}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {creationStep === 3 && (
              <div className="space-y-4">
                {selectedPathway === 'custom-upload' ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <div>
                      <h4 className="text-xs font-black uppercase text-blue-600 tracking-wider">Extracting outline checklists</h4>
                      <p className="text-[10px] text-muted font-bold mt-1">Analyzing curriculum contents pages to extract chapter checkpoints...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Select Semester / Level</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(INDIAN_EDUCATION_DATA[selectedPathway]?.[selectedCourse] || {}).map(sem => (
                        <button
                          key={sem}
                          onClick={() => selectSemester(sem)}
                          className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all ${
                            selectedSemester === sem 
                              ? 'bg-blue-600/10 border-blue-650 text-blue-600 dark:text-blue-400' 
                              : 'bg-card border-border-theme text-slate-500 hover:bg-hover-theme'
                          }`}
                        >
                          {sem}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {creationStep === 4 && (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                  {selectedPathway === 'custom-upload' ? 'Review Extracted Syllabus Chapters' : 'Review & Select Subject Outlines'}
                </label>
                <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar">
                  {selectedPathway === 'custom-upload' ? (
                    extractedChapters.map((ch, idx) => (
                      <div key={idx} className="p-3 bg-bg-secondary/40 border border-border-theme rounded-xl flex items-center space-x-2.5 text-xs font-semibold text-muted">
                        <span className="w-2 h-2 bg-blue-600 rounded-full" />
                        <span>Chapter {ch.chapterNumber}: {ch.title}</span>
                      </div>
                    ))
                  ) : (
                    Object.keys(INDIAN_EDUCATION_DATA[selectedPathway]?.[selectedCourse]?.[selectedSemester] || {}).map(sub => (
                      <div
                        key={sub}
                        onClick={() => handleSubjectSelectToggle(sub)}
                        className={`p-4 border rounded-2xl cursor-pointer transition-all flex justify-between items-start ${
                          selectedSubject === sub 
                            ? 'bg-blue-600/5 border-blue-500' 
                            : 'bg-card border-border-theme hover:border-slate-400 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <h5 className="font-bold text-xs text-primary leading-tight mb-1">{sub}</h5>
                          <span className="text-[9px] font-black text-slate-405 dark:text-slate-450 uppercase tracking-widest block">
                            NEP Core • 4 Credits • CBCS Major Mapped
                          </span>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedSubject === sub ? 'border-blue-600 bg-blue-600 text-white' : 'border-border-theme'}`}>
                          {selectedSubject === sub && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <button
                  onClick={() => setCreationStep(5)}
                  disabled={selectedPathway !== 'custom-upload' && !selectedSubject}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-755 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-40"
                >
                  Continue →
                </button>
              </div>
            )}

            {creationStep === 5 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Workspace Name</label>
                  <input
                    type="text"
                    value={customWorkspaceName}
                    onChange={(e) => setCustomWorkspaceName(e.target.value)}
                    placeholder="e.g. Computer Science Semester 1"
                    className="w-full bg-bg-secondary border border-border-theme rounded-xl px-4 py-2.5 text-xs font-semibold focus-ring text-primary"
                  />
                </div>
                
                <button
                  onClick={handleGenerateWorkspace}
                  disabled={isGenerating}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-755 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Building AI Learning Modules...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-white fill-white" />
                      <span>Generate Workspace</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Navigation back triggers */}
            {creationStep > 1 && creationStep < 5 && selectedPathway !== 'custom-upload' && (
              <button 
                onClick={() => setCreationStep(prev => prev - 1)}
                className="text-[10px] font-black text-slate-500 hover:text-primary uppercase tracking-widest flex items-center space-x-1 transition-colors pt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Go Back</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Toast Notification overlay alerts */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-card border border-border-theme px-5 py-3.5 rounded-2xl shadow-xl z-[9999] flex items-center space-x-3 text-xs font-bold text-primary transition-all duration-300 transform translate-y-0 opacity-100 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

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