import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { collection, onSnapshot, query, orderBy, doc, setDoc, addDoc, updateDoc, deleteDoc, getDocs, serverTimestamp, getDoc, deleteField } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import aiService, { askTutorChat, classifyAndExtractDocument, generateUpgradedNotes } from '../../services/aiService';
import { ThemeContext } from '../../contexts/ThemeContext';
import { adaptiveLearningService } from '../../services/academic/adaptiveLearningService';
import { betaLaunchService } from '../../services/firebase/betaLaunchService';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { subscriptionService } from '../../services/firebase/subscriptionService';
import { userService } from '../../services/firebase/userService';
import { INDIAN_EDUCATION_DATA } from '../../utils/indianEducationData';
import { 
  Sparkles, Send, Loader2, MessageSquare, BookOpen, Menu, Sun, Moon, 
  Search, Plus, Trash2, Edit3, Check, CheckSquare, Square, FileText, Upload, 
  HelpCircle, ChevronRight, ChevronDown, Book, Sliders, ArrowLeft, X, Award, Map, Calendar, Copy, CheckCircle,
  AlertTriangle, Eye, RefreshCw, FileCode, Zap, Layers, BarChart2, Activity, Info, AlertCircle
} from 'lucide-react';
import { renderMarkdown } from '../../utils/markdownRenderer';

// Dynamic Browser-based PDFJS Script Loader
const loadPdfJs = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = (err) => reject(new Error("Failed to load pdf.js script: " + err.message));
    document.head.appendChild(script);
  });
};

function normalizeTopic(text){
   let cleaned = text.trim();
   cleaned = cleaned
      .replace(/^\d+\./,"") 
      .replace(/^chapter\s+\d+/i,"")
      .replace(/^[ivx]+\./i,"") // Roman numerals support
      .trim();

   return cleaned
      .replace(/^(studying|learning|topic)\s*:/i,"")
      .split(":")[0]
      .trim()
      .replace(/\s+/g," ")
      .toLowerCase();
}

function deduplicateTopics(rawTopics){
   const seen=new Set();
   return rawTopics.filter(topic=>{
      const normalized=normalizeTopic(topic);
      if(seen.has(normalized))
          return false;
      seen.add(normalized);
      return true;
   });
}

function cleanChapterLine(line) {
  let cleaned = line.trim();

  // Remove trailing page numbers, dots, and separators
  cleaned = cleaned
    .replace(/\s*\.*\s*\d+$/, "") // Remove dots and page number at the end
    .replace(/\s*[\.\•\-:_|]+$/, "") // Remove trailing symbols/separators
    .trim();

  // Split subtopic separators inside the same chapter and take the first part
  cleaned = cleaned.split(/[:|]/)[0].trim();

  // Remove leading prefixes and numbering
  cleaned = cleaned
    .replace(/^chapter\s+\d+/i, "")
    .replace(/^unit\s+[ivx0-9]+/i, "")
    .replace(/^\d+\./, "")
    .replace(/^\d+\s/, "")
    .replace(/^[ivx]+\./i, "")
    .replace(/^(studying|learning|topic)\s*:/i, "")
    .trim();

  // Remove leading symbols/separators
  cleaned = cleaned.replace(/^[:\-•.\s|]+/, "").trim();

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

const learnFromDeletedTopic = (title) => {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const key = `hb_deleted_learning_${user.uid}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    current.push(title.toLowerCase().trim());
    localStorage.setItem(key, JSON.stringify(current));
  } catch (e) {
    console.warn("learnFromDeletedTopic failed:", e);
  }
};

const getFutureConfidenceMultiplier = (title) => {
  try {
    const user = auth.currentUser;
    if (!user) return 1.0;
    const key = `hb_deleted_learning_${user.uid}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    const cleaned = title.toLowerCase().trim();
    
    let matches = 0;
    for (const del of current) {
      if (cleaned === del || cleaned.includes(del) || del.includes(cleaned)) {
        matches++;
      }
    }
    
    if (matches >= 2) return 0.50;
    if (matches === 1) return 0.80;
  } catch (e) {
    console.warn("getFutureConfidenceMultiplier failed:", e);
  }
  return 1.0;
};

function analyzeChapterCandidate(line, allLines = []) {
  let cleaned = line.trim();

  // Pattern detection:
  let patternType = "Unknown";
  let confidence = 0.50;

  if (/^chapter\s+\d+\s+/i.test(line)) {
    patternType = "Pattern A: Chapter prefix + Title";
    confidence = 0.85;
  } else if (/^unit\s+[ivx0-9]+\s+/i.test(line)) {
    patternType = "Pattern D: Unit prefix + Title";
    confidence = 0.85;
  } else if (/^\d+\s+/i.test(line)) {
    patternType = "Pattern B: Numbered prefix + Title";
    confidence = 0.80;
  } else if (/\.+\s*\d+$/.test(line)) {
    patternType = "Pattern E: Title with trailing page dots";
    confidence = 0.80;
  } else if (/^chapter\s+\d+$/i.test(line) || /^unit\s+[ivx0-9]+$/i.test(line)) {
    patternType = "Pattern C/D Fragmented Title";
    confidence = 0.65;
  }

  // Adjustments:
  // 1. Found in TOC page (since we extract from TOC, give it a baseline boost)
  confidence += 0.05;

  // 2. Has chapter pattern
  if (/^(chapter|unit|ch|lesson)\b/i.test(line)) {
    confidence += 0.05;
  }

  // 3. Has page reference (e.g. dots or page numbers)
  if (/\.+\s*\d+$/.test(line) || /\d+$/.test(line)) {
    confidence += 0.05;
  }

  // 4. Appears once only
  if (Array.isArray(allLines) && allLines.length > 0) {
    const occurrences = allLines.filter(l => l.trim().toLowerCase() === line.trim().toLowerCase()).length;
    if (occurrences === 1) {
      confidence += 0.05;
    }
  }

  // Decreases:
  // 1. Resembles question
  if (/^(q\d+|question|explain|what|why|how|define)/i.test(line)) {
    confidence -= 0.20;
  }

  // 2. Resembles exercise
  if (/^(exercise|problem|practice|mcq|worksheet)/i.test(line)) {
    confidence -= 0.20;
  }

  // 3. Too short
  if (cleaned.replace(/\s*\.*\s*\d+$/, "").trim().length < 5) {
    confidence -= 0.30;
  }

  // 4. Subsection numbering
  if (/\d+\.\d+/.test(line)) {
    confidence -= 0.30;
  }

  // Apply learning correction multipliers
  const multiplier = getFutureConfidenceMultiplier(cleaned);
  confidence *= multiplier;

  // Bound confidence between 0.1 and 1.0
  confidence = Math.max(0.1, Math.min(1.0, confidence));

  // Cleanup: Remove trailing page numbers, dots, and separators
  cleaned = cleaned
    .replace(/\s*\.*\s*\d+$/, "") // Remove page numbers and dots
    .replace(/\s*[\.\•\-:_|]+$/, "") // Remove trailing separators
    .trim();

  // Split on subtopic separators (colons, bars)
  cleaned = cleaned.split(/[:|]/)[0].trim();

  // Remove prefixes
  cleaned = cleaned
    .replace(/^chapter\s+\d+/i, "")
    .replace(/^unit\s+[ivx0-9]+/i, "")
    .replace(/^\d+\./, "")
    .replace(/^\d+\s/, "")
    .replace(/^[ivx]+\./i, "")
    .replace(/^(studying|learning|topic)\s*:/i, "")
    .trim();

  // Remove leading separators/symbols
  cleaned = cleaned.replace(/^[:\-•.\s|]+/, "").trim();

  // Collapse spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Filter out bad/suspicious keywords:
  const ignorePatterns = [
    /exercise/i, /question/i, /example/i, /objective/i,
    /outcome/i, /summary/i, /revision/i, /definition/i,
    /meaning/i, /significance/i, /purpose/i, /appendix/i,
    /syllabus/i, /contents/i, /index/i, /preface/i, /introduction/i
  ];

  if (ignorePatterns.some(pat => pat.test(cleaned)) || cleaned.length < 3) {
    confidence = 0.20;
  }

  const suspicious = confidence < 0.70;

  return {
    title: cleaned,
    patternType,
    confidence: Number(confidence.toFixed(2)),
    suspicious
  };
}

function calculateTOCScore(text){
  let score=0;
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const lineCount = lines.length;
  const totalWords = lines.reduce((acc, l) => acc + l.split(/\s+/).length, 0);
  const averageWordsPerLine = lineCount > 0 ? (totalWords / lineCount) : 0;

  if(/contents|table of contents|index|arrangement of study lessons/i.test(text))
     score += 10;

  if(/chapter\s+\d+/i.test(text))
     score += 5;

  if(/unit\s+[IVX0-9]+/i.test(text))
     score += 5;

  if((text.match(/\.+\s*\d+/g) || []).length >= 3)
     score += 5;

  if(lineCount > 5 && averageWordsPerLine <= 10)
     score += 5;

  if((text.match(/[.!?]\s+[A-Z]/g) || []).length > 15)
     score -= 10;

  if(/question|exercise|example|mcq|practice/i.test(text))
     score -= 15;

  return score;
}

function isTopLevelChapter(line){
  const text=line.trim();

  const validPatterns=[
    /^chapter\s+\d+\s+/i,
    /^unit\s+[IVX0-9]+\s+/i,
    /^\d+\s+[A-Za-z]/,
    /^\d+\.\s+[A-Za-z]/,
    /^[IVX0-9]+\.\s+[A-Za-z]/i,
    /^[IVX0-9]+\s+[A-Za-z]/i
  ];

  const invalidPatterns=[
    /^\d+\.\d+/,
    /^\d+\.\d+\.\d+/,
    /^q\d+/i,
    /^question/i,
    /^exercise/i,
    /^example/i,
    /^mcq/i,
    /^practice/i,
    /^objective/i,
    /^definition/i
  ];

  if(
    invalidPatterns.some(
      p=>p.test(text)
    )
  )return false;

  return validPatterns.some(
    p=>p.test(text)
  );
}

function processTopics(rawChapters){
  const seen = new Set();

  return rawChapters
    .map(chapter=>{
        let title = chapter.title
            .replace(/^[:|\-\s]+/, "")
            .replace(/\s+/g," ")
            .trim();

        const normalized = normalizeTopic(title);

        if(seen.has(normalized))
            return null;

        seen.add(normalized);

        const parts = title
            .split("|")
            .map(x=>x.trim())
            .filter(Boolean);

        let rawTitlePart = parts[0]
            .replace(/^\d+\./,"")
            .replace(/^\s*(chapter\s+\d+|[ivx]+\.)/i,"")
            .replace(/^\s*(studying|learning|topic)\s*:/i,"")
            .trim();

        const subparts = rawTitlePart.split(":");
        const cleanTitle = subparts[0].trim();
        const extraSubtopics = subparts.slice(1).map(x => x.trim()).filter(Boolean);

        return {
            title: cleanTitle,
            subtopics: [...extraSubtopics, ...parts.slice(1)],
            difficulty: chapter.difficulty || "Medium"
        };
    })
    .filter(Boolean);
}

const getConceptIcon = (iconName) => {
  const normalized = (iconName || '').toLowerCase();
  switch (normalized) {
    case 'sparkles': return <Sparkles className="w-5 h-5 text-amber-500" />;
    case 'layers': return <Layers className="w-5 h-5 text-indigo-500" />;
    case 'award': return <Award className="w-5 h-5 text-purple-500" />;
    case 'activity': return <Activity className="w-5 h-5 text-rose-500" />;
    case 'info': return <Info className="w-5 h-5 text-blue-500" />;
    case 'zap': return <Zap className="w-5 h-5 text-yellow-500" />;
    case 'bookopen':
    case 'book': return <BookOpen className="w-5 h-5 text-teal-500" />;
    case 'filecode': return <FileCode className="w-5 h-5 text-emerald-500" />;
    default: return <Sparkles className="w-5 h-5 text-blue-500" />;
  }
};

const parseAiResponse = (text) => {
  if (!text) return { cleanText: "", actions: [] };

  const nextActionsIndex = text.indexOf("Next Actions:");
  if (nextActionsIndex === -1) {
    return { cleanText: text, actions: [] };
  }

  const cleanText = text.substring(0, nextActionsIndex).trim();
  const actionsSection = text.substring(nextActionsIndex);
  
  const actions = [];
  const regex = /\[([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(actionsSection)) !== null) {
    const actionRaw = match[1];
    actions.push(actionRaw.trim());
  }

  return { cleanText, actions };
};

export default function TutorScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const state = location.state;
  const currentUser = auth.currentUser;

  // Subscription hooks state
  const { subscription, plan, isPro, hasFeatureAccess, checkLimit, incrementMetric, refreshSubscription } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Mobile Drawer states
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);

  // Tabs on Left Sidebar: 'courses' | 'workspaces' | 'history'
  const [activeLeftTab, setActiveLeftTab] = useState('courses');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Firestore streams
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  const handleCopyNotesToClipboard = (text, idx) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedNoteIndex(idx);
    setTimeout(() => setCopiedNoteIndex(null), 2000);
  };

  const workspaceId = state?.workspaceId || courseId;
  const workspace = workspaces.find(w => w.id === workspaceId) || activeWorkspace;
  const selectedCourse = state?.selectedCourse || workspace;

  // Debugging logs:
  console.log({
    currentUser,
    selectedCourse,
    workspace,
    locationState: state
  });

  // Graceful fallback redirection
  useEffect(() => {
    if (!state?.workspaceId) {
      navigate("/dashboard");
    }
  }, [state, navigate]);

  // Sync workspace state
  useEffect(() => {
    if (workspace && workspace !== activeWorkspace) {
      setActiveWorkspace(workspace);
    }
  }, [workspace, activeWorkspace]);

  // Compatibility mapping for old and new structures (Render strictly from database workspace topics)
  const topics = workspace?.finalTopics || workspace?.topics || [];

  const renderedTopics = topics;
  const usingFallback = activeWorkspace?.topicSource === "ai_generated";

  console.log("Firestore topics:", workspace?.topics);
  console.log("Local state topics:", topics);
  console.log("LocalStorage:", localStorage);
  console.log("Rendered topics:", renderedTopics);
  console.log("Using fallback:", usingFallback);

  const [topicsState, setTopicsState] = useState([]);
  const setTopics = (finalTopics) => {
    setTopicsState(finalTopics);
  };

  // Hierarchy expand states
  const [expandedCategory, setExpandedCategory] = useState('');
  const [expandedCourse, setExpandedCourse] = useState('');
  const [expandedSemester, setExpandedSemester] = useState('');

  // Active taxonomy states
  const [activeTopic, setActiveTopic] = useState('');

  // Chapter Selection States (for Note Generation)
  const [selectedChapters, setSelectedChapters] = useState({}); // { [chapterNumber]: boolean }
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // Custom Workspace Modal Form State
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceGoals, setNewWorkspaceGoals] = useState('');
  const [newWorkspaceSyllabus, setNewWorkspaceSyllabus] = useState('');
  const [newWorkspaceTopicsText, setNewWorkspaceTopicsText] = useState('');

  // Upload Simulation states
  const [uploadStep, setUploadStep] = useState(null); // null | 'uploading' | 'analyzing' | 'mapping' | 'completed'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Chat UI states
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);

  // Right Panel Goal states
  const [goalInputValue, setGoalInputValue] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [workspaceNotes, setWorkspaceNotes] = useState('');

  // Summary level selection
  const [activeSummaryLevel, setActiveSummaryLevel] = useState('Detailed Notes');

  // Unified Main Area Tab: 'cockpit' | 'notes' | 'quiz' | 'flashcards' | 'mindmap' | 'tutor'
  const [activeMainTab, setActiveMainTab] = useState('cockpit');

  // Deep Learning Mode Active Tab: 'notes' | 'quiz' | 'flashcards' | 'mindmap'
  const [deepLearningTab, setDeepLearningTab] = useState('notes');

  // Difficulty slider
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [teachingMode, setTeachingMode] = useState('doubt_solver');

  // Adaptive Learning states
  const [adaptiveData, setAdaptiveData] = useState(null);
  const [schedules, setSchedules] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoadingAdaptive, setIsLoadingAdaptive] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    
    const fetchAdaptiveData = async () => {
      setIsLoadingAdaptive(true);
      try {
        const studentId = currentUser?.uid || 'student_1';
        const subjectId = activeWorkspace.id;

        const mockQuizzes = [
          { topic: 'Process Management', score: 85 },
          { topic: 'Threads', score: 45 },
          { topic: 'Synchronization', score: 50 }
        ];
        const mockFlashcards = [
          { topic: 'Process Management', status: 'mastered', correct: true },
          { topic: 'Threads', status: 'struggling', correct: false }
        ];
        const mockSessions = [
          { timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), duration: 45, mode: "MCQ Quizzes" },
          { timestamp: new Date(Date.now() - 3600000 * 48).toISOString(), duration: 60, mode: "Study Notes Reading" }
        ];

        const recs = await adaptiveLearningService.generateAdaptiveRecommendations(
          studentId,
          subjectId,
          topics,
          mockQuizzes,
          mockFlashcards,
          mockSessions
        );

        const scheds = adaptiveLearningService.createSchedules(
          studentId,
          subjectId,
          topics,
          "2026-12-15"
        );

        const an = adaptiveLearningService.getAnalytics(
          studentId,
          subjectId,
          topics,
          mockQuizzes,
          mockSessions
        );

        setAdaptiveData(recs);
        setSchedules(scheds);
        setAnalyticsData(an);
      } catch (err) {
        console.error("Fetch adaptive learning data failed:", err);
      } finally {
        setIsLoadingAdaptive(false);
      }
    };

    fetchAdaptiveData();
  }, [activeWorkspace, topics, currentUser]);

  // Interactive states for generated quiz/flashcards inside Notes Panel
  const [notesQuizState, setNotesQuizState] = useState({ currentQuestionIndex: 0, score: 0, answers: {}, showExplanation: false });
  const [notesFlashcardState, setNotesFlashcardState] = useState({ currentCardIndex: 0, isFlipped: false });
  const [isSectionMenuCollapsed, setIsSectionMenuCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Onboarding & Beta feedback states
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem("hyperbrain_onboarding_completed"));
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState('bug_report');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);

  const onboardingSteps = [
    {
      title: "Welcome to HyperBrain Private Beta 🚀",
      desc: "Get ready to experience the world's most advanced AI-powered academic learning engine. We customize your study path automatically."
    },
    {
      title: "Choose Your Goal Selection 🎯",
      desc: "Tell us what you are preparing for so our Adaptive Learning Engine can custom-tailor recommendations:",
      options: ["Master College Semesters", "ACE High School Board Exams", "Target Placement Coding Tests"]
    },
    {
      title: "Active Learning Outlines 📚",
      desc: "Our Learning Graph connects units and chapters. You can mark chapters complete directly on your cockpit outline checklist."
    },
    {
      title: "Dynamic AI Tutor 2.0 🧠",
      desc: "Enjoy Socratic chats in Explain Simply, Professor Mode, or Doubt Solver. The Tutor inserts interactive actions right in your conversation feed."
    },
    {
      title: "Performance Optimizations ⚡",
      desc: "Every AI prompt runs under our cost-optimizing request deduplication and multi-level caching wrapper, bringing response speeds to sub-milliseconds!"
    }
  ];

  const handleNextOnboarding = () => {
    if (onboardingStep < onboardingSteps.length - 1) {
      setOnboardingStep(prev => prev + 1);
    } else {
      localStorage.setItem("hyperbrain_onboarding_completed", "true");
      setShowOnboarding(false);
    }
  };

  const handleSkipOnboarding = () => {
    localStorage.setItem("hyperbrain_onboarding_completed", "true");
    setShowOnboarding(false);
  };

  const handleReplayOnboarding = () => {
    setOnboardingStep(0);
    setShowOnboarding(true);
  };

  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim()) return;
    setIsFeedbackSubmitting(true);
    try {
      const studentId = currentUser?.uid || 'student_1';
      await betaLaunchService.submitFeedback(studentId, feedbackType, feedbackMessage, {
        workspaceId: activeWorkspace?.id || 'none',
        currentPage: activeMainTab
      });
      alert("Thank you! Your feedback has been safely submitted to the Admin Panel.");
      setFeedbackMessage('');
      setShowFeedbackModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const handleUpgradeToPlan = async (targetPlanId) => {
    if (!currentUser) return;
    try {
      const currentSub = subscription || { userId: currentUser.uid, usage: {} };
      const updatedSub = {
        ...currentSub,
        planId: targetPlanId,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      await subscriptionService.saveSubscription(currentUser.uid, updatedSub);
      alert(`Successfully upgraded to ${targetPlanId === 'student_pro' ? 'Student Pro' : 'Student Pro+'}!`);
      setShowUpgradeModal(false);
      refreshSubscription();
    } catch (e) {
      console.error(e);
    }
  };

  // Interactive Notes Section Accordions
  const [openSections, setOpenSections] = useState({
    overview: true,
    definition: true,
    keyConcepts: true,
    formula: true,
    detailed: true,
    visual: true,
    realLife: true,
    mistakes: true,
    memoryTrick: true,
    examFocus: true,
    tutorQuestions: true,
    summaryPoints: true
  });

  const [openDetailedSub, setOpenDetailedSub] = useState({
    what: true,
    why: false,
    how: false,
    importance: false,
    advantages: false,
    disadvantages: false,
    applications: false
  });

  // Interactive UI widget states for Chat Bubbles
  const [quizStates, setQuizStates] = useState({});
  const [flashcardStates, setFlashcardStates] = useState({});
  const [copiedNoteIndex, setCopiedNoteIndex] = useState(null);

  // Stream data from Firestore on mount
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
        return;
      }

      // Stream user workspaces
      const wsRef = collection(db, 'users', user.uid, 'workspaces');
      const q = query(wsRef, orderBy('updatedAt', 'desc'));
      const unsubWorkspaces = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setWorkspaces(fetched);

        // Auto-select first workspace
        if (fetched.length > 0 && !activeWorkspace) {
          const savedWsId = localStorage.getItem('hb_active_workspace_id');
          const matched = fetched.find(w => w.id === savedWsId) || fetched[0];
          setActiveWorkspace(matched);
          setWorkspaceNotes(matched.notes || '');
        }
      }, (err) => {
        console.warn("Workspaces Firestore sync failed, fallback to local:", err);
        const local = JSON.parse(localStorage.getItem(`hb_workspaces_${user.uid}`) || '[]');
        setWorkspaces(local);
        if (local.length > 0 && !activeWorkspace) {
          setActiveWorkspace(local[0]);
          setWorkspaceNotes(local[0].notes || '');
        }
      });

      // Stream user chats
      const chatsRef = collection(db, 'users', user.uid, 'chats');
      const qChats = query(chatsRef, orderBy('updatedAt', 'desc'));
      const unsubChats = onSnapshot(qChats, (snapshot) => {
        const fetchedChats = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setChats(fetchedChats);
      });

      return () => {
        unsubWorkspaces();
        unsubChats();
      };
    });

    return () => unsubAuth();
  }, [navigate]);

  // Sync active workspace selection
  useEffect(() => {
    if (!activeWorkspace) {
      setMessages([]);
      setActiveChat(null);
      setSelectedChapters({});
      return;
    }

    localStorage.setItem('hb_active_workspace_id', activeWorkspace.id);
    setWorkspaceNotes(activeWorkspace.notes || '');

    // Reset notes quiz/flashcards states
    setNotesQuizState({ currentQuestionIndex: 0, score: 0, answers: {}, showExplanation: false });
    setNotesFlashcardState({ currentCardIndex: 0, isFlipped: false });
    setActiveMainTab('cockpit');

    // Initialize all chapters selected by default
    const initChapters = {};
    topics.forEach((t, index) => {
      const chNum = t.chapterNumber || t.chapter_number || (index + 1);
      initChapters[chNum] = true;
    });
    setSelectedChapters(initChapters);

    // Sync chat logs
    const user = auth.currentUser;
    if (!user) return;

    const wsChat = chats.find(c => c.workspaceId === activeWorkspace.id);
    if (wsChat) {
      setActiveChat(wsChat);
      setMessages(wsChat.messages || []);
    } else {
      setActiveChat(null);
      setMessages([]);
    }
  }, [activeWorkspace, chats]);

  // Scroll chat feed
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Search Engine
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const queryLower = searchQuery.toLowerCase();
    const results = [];

    // Search Taxonomy
    Object.entries(INDIAN_EDUCATION_DATA).forEach(([category, courses]) => {
      Object.entries(courses).forEach(([course, semesters]) => {
        Object.entries(semesters).forEach(([semester, subjects]) => {
          Object.entries(subjects).forEach(([subject, topics]) => {
            if (subject.toLowerCase().includes(queryLower) || 
                semester.toLowerCase().includes(queryLower) || 
                course.toLowerCase().includes(queryLower)) {
              results.push({
                type: 'course',
                title: `${course} - ${semester} - ${subject}`,
                subtitle: `Predefined Course syllabus`,
                category,
                course,
                semester,
                subject,
                topics
              });
            }
            topics.forEach(topic => {
              if (topic.toLowerCase().includes(queryLower)) {
                results.push({
                  type: 'topic',
                  title: topic,
                  subtitle: `Topic in ${course} - ${subject}`,
                  category,
                  course,
                  semester,
                  subject,
                  topic,
                  topics
                });
              }
            });
          });
        });
      });
    });

    // Search Workspaces
    workspaces.forEach(ws => {
      if (ws.name.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'workspace',
          title: ws.name,
          subtitle: ws.type === 'course' ? 'Standard Course Workspace' : 'Custom Study Workspace',
          workspace: ws
        });
      }
    });

    setSearchResults(results.slice(0, 10));
  }, [searchQuery, workspaces]);

  const handleSelectSearchResult = async (result) => {
    setSearchQuery('');
    setSearchResults([]);
    setIsLeftDrawerOpen(false);

    if (result.type === 'workspace') {
      setActiveWorkspace(result.workspace);
    } else {
      await activateStandardSubjectWorkspace(result.category, result.course, result.semester, result.subject, result.topics);
      if (result.type === 'topic') {
        setActiveTopic(result.topic);
      }
    }
  };

  const activateStandardSubjectWorkspace = async (category, course, semester, subject, topicsList) => {
    const user = auth.currentUser;
    if (!user) return;

    const workspaceName = `${course} - ${subject} (${semester})`;
    let existing = workspaces.find(w => w.name === workspaceName && w.type === 'course');
    if (existing) {
      setActiveWorkspace(existing);
      return;
    }

    // Creating initial chapters from standard topics
    const initialTopics = topicsList.map((title, idx) => ({
      chapterNumber: idx + 1,
      title,
      description: `Syllabus topic: ${title}.`,
      difficulty: 'Medium',
      pageRange: 'N/A',
      completed: false,
      summary: ''
    }));

    const newWs = {
      name: workspaceName,
      type: 'course',
      category,
      courseName: course,
      semester,
      subjectName: subject,
      docType: 'Syllabus',
      docConfidence: 1.0,
      topicSource: 'index_detected',
      docReasoning: 'Matched directly with official Indian Education database.',
      goals: [`Complete all topics in ${subject}`],
      syllabus: `Official Syllabus outline containing topics: ${topicsList.join(', ')}`,
      files: [],
      topics: initialTopics,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const wsRef = collection(db, 'users', user.uid, 'workspaces');
      const docRef = await addDoc(wsRef, newWs);
      const wsWithId = { id: docRef.id, ...newWs };
      setActiveWorkspace(wsWithId);
    } catch (e) {
      console.warn("Save standard workspace to Firestore failed, saving locally:", e);
      const id = 'ws_' + Date.now();
      const wsWithId = { id, ...newWs };
      const local = JSON.parse(localStorage.getItem(`hb_workspaces_${user.uid}`) || '[]');
      const updated = [wsWithId, ...local];
      localStorage.setItem(`hb_workspaces_${user.uid}`, JSON.stringify(updated));
      setWorkspaces(updated);
      setActiveWorkspace(wsWithId);
    }
  };

  const handleCreateCustomWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    const user = auth.currentUser;
    if (!user) return;

    const topicsArr = newWorkspaceTopicsText
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map((title, idx) => ({
        chapterNumber: idx + 1,
        title,
        description: `Custom topic checklist: ${title}.`,
        difficulty: 'Medium',
        pageRange: 'N/A',
        completed: false,
        summary: ''
      }));

    const newWs = {
      name: newWorkspaceName.trim(),
      type: 'custom',
      docType: 'Study notes',
      docConfidence: 0.9,
      topicSource: 'ai_generated',
      docReasoning: 'Manually defined custom learning syllabus.',
      goals: newWorkspaceGoals.trim() ? newWorkspaceGoals.split('\n').filter(g => g.trim().length > 0) : ['Review custom materials'],
      syllabus: newWorkspaceSyllabus.trim() || 'Custom study syllabus details.',
      files: [],
      topics: topicsArr,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const wsRef = collection(db, 'users', user.uid, 'workspaces');
      const docRef = await addDoc(wsRef, newWs);
      const wsWithId = { id: docRef.id, ...newWs };
      setActiveWorkspace(wsWithId);
      setIsNewWorkspaceModalOpen(false);
      setNewWorkspaceName('');
      setNewWorkspaceGoals('');
      setNewWorkspaceSyllabus('');
      setNewWorkspaceTopicsText('');
    } catch (e) {
      console.warn("Save custom workspace failed, saving local:", e);
      const id = 'ws_' + Date.now();
      const wsWithId = { id, ...newWs };
      const local = JSON.parse(localStorage.getItem(`hb_workspaces_${user.uid}`) || '[]');
      const updated = [wsWithId, ...local];
      localStorage.setItem(`hb_workspaces_${user.uid}`, JSON.stringify(updated));
      setWorkspaces(updated);
      setActiveWorkspace(wsWithId);
      setIsNewWorkspaceModalOpen(false);
    }
  };

  // PDF Document Classifier & Chapters Extractor with Dynamic pdf.js Browser Parsing
  const handlePdfUploadToWorkspace = async (e) => {
    console.log("UPLOAD STARTED");

    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return;

    // Clear stale local caches
    setTopics([]);
    localStorage.removeItem("topics");
    sessionStorage.removeItem("topics");
    localStorage.removeItem("workspaceTopics");
    sessionStorage.removeItem("workspaceTopics");

    // Purge other cached lists
    localStorage.removeItem("cachedTopics");
    localStorage.removeItem("generatedTopics");
    localStorage.removeItem("workspaceCache");
    localStorage.removeItem("documentOutline");
    sessionStorage.clear();

    setUploadedFileName(file.name);
    setUploadProgress(0);
    setIsUploadingPdf(true);
    setUploadStep('uploading');

    let pdfText = "";
    let extractedIndex = [];
    let topics = [];
    let workspaceId = "";
    let classification = "Textbook";
    let confidence = 0.95;
    let topicSource = "PDF_INDEX";
    let reasoning = "Extracted exact index structures from document context.";
    let indexPages = [];


    const extractDocumentTopics = async () => {
      // 1. Load pdfjs-dist dynamically
      const pdfjs = await loadPdfJs();
      
      // 2. Read array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // 3. Load pdf document
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      
      setUploadStep('analyzing');
      setUploadProgress(50);

      // STEP 1: Extract page text page-by-page.
      const pages = [];
      const maxPagesToSearch = Math.min(pdfDoc.numPages, 40);
      let tocStarted = false;
      let contentPageCount = 0;
      const tocPages = [];

      for (let pageNum = 1; pageNum <= maxPagesToSearch; pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Reconstruct line boundaries using a 4px Y-coordinate tolerance to handle baseline fluctuations
          const itemsByY = {};
          for (const item of textContent.items) {
            if (item.str === undefined || !item.str.trim()) continue;
            const y = item.transform ? Math.round(item.transform[5]) : 0;
            let foundY = null;
            for (const registeredY of Object.keys(itemsByY)) {
              if (Math.abs(Number(registeredY) - y) <= 4) {
                foundY = registeredY;
                break;
              }
            }
            if (foundY !== null) {
              itemsByY[foundY].push(item);
            } else {
              itemsByY[y] = [item];
            }
          }
          
          // Sort lines top-to-bottom and horizontally left-to-right
          const sortedY = Object.keys(itemsByY).map(Number).sort((a, b) => b - a);
          let pageText = "";
          for (const y of sortedY) {
            const lineItems = itemsByY[y].sort((a, b) => {
              const ax = a.transform ? a.transform[4] : 0;
              const bx = b.transform ? b.transform[4] : 0;
              return ax - bx;
            });
            pageText += lineItems.map(item => item.str).join(" ") + "\n";
          }

          const lines = pageText.split("\n").map(l => l.trim()).filter(Boolean);
          const lineCount = lines.length;
          const totalWords = lines.reduce((acc, l) => acc + l.split(/\s+/).length, 0);
          const averageWordsPerLine = lineCount > 0 ? (totalWords / lineCount) : 0;

          const pageObj = { 
            pageNumber: pageNum, 
            text: pageText,
            lineCount: lineCount,
            averageWordsPerLine: averageWordsPerLine
          };
          pages.push(pageObj);

          // TOC state logic:
          const isTOCPage = calculateTOCScore(pageText) >= 10;
          if (isTOCPage) {
            tocStarted = true;
            tocPages.push(pageObj);
            continue;
          }

          if (tocStarted) {
            const contentSignals = [
              /definition\s*:/i,
              /exercise\s*\d*/i,
              /question\s*\d*/i,
              /mcq/i,
              /example/i
            ];

            const detected = contentSignals.some(pattern => pattern.test(pageText));
            if (detected) {
              contentPageCount++;
              if (contentPageCount >= 2) {
                console.log("TOC ended");
                break;
              }
            } else {
              contentPageCount = 0;
              tocPages.push(pageObj);
            }
          }
        } catch (pageErr) {
          console.warn(`Failed to extract page ${pageNum}:`, pageErr);
        }
      }

      if (tocPages.length === 0) {
        console.log("No TOC detected — fallback");
        tocPages.push(...pages.slice(0, 3));
      }

      setUploadStep('mapping');
      setUploadProgress(80);

      // STEP 2 & 3: Score each page and select TOC pages
      const scores = pages.map(p => ({
        pageNumber: p.pageNumber,
        score: calculateTOCScore(p.text)
      }));

      pdfText = tocPages.map(p => p.text).join("\n");

      // STEP 5: Ignore invalid patterns
      const ignoredItems = [];
      const candidateLines = [];
      const ignoreRegex = /^(Q\d+|Exercise|MCQ|Example|Practice)/i;
      const shortNumericRegex = /^\d+$/;

      tocPages.forEach(p => {
        let lines = [];
        p.text.split("\n").forEach(rawLine => {
          if (/\s{4,}/.test(rawLine)) {
            const parts = rawLine.split(/\s{4,}/).map(pt => pt.trim()).filter(Boolean);
            if (parts.length >= 2 && parts.every(pt => pt.length > 3)) {
              lines.push(...parts);
              return;
            }
          }
          lines.push(rawLine.trim());
        });

        // STEP 6: Merge multi-line chapter titles
        let i = 0;
        while (i < lines.length) {
          let current = lines[i].trim();
          if (!current) {
            i++;
            continue;
          }

          // Step 5 filter
          if (ignoreRegex.test(current) || shortNumericRegex.test(current)) {
            ignoredItems.push(current);
            i++;
            continue;
          }

          // Look ahead to see if subsequent lines should be merged
          while (i + 1 < lines.length) {
            let next = lines[i+1].trim();
            if (!next) {
              i++;
              continue;
            }

            const nextIsPrefix = /^(chapter\s+\d+|unit\s+[ivx0-9]+|\d+\.|\d+\s)/i.test(next);
            const nextIsPageNum = /^\d+$/.test(next);
            const currentEndsWithConjunction = /(and|of|for|in|on|with|to|the|a|an)$/i.test(current);
            
            if (nextIsPageNum) {
              current = `${current} ${next}`;
              i++;
              break;
            }

            const isJustPrefix = /^(chapter\s+\d+|unit\s+[ivx0-9]+|\d+\.|\d+)$/i.test(current);
            if (isJustPrefix && !nextIsPrefix) {
              current = `${current} ${next}`;
              i++;
              continue;
            }

            if ((currentEndsWithConjunction || (!nextIsPrefix && /^[A-Z]/.test(next))) && !ignoreRegex.test(next)) {
              current = `${current} ${next}`;
              i++;
              continue;
            }

            break;
          }

          candidateLines.push(current);
          i++;
        }
      });

      // Cleanup & Deduplicate
      const seen = new Set();
      const chaptersList = [];
      let totalConfidence = 0;

      candidateLines.filter(isTopLevelChapter).forEach(line => {
        if (/^page\s+\d+$/i.test(line) || /^\d+$/i.test(line)) {
          ignoredItems.push(line);
          return;
        }

        const isGood = /^(chapter\s+\d+|unit\s+[ivx0-9]+|\d+\.|\d+\s)/i.test(line) || /.+\s*\.*\s*\d+$/.test(line);
        if (!isGood) return;

        const analysis = analyzeChapterCandidate(line, candidateLines);
        const normalized = analysis.title.toLowerCase().trim().replace(/\s+/g, " ");

        if (analysis.confidence >= 0.50 && analysis.title.length > 3) {
          if (!seen.has(normalized)) {
            seen.add(normalized);
            chaptersList.push(analysis);
            totalConfidence += analysis.confidence;
          }
        } else {
          ignoredItems.push(line);
        }
      });

      // STEP 7 & 8: Validation layer & Confidence score
      let confidence = chaptersList.length > 0 ? (totalConfidence / chaptersList.length) : 0.95;
      const hasSuspiciousLength = chaptersList.length < 3 || chaptersList.length > 50;
      const suspiciousKeywords = ["definition", "question", "exercise", "example"];
      const hasSuspiciousKeywords = chaptersList.some(ch =>
        suspiciousKeywords.some(kw => ch.title.toLowerCase().includes(kw))
      );

      if (hasSuspiciousLength || hasSuspiciousKeywords) {
        confidence = 0.60;
      }

      if (chaptersList.length > 0 && confidence < 0.75) {
        alert("We detected multiple document structures. Please verify extracted chapters.");
      }

      // STEP 11 Logs
      let detectedPattern = chaptersList.length > 0 ? (chaptersList[0].patternType || "Pattern A") : "Unknown";
      console.log("TOC pages:", tocPages.map(p => p.pageNumber));
      console.log("Pattern detected:", detectedPattern);
      console.log("Confidence:", confidence);
      console.log("Final chapters:", chaptersList.map(c => c.title));

      if (chaptersList.length > 0) {
        const rawChapters = chaptersList.map(item => ({
          title: item.title,
          difficulty: "Medium"
        }));
        const processedTopics = processTopics(rawChapters).map((item, idx) => ({
          chapterNumber: idx + 1,
          title: item.title,
          subtopics: item.subtopics,
          description: `Chapter ${idx + 1}: ${item.title}.`,
          difficulty: item.difficulty || "Medium",
          pageRange: "N/A",
          completed: false,
          summary: ''
        }));

        setTopics(processedTopics);
        extractedIndex = processedTopics;
      }
    };

    const generateTopicsWithAI = async () => {
      // Fallback to AI document classifier if no table of contents matched client-side
      const extraction = await aiService.classifyAndExtractDocument(file.name, file.size, pdfText);
      if (extraction && typeof extraction === 'object' && extraction.success === false) {
        alert("AI service temporarily unavailable. Retrying...");
        throw new Error("AI service temporarily unavailable. Retrying...");
      }
      classification = extraction.classification || "Textbook";
      confidence = extraction.confidence || 0.95;
      topicSource = extraction.topicSource || "ai_generated";
      reasoning = extraction.reasoning || "AI analyzed context.";
      
      extractedIndex = (extraction.chapters || []).map((ch, idx) => ({
        chapterNumber: ch.chapterNumber || ch.chapter_number || (idx + 1),
        title: ch.title,
        description: ch.description || 'Extracted textbook module.',
        difficulty: ch.difficulty || 'Medium',
        pageRange: ch.pageRange || 'N/A',
        completed: false,
        summary: ''
      }));
    };

    const createWorkspace = async () => {
      console.log("UPLOAD START");
      const workspaceName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      
      const newWs = {
        name: workspaceName,
        type: 'custom',
        docType: "Textbook",
        docConfidence: 0.95,
        topicSource: "ai_generated",
        source: "empty",
        docReasoning: "Workspace created, waiting for extraction pipeline.",
        goals: [`Master chapters of: ${workspaceName}`, `Complete MCQs & Quizzes for study plan`],
        syllabus: "",
        files: [{ name: file.name, uploadedAt: new Date().toISOString() }],
        topics: [],
        documentOutline: {
          source: "pdf-index",
          extracted: false,
          chapters: []
        },
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        const wsRef = collection(db, 'users', user.uid, 'workspaces');
        const docRef = await addDoc(wsRef, newWs);
        workspaceId = docRef.id;
        console.log("WORKSPACE CREATED", workspaceId);
      } catch (e) {
        console.warn("Save workspace failed, creating local:", e);
        workspaceId = 'ws_' + Date.now();
        const wsWithId = { id: workspaceId, ...newWs };
        const local = JSON.parse(localStorage.getItem(`hb_workspaces_${user.uid}`) || '[]');
        const updated = [wsWithId, ...local];
        localStorage.setItem(`hb_workspaces_${user.uid}`, JSON.stringify(updated));
        setWorkspaces(updated);
        console.log("WORKSPACE CREATED LOCALLY", workspaceId);
      }
    };

    const saveWorkspace = async (updatedFields) => {
      if (!workspaceId) return;

      const fieldsToSave = { ...updatedFields };
      if (updatedFields.topics) {
        fieldsToSave.finalTopics = updatedFields.topics;
      }

      try {
        if (!workspaceId.startsWith('ws_')) {
          const wsDocRef = doc(db, 'users', user.uid, 'workspaces', workspaceId);
          await updateDoc(wsDocRef, fieldsToSave);
        } else {
          const local = JSON.parse(localStorage.getItem(`hb_workspaces_${user.uid}`) || '[]');
          const idx = local.findIndex(ws => ws.id === workspaceId);
          if (idx !== -1) {
            local[idx] = { ...local[idx], ...fieldsToSave };
            localStorage.setItem(`hb_workspaces_${user.uid}`, JSON.stringify(local));
            setWorkspaces(local);
          }
        }
        console.log("WORKSPACE UPDATED", fieldsToSave);
      } catch (e) {
        console.error("Failed to update workspace:", e);
      }
    };

    const refetchWorkspace = async () => {
      if (!workspaceId) return;
      if (workspaceId.startsWith('ws_')) {
        const local = JSON.parse(localStorage.getItem(`hb_workspaces_${user.uid}`) || '[]');
        const wsData = local.find(ws => ws.id === workspaceId);
        if (wsData) {
          setActiveWorkspace(wsData);
        }
        return;
      }
      const wsDocRef = doc(db, 'users', user.uid, 'workspaces', workspaceId);
      const snapshot = await getDoc(wsDocRef);
      if (snapshot.exists()) {
        const wsData = { id: snapshot.id, ...snapshot.data() };
        setActiveWorkspace(wsData);
      }
    };

    try {
      await createWorkspace();

      try {
        await extractDocumentTopics();
        console.log("TEXT EXTRACTED");

        if (extractedIndex && extractedIndex.length > 0) {
          console.log("TOC found chapters:", extractedIndex);
          const updatedFields = {
            topics: extractedIndex,
            topicSource: "PDF_INDEX",
            source: "toc",
            docConfidence: 0.95,
            docReasoning: "Extracted exact index structures from Table of Contents.",
            syllabus: `Classification: Textbook (Confidence: 0.95)\nSource: PDF_INDEX\nReasoning: Extracted exact index structures from Table of Contents.`,
            documentOutline: {
              source: "pdf-index",
              extracted: true,
              chapters: extractedIndex
            },
            updatedAt: new Date().toISOString()
          };
          await saveWorkspace(updatedFields);
        } else {
          console.log("TOC not found or failed validation. Running fallback...");
          await generateTopicsWithAI();
          console.log("FALLBACK AI USED");

          const updatedFields = {
            topics: extractedIndex,
            topicSource: topicSource,
            source: "fallback",
            docType: classification,
            docConfidence: confidence,
            docReasoning: reasoning,
            syllabus: `Classification: ${classification} (Confidence: ${confidence})\nSource: ${topicSource}\nReasoning: ${reasoning}`,
            documentOutline: {
              source: "pdf-index",
              extracted: false,
              chapters: extractedIndex
            },
            updatedAt: new Date().toISOString()
          };
          await saveWorkspace(updatedFields);
        }
      } catch (extractErr) {
        console.error("Extraction failed, falling back to empty topics:", extractErr);
        const updatedFields = {
          topics: [],
          topicSource: "ai_generated",
          source: "empty",
          docReasoning: "TOC and fallback extraction failed.",
          updatedAt: new Date().toISOString()
        };
        await saveWorkspace(updatedFields);
      }

      await refetchWorkspace();
      console.log("UPLOAD COMPLETE");

      setUploadStep('completed');
      setUploadProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      setUploadStep('completed');
      setUploadProgress(100);
    } finally {
      setIsUploadingPdf(false);
      setUploadStep(null);
      setUploadProgress(0);
      setIsNewWorkspaceModalOpen(false);
    }
  };

  const handleDeleteWorkspace = async (workspaceId, e) => {
    e.stopPropagation();
    const user = auth.currentUser;
    if (!user) return;

    if (!window.confirm("Are you sure you want to delete this workspace? This will purge its topics and chats.")) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'workspaces', workspaceId));
      const relatedChat = chats.find(c => c.workspaceId === workspaceId);
      if (relatedChat) {
        await deleteDoc(doc(db, 'users', user.uid, 'chats', relatedChat.id));
      }

      if (activeWorkspace?.id === workspaceId) {
        const remaining = workspaces.filter(w => w.id !== workspaceId);
        setActiveWorkspace(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err) {
      console.warn("Delete workspace failed, removing local cache:", err);
      const remaining = workspaces.filter(w => w.id !== workspaceId);
      localStorage.setItem(`hb_workspaces_${user.uid}`, JSON.stringify(remaining));
      setWorkspaces(remaining);
      if (activeWorkspace?.id === workspaceId) {
        setActiveWorkspace(remaining.length > 0 ? remaining[0] : null);
      }
    }
  };

  const updateWorkspaceDetails = async (updatedFields) => {
    if (!activeWorkspace) return;
    const user = auth.currentUser;
    if (!user) return;

    const fieldsToSave = { ...updatedFields };
    if (updatedFields.topics) {
      fieldsToSave.finalTopics = updatedFields.topics;
    }

    try {
      if (!activeWorkspace.id.startsWith('ws_')) {
        const wsDocRef = doc(db, 'users', user.uid, 'workspaces', activeWorkspace.id);
        await updateDoc(wsDocRef, fieldsToSave);
      } else {
        const local = JSON.parse(localStorage.getItem(`hb_workspaces_${user.uid}`) || '[]');
        const idx = local.findIndex(ws => ws.id === activeWorkspace.id);
        if (idx !== -1) {
          local[idx] = { ...local[idx], ...fieldsToSave };
          localStorage.setItem(`hb_workspaces_${user.uid}`, JSON.stringify(local));
          setWorkspaces(local);
        }
      }
      setActiveWorkspace(prev => ({ ...prev, ...fieldsToSave }));
      console.log("WORKSPACE DETAILS UPDATED", fieldsToSave);
    } catch (e) {
      console.error("Failed to update workspace:", e);
    }
  };

  const handleDeleteTopic = async (idx) => {
    if (!activeWorkspace) return;
    const currentTopics = activeWorkspace.finalTopics || activeWorkspace.topics || [];
    const topicToDelete = currentTopics[idx];
    if (topicToDelete) {
      learnFromDeletedTopic(topicToDelete.title);
    }
    const updatedTopics = currentTopics.filter((_, i) => i !== idx);
    const renumbered = updatedTopics.map((t, i) => ({ ...t, chapterNumber: i + 1 }));
    await updateWorkspaceDetails({ topics: renumbered });
  };

  const handleEditTopic = async (idx, newTitle) => {
    if (!activeWorkspace || !newTitle.trim()) return;
    const currentTopics = activeWorkspace.finalTopics || activeWorkspace.topics || [];
    const updatedTopics = [...currentTopics];
    updatedTopics[idx].title = newTitle.trim();
    await updateWorkspaceDetails({ topics: updatedTopics });
  };

  const handleAddTopic = async (title) => {
    if (!activeWorkspace || !title.trim()) return;
    const currentTopics = activeWorkspace.finalTopics || activeWorkspace.topics || [];
    const chNum = currentTopics.length + 1;
    const newTopic = {
      chapterNumber: chNum,
      title: title.trim(),
      description: `Topic ${chNum}: ${title.trim()}`,
      difficulty: "Medium",
      pageRange: "N/A",
      completed: false,
      summary: "",
      confidence: 1.0,
      suspicious: false
    };
    const updatedTopics = [...currentTopics, newTopic];
    await updateWorkspaceDetails({ topics: updatedTopics });
  };

  const handleRegenerateTopics = async () => {
    if (!activeWorkspace) return;
    const fileName = activeWorkspace.files?.[0]?.name || "Document";
    setIsUploadingPdf(true);
    setUploadStep('analyzing');
    try {
      const documentContent = activeWorkspace.notes || "";
      const extraction = await aiService.classifyAndExtractDocument(fileName, 0, documentContent);
      if (extraction && typeof extraction === 'object' && extraction.success === false) {
        alert("AI service temporarily unavailable. Retrying...");
        throw new Error("AI service temporarily unavailable. Retrying...");
      }
      const generated = (extraction.chapters || []).map((ch, idx) => ({
        chapterNumber: idx + 1,
        title: ch.title,
        description: ch.description || 'Extracted textbook module.',
        difficulty: ch.difficulty || 'Medium',
        pageRange: ch.pageRange || 'N/A',
        completed: false,
        summary: '',
        confidence: ch.confidence || 0.95,
        suspicious: (ch.confidence || 0.95) < 0.70
      }));
      await updateWorkspaceDetails({ topics: generated, topicSource: "ai_generated", source: "fallback" });
    } catch (e) {
      console.error(e);
      alert("Failed to regenerate topics.");
    } finally {
      setIsUploadingPdf(false);
      setUploadStep(null);
    }
  };

  const handleAskTutor = (questionText) => {
    setInputValue(`Regarding the topic "${activeWorkspace?.subject_name || 'this subject'}", please explain this: ${questionText}`);
    setActiveMainTab('tutor');
  };

  const scrollToSection = (secId) => {
    setOpenSections(prev => ({ ...prev, [secId]: true }));
    setTimeout(() => {
      const el = document.getElementById(`notes-sec-${secId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Chapter Checkbox Selection controls
  const handleToggleChapterSelection = (chapterNumber) => {
    setSelectedChapters(prev => ({
      ...prev,
      [chapterNumber]: !prev[chapterNumber]
    }));
  };

  const handleToggleSelectAllChapters = (isChecked) => {
    const updated = {};
    (topics || []).forEach((t, idx) => {
      const chNum = t.chapterNumber || t.chapter_number || (idx + 1);
      updated[chNum] = isChecked;
    });
    setSelectedChapters(updated);
  };

  // Topic Completion status toggle
  const handleToggleTopicCompleted = async (topicIdx) => {
    if (!activeWorkspace) return;
    const user = auth.currentUser;
    if (!user) return;

    const updatedTopics = [...topics];
    updatedTopics[topicIdx] = {
      ...updatedTopics[topicIdx],
      completed: !updatedTopics[topicIdx].completed
    };

    const wsRef = doc(db, 'users', user.uid, 'workspaces', activeWorkspace.id);
    try {
      await updateDoc(wsRef, {
        topics: updatedTopics,
        finalTopics: updatedTopics,
        updatedAt: new Date().toISOString()
      });
      setActiveWorkspace(prev => ({ ...prev, topics: updatedTopics, finalTopics: updatedTopics }));
    } catch (e) {
      console.warn("Update topic completed failed:", e);
    }
  };

  // Deep Note Generation call
  const handleGenerateUpgradedStudyNotes = async () => {
    if (!activeWorkspace) return;

    const user = auth.currentUser;
    if (!user) return;

    // Purge cached storage files
    localStorage.removeItem("generatedTopics");
    localStorage.removeItem("workspaceCache");
    localStorage.removeItem("documentOutline");
    sessionStorage.clear();

    // Delete outdated fields in Firestore
    try {
      const wsRef = doc(db, 'users', user.uid, 'workspaces', activeWorkspace.id);
      await updateDoc(wsRef, {
        generatedTopics: deleteField(),
        aiTopics: deleteField(),
        cachedOutline: deleteField(),
        documentOutline: deleteField()
      });
    } catch (e) {
      console.warn("Purge firestore caching values failed:", e);
    }

    // Filter selected chapters objects
    const selectedList = (topics || []).filter((t, idx) => {
      const chNum = t.chapterNumber || t.chapter_number || (idx + 1);
      return selectedChapters[chNum] === true;
    });

    if (selectedList.length === 0) {
      alert("Please select at least one chapter/topic in the Left Panel checkbox list!");
      return;
    }

    setIsGeneratingNotes(true);
    try {
      const generatedContent = await aiService.generateUpgradedNotes(
        activeWorkspace.subjectName || activeWorkspace.subject_name || "General Education", 
        selectedList, 
        activeSummaryLevel,
        {
          bookName: activeWorkspace.name || "",
          syllabus: activeWorkspace.syllabus || "",
          goals: activeWorkspace.goals || []
        }
      );

      if (generatedContent && typeof generatedContent === 'object' && generatedContent.success === false) {
        alert("AI service temporarily unavailable. Retrying...");
        setIsGeneratingNotes(false);
        return;
      }

      // Save generated notes to Firestore workspace document
      const wsRef = doc(db, 'users', user.uid, 'workspaces', activeWorkspace.id);
      await updateDoc(wsRef, {
        notes: generatedContent,
        updatedAt: new Date().toISOString()
      });

      setActiveWorkspace(prev => ({
        ...prev,
        notes: generatedContent
      }));

      // Reset notes quiz/flashcards states
      setNotesQuizState({ currentQuestionIndex: 0, score: 0, answers: {}, showExplanation: false });
      setNotesFlashcardState({ currentCardIndex: 0, isFlipped: false });
      
      // Auto transition to notes view tab after generation completes
      setActiveMainTab('notes');
    } catch (err) {
      console.error(err);
      alert("Failed to generate upgraded notes: " + err.message);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Goals
  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!goalInputValue.trim() || !activeWorkspace) return;

    const user = auth.currentUser;
    if (!user) return;

    const updatedGoals = [...(activeWorkspace.goals || []), goalInputValue.trim()];
    const wsRef = doc(db, 'users', user.uid, 'workspaces', activeWorkspace.id);
    try {
      await updateDoc(wsRef, { goals: updatedGoals });
      setActiveWorkspace(prev => ({ ...prev, goals: updatedGoals }));
      setGoalInputValue('');
    } catch (err) {
      console.warn("Add goal failed:", err);
    }
  };

  const handleRemoveGoal = async (goalIdx) => {
    if (!activeWorkspace) return;
    const user = auth.currentUser;
    if (!user) return;

    const updatedGoals = (activeWorkspace.goals || []).filter((_, idx) => idx !== goalIdx);
    const wsRef = doc(db, 'users', user.uid, 'workspaces', activeWorkspace.id);
    try {
      await updateDoc(wsRef, { goals: updatedGoals });
      setActiveWorkspace(prev => ({ ...prev, goals: updatedGoals }));
    } catch (err) {
      console.warn("Remove goal failed:", err);
    }
  };

  // Notes text area update (custom editor)
  const handleSaveNotesText = async () => {
    if (!activeWorkspace) return;
    const user = auth.currentUser;
    if (!user) return;

    const wsRef = doc(db, 'users', user.uid, 'workspaces', activeWorkspace.id);
    try {
      await updateDoc(wsRef, { notes: workspaceNotes });
      setActiveWorkspace(prev => ({ ...prev, notes: workspaceNotes }));
      setIsEditingNotes(false);
    } catch (err) {
      console.warn("Save notes failed:", err);
      setIsEditingNotes(false);
    }
  };

  // Send message
  const triggerSend = async (text, fileAttachment = null) => {
    if (!activeWorkspace) return;

    const user = auth.currentUser;
    if (!user) return;

    const check = await userService.checkLimit(user.uid, 'ai_tutor');
    if (!check.allowed) {
      const resetTime = userService.getTimeUntilMidnight().formatted;
      setMessages(prev => [...prev, { role: 'ai', text: `Daily question limit reached. Reset in: ${resetTime}`, timestamp: Date.now() }]);
      return;
    }

    let userText = text;
    if (fileAttachment) {
      userText = `[File: ${fileAttachment.name}] ${text}`;
    }

    const newUserMsg = {
      role: 'user',
      text: userText,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setIsTyping(true);

    let chatDocId = activeChat?.id;
    if (!chatDocId) {
      const newChat = {
        workspaceId: activeWorkspace.id,
        title: text.substring(0, 40) || 'AI Tutor Session',
        messages: updatedMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      try {
        const chatsCollectionRef = collection(db, 'users', user.uid, 'chats');
        const docRef = await addDoc(chatsCollectionRef, newChat);
        chatDocId = docRef.id;
        setActiveChat({ id: chatDocId, ...newChat });
      } catch (err) {
        console.warn("Create chat failed:", err);
      }
    } else {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'chats', chatDocId), {
          messages: updatedMessages,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Update chat messages failed:", err);
      }
    }

    try {
      const topicsList = topics.map(t => `Chapter ${t.chapterNumber || t.chapter_number}: ${t.title}`).join(', ');
      const contextString = `
Document Title: ${activeWorkspace.name}
Document Type: ${activeWorkspace.docType}
Workspace Summary: ${activeWorkspace.syllabus || ''}
Chapters Outline: ${topicsList}
Active Topic: ${activeTopic || 'General Question'}
Current Difficulty Level preference: ${difficulty}
`;

      const progressMap = {};
      topics.forEach(t => {
        if (t.completed) {
          progressMap[t.title] = { completed: true };
          const keyNormalized = (t.title || "").toLowerCase().trim();
          progressMap[keyNormalized] = { completed: true };
        }
      });

      const richContext = {
        textContext: contextString,
        workspaceId: activeWorkspace.id,
        activeTopicId: activeTopic?.title || activeTopic || '',
        teachingMode: teachingMode,
        studentProgress: progressMap,
        difficulty: difficulty
      };

      const aiResponse = await askTutorChat(updatedMessages, richContext, difficulty);
      const newAiMsg = {
        role: 'ai',
        text: aiResponse,
        timestamp: Date.now()
      };

      const finalMessages = [...updatedMessages, newAiMsg];
      setMessages(finalMessages);

      if (chatDocId) {
        await updateDoc(doc(db, 'users', user.uid, 'chats', chatDocId), {
          messages: finalMessages,
          updatedAt: new Date().toISOString()
        });
      }

      await userService.incrementUsage(user.uid, 'ai_tutor');
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'ai', text: "Tutor error: " + err.message, timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
      setAttachedFile(null);
    }
  };

  const handleSendForm = (e) => {
    e.preventDefault();
    if (!inputValue.trim() && !attachedFile) return;
    const text = inputValue;
    setInputValue('');
    triggerSend(text, attachedFile);
  };

  const handleNextActionClick = async (actionStr) => {
    if (actionStr === "Practice Quiz") {
      setActiveMainTab('quiz');
    } else if (actionStr === "Generate Flashcards") {
      setActiveMainTab('flashcards');
    } else if (actionStr === "Mark Topic Complete") {
      if (!activeTopic || !activeWorkspace) {
        alert("Select an active topic in the taxonomy sidebar to mark it complete!");
        return;
      }
      const activeTitle = typeof activeTopic === 'object' ? activeTopic.title : activeTopic;
      const topicIdx = topics.findIndex(t => (t.title || '').toLowerCase() === activeTitle.toLowerCase());
      if (topicIdx !== -1) {
        if (!topics[topicIdx].completed) {
          await handleToggleTopicCompleted(topicIdx);
          alert(`Topic "${topics[topicIdx].title}" marked complete!`);
        } else {
          alert(`Topic "${topics[topicIdx].title}" is already complete.`);
        }
      } else {
        alert(`Cannot find active topic "${activeTitle}" in subject outline.`);
      }
    } else if (actionStr.includes("Revise Prerequisite:")) {
      const prereqTopic = actionStr.replace("Revise Prerequisite:", "").trim();
      const matchedTopic = topics.find(t => t.title.toLowerCase() === prereqTopic.toLowerCase());
      if (matchedTopic) {
        setActiveTopic(matchedTopic);
        setInputValue(`Regarding the topic "${matchedTopic.title}", please explain the core principles.`);
      } else {
        setInputValue(`Please explain the prerequisite topic: ${prereqTopic}`);
      }
    } else if (actionStr.includes("Open Related Topic:")) {
      const relatedTopic = actionStr.replace("Open Related Topic:", "").trim();
      const matchedTopic = topics.find(t => t.title.toLowerCase() === relatedTopic.toLowerCase());
      if (matchedTopic) {
        setActiveTopic(matchedTopic);
        setInputValue(`Regarding the topic "${matchedTopic.title}", what are the related concepts?`);
      } else {
        setInputValue(`Tell me more about the related topic: ${relatedTopic}`);
      }
    }
  };

  const renderActionButton = (actionStr, idx) => {
    let label = actionStr;
    let btnClass = "bg-bg-secondary hover:bg-hover-theme border border-border-theme text-primary";

    if (actionStr.includes("Revise Prerequisite:")) {
      const prereqTopic = actionStr.replace("Revise Prerequisite:", "").trim();
      label = `📚 Revise ${prereqTopic}`;
      btnClass = "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20";
    } else if (actionStr.includes("Open Related Topic:")) {
      const relatedTopic = actionStr.replace("Open Related Topic:", "").trim();
      label = `🔗 Related: ${relatedTopic}`;
      btnClass = "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20";
    } else if (actionStr === "Practice Quiz") {
      label = "📝 Practice Quiz";
      btnClass = "bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20";
    } else if (actionStr === "Generate Flashcards") {
      label = "🎴 Generate Flashcards";
      btnClass = "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20";
    } else if (actionStr === "Mark Topic Complete") {
      label = "✅ Mark Complete";
      btnClass = "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs";
    }

    return (
      <button
        key={idx}
        onClick={() => handleNextActionClick(actionStr)}
        className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all active:scale-95 flex items-center space-x-1 ${btnClass}`}
      >
        <span>{label}</span>
      </button>
    );
  };

  // Upgraded Notes Section Parser (Step 5 template support)
  const parseNotesIntoSections = (text) => {
    if (!text) return null;
    const sections = {
      title: '',
      overview: '',
      concepts: '',
      definitions: '',
      examples: '',
      examQuestions: '',
      revisionNotes: '',
      memoryTips: '',
      raw: text
    };

    // Extract title
    const titleMatch = text.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      sections.title = titleMatch[1];
    }

    const extractSectionFlexibly = (headingKeywords) => {
      const headings = text.split(/^##\s+/m);
      for (let i = 1; i < headings.length; i++) {
        const lineBreakIdx = headings[i].indexOf('\n');
        if (lineBreakIdx === -1) continue;
        const headerTitle = headings[i].substring(0, lineBreakIdx).trim().toLowerCase();
        const content = headings[i].substring(lineBreakIdx).trim();
        
        if (headingKeywords.some(keyword => headerTitle.includes(keyword.toLowerCase()))) {
          return content;
        }
      }
      return '';
    };

    sections.overview = extractSectionFlexibly(['overview', 'intro', 'explanation']);
    sections.concepts = extractSectionFlexibly(['concepts', 'principles', 'theory']);
    sections.definitions = extractSectionFlexibly(['definitions', 'vocabulary', 'glossary']);
    sections.examples = extractSectionFlexibly(['examples', 'illustrations']);
    sections.examQuestions = extractSectionFlexibly(['exam questions', 'questions', 'frequently asked']);
    sections.revisionNotes = extractSectionFlexibly(['revision notes', 'revision', 'summaries']);
    sections.memoryTips = extractSectionFlexibly(['memory tips', 'mnemonics']);

    const totalLength = sections.overview.length + 
                       sections.concepts.length + 
                       sections.definitions.length + 
                       sections.examples.length + 
                       sections.examQuestions.length + 
                       sections.revisionNotes.length + 
                       sections.memoryTips.length;
    
    if (totalLength === 0) {
      return { isRaw: true, raw: text };
    }

    return sections;
  };

  // Helper to parse deep learning JSON package in response
  const parseDeepLearningPackage = (text) => {
    if (!text) return null;
    const jsonRegex = /```json([\s\S]*?)```/g;
    const match = jsonRegex.exec(text);
    if (match && match[1]) {
      try {
        const data = JSON.parse(match[1].trim());
        if (data.type === 'deep_learning_package' || data.type === 'deep_interactive_package') {
          return data;
        }
      } catch (err) {
        return null;
      }
    }
    return null;
  };

  const parsedNotesSections = parseNotesIntoSections(activeWorkspace?.notes);
  const deepLearningPackage = parseDeepLearningPackage(activeWorkspace?.notes);

  // Chapters checklist completion calculation
  const chaptersCompletedCount = topics?.filter(t => t.completed).length || 0;
  const totalChaptersCount = topics?.length || 0;
  const progressPercent = totalChaptersCount > 0 ? Math.round((chaptersCompletedCount / totalChaptersCount) * 100) : 0;

  if (!selectedCourse || !workspace) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-xs font-black uppercase tracking-widest text-muted">Select a course or upload a document to begin</span>
      </div>
    );
  }

  return (
    <div className={`w-full bg-bg-secondary text-primary flex flex-col transition-colors duration-300 ${activeMainTab === 'notes' ? 'min-h-screen' : 'h-screen overflow-hidden'}`}>
      
      {/* card styles */}
      <style>{`
        .flashcard-inner {
          transition: transform 0.5s;
          transform-style: preserve-3d;
        }
        .flashcard-flipped {
          transform: rotateY(180deg);
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 4px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
        }
      `}</style>

      {/* TOP HEADER */}
      <header className="sticky top-0 h-16 border-b border-border-theme bg-card flex items-center justify-between px-6 flex-shrink-0 z-30 transition-colors bg-opacity-95 backdrop-blur-sm">
        <div className="flex items-center space-x-3.5">
          <button
            onClick={() => setIsLeftDrawerOpen(!isLeftDrawerOpen)}
            className="p-2 hover:bg-hover-theme rounded-xl text-muted md:hidden"
            title="Toggle Left Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-hover-theme rounded-xl text-muted transition-colors flex items-center space-x-1.5"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-accent-color" />
            <span className="text-xs font-bold hidden sm:inline">Dashboard</span>
          </button>

          <div className="h-4 w-px bg-border-color hidden sm:block" />

          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-black uppercase tracking-widest font-sans text-blue-600 dark:text-blue-400">Notes & Document AI Workspace</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {activeWorkspace && (
            <div className="hidden lg:flex items-center space-x-2 bg-blue-600/10 dark:bg-blue-600/20 px-3 py-1.5 rounded-xl border border-blue-500/20">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 truncate max-w-[200px]">
                {activeWorkspace.name}
              </span>
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-hover-theme rounded-xl text-muted"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-indigo-600" />}
          </button>

          <button
            onClick={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
            className="p-2 hover:bg-hover-theme rounded-xl text-muted lg:hidden"
            title="Toggle Right Config"
          >
            <Sliders className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* THREE-PANEL CORE BODY */}
      <div className={`flex-1 flex relative ${activeMainTab !== 'notes' ? 'overflow-hidden' : ''}`}>
        
        {/* Drawers backdrop overlay */}
        {isLeftDrawerOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[990] transition-opacity md:hidden"
            onClick={() => setIsLeftDrawerOpen(false)}
          />
        )}
        {isRightDrawerOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[990] transition-opacity lg:hidden"
            onClick={() => setIsRightDrawerOpen(false)}
          />
        )}

        {/* ========================================================================= */}
        {/* PANEL 1: LEFT SIDEBAR (Hierarchy, Custom Workspaces, Chapters Selection) */}
        {/* ========================================================================= */}
        <aside className={`fixed ${
          activeMainTab === 'notes' 
            ? 'md:sticky md:top-16 md:h-[calc(100vh-64px)]' 
            : 'md:static md:h-full'
        } left-0 bottom-0 z-[1000] md:z-10 transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-card border-r border-border-theme flex flex-col ${
          isLeftDrawerOpen ? 'w-[320px] translate-x-0' : 'w-0 -translate-x-full md:w-80 md:translate-x-0'
        }`}>
          {/* SEARCH BOX */}
          <div className="p-4 border-b border-border-theme space-y-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search BCA, CA, Probability..."
                className="w-full pl-9 pr-4 py-2 text-xs font-semibold rounded-xl border border-border-theme bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-muted">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="absolute left-4 right-4 bg-card border border-border-theme rounded-xl shadow-xl z-50 overflow-hidden max-h-64 custom-scrollbar">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left p-3 hover:bg-hover-theme border-b border-border-theme last:border-b-0 flex flex-col space-y-1 transition-all"
                  >
                    <span className="text-xs font-bold text-primary truncate">{res.title}</span>
                    <span className="text-[9px] font-black uppercase text-blue-500 tracking-wider">{res.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SIDEBAR TABS */}
          <div className="flex border-b border-border-theme bg-bg-secondary/40 text-xs font-bold flex-shrink-0">
            <button
              onClick={() => setActiveLeftTab('courses')}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${
                activeLeftTab === 'courses' ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-card' : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              Courses
            </button>
            <button
              onClick={() => setActiveLeftTab('workspaces')}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${
                activeLeftTab === 'workspaces' ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-card' : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              Books & Workspaces
            </button>
          </div>

          {/* LIST CONTAINER */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
            
            {/* 1. COURSES TAB */}
            {activeLeftTab === 'courses' && (
              <div className="space-y-2.5">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Indian Education Directory</span>
                {Object.entries(INDIAN_EDUCATION_DATA).map(([cat, courses]) => {
                  const isCatExpanded = expandedCategory === cat;
                  return (
                    <div key={cat} className="border border-border-theme rounded-xl overflow-hidden bg-bg-secondary/20 transition-all">
                      <button
                        onClick={() => setExpandedCategory(isCatExpanded ? '' : cat)}
                        className="w-full flex items-center justify-between p-3 text-xs font-bold text-primary hover:bg-hover-theme transition-all"
                      >
                        <span className="truncate">{cat}</span>
                        {isCatExpanded ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                      </button>

                      {isCatExpanded && (
                        <div className="p-2 bg-card border-t border-border-theme space-y-1">
                          {Object.entries(courses).map(([course, semesters]) => {
                            const isCourseExpanded = expandedCourse === course;
                            return (
                              <div key={course} className="rounded-lg overflow-hidden">
                                <button
                                  onClick={() => setExpandedCourse(isCourseExpanded ? '' : course)}
                                  className="w-full flex items-center justify-between p-2 text-xs font-semibold text-muted hover:text-primary hover:bg-hover-theme transition-all"
                                >
                                  <span>{course}</span>
                                  {isCourseExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>

                                {isCourseExpanded && (
                                  <div className="pl-3 py-1 space-y-1.5 border-l border-dashed border-border-color ml-2 my-1">
                                    {Object.entries(semesters).map(([semester, subjects]) => {
                                      const isSemExpanded = expandedSemester === semester;
                                      return (
                                        <div key={semester}>
                                          <button
                                            onClick={() => setExpandedSemester(isSemExpanded ? '' : semester)}
                                            className="w-full text-left py-1 text-[11px] font-medium text-muted hover:text-primary flex items-center justify-between"
                                          >
                                            <span>{semester}</span>
                                            {isSemExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                          </button>

                                          {isSemExpanded && (
                                            <div className="pl-2 space-y-1 mt-1">
                                              {Object.entries(subjects).map(([subject, topics]) => (
                                                <button
                                                  key={subject}
                                                  onClick={() => {
                                                    activateStandardSubjectWorkspace(cat, course, semester, subject, topics);
                                                    setIsLeftDrawerOpen(false);
                                                  }}
                                                  className="w-full text-left px-2.5 py-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-600/5 rounded-md transition-all flex items-center space-x-1.5"
                                                >
                                                  <Book className="w-3 h-3 flex-shrink-0" />
                                                  <span className="truncate">{subject}</span>
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. BOOKS & WORKSPACES TAB */}
            {activeLeftTab === 'workspaces' && (
              <div className="space-y-4">
                
                {/* Saved workspaces list */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Saved Materials</span>
                    <button
                      onClick={() => setIsNewWorkspaceModalOpen(true)}
                      className="p-1 hover:bg-blue-600/10 rounded text-blue-600 dark:text-blue-400 flex items-center space-x-1 text-[10px] font-bold"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Document</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {workspaces.length === 0 ? (
                      <p className="text-xs text-muted text-center py-4">No books uploaded.</p>
                    ) : (
                      workspaces.map(ws => (
                        <div
                          key={ws.id}
                          onClick={() => {
                            setActiveWorkspace(ws);
                            setIsLeftDrawerOpen(false);
                          }}
                          className={`group w-full p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                            activeWorkspace?.id === ws.id
                              ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                              : 'bg-card border-border-theme text-primary hover:bg-hover-theme'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <h4 className="text-xs font-black truncate">{ws.name}</h4>
                            <span className="text-[9px] font-bold text-muted capitalize">
                              {ws.docType || 'Document'} outline • {(ws.topics || []).length} units
                            </span>
                          </div>
                          
                          <button
                            onClick={(e) => handleDeleteWorkspace(ws.id, e)}
                            className="p-1 text-muted hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* SIDEBAR FOOTER (Difficulty Level Preference) */}
          <div className="p-4 border-t border-border-theme bg-bg-secondary/40 flex-shrink-0">
            <div className="bg-card border border-border-theme p-3 rounded-xl space-y-2">
              <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
                <Sliders className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">Difficulty preference</span>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-bg-secondary p-1 rounded-lg text-[9px] font-black text-center select-none">
                {['Beginner', 'Intermediate', 'Advanced'].map(level => {
                  const isSel = difficulty === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`py-1 rounded-md transition-all ${
                        isSel ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-muted hover:text-primary'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* PANEL 2: MAIN PANEL (Upgraded Notes & Interactive Dashboard) */}
        {/* ========================================================================= */}
        <motion.main 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={`flex-1 flex flex-col bg-bg-secondary ${activeMainTab !== 'notes' ? 'h-full overflow-hidden' : ''}`}
        >
          {activeWorkspace ? (
            <div className={`flex-1 flex flex-col ${activeMainTab !== 'notes' ? 'overflow-hidden' : ''}`}>
              
              {/* Context header */}
              <div className="px-6 py-3 bg-card border-b border-border-theme flex items-center justify-between flex-shrink-0 select-none">
                <div className="flex items-center space-x-2 text-xs font-bold text-muted">
                  <span className="text-primary truncate">
                    Selected: {activeWorkspace.courseName || 'Custom'} &gt; {activeWorkspace.semester || 'Workspace'} &gt; {activeWorkspace.subjectName || activeWorkspace.name}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleReplayOnboarding}
                    className="px-2.5 py-1.5 border border-border-theme hover:bg-hover-theme text-primary rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all"
                  >
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>Onboarding Guide</span>
                  </button>

                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="px-2.5 py-1.5 border border-border-theme hover:bg-hover-theme text-primary rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all"
                  >
                    <AlertCircle className="w-3 h-3 text-blue-600" />
                    <span>Send Feedback</span>
                  </button>

                  {isPro ? (
                    <span className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-wider">
                      🌟 {plan?.name || 'Student Pro'}
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all shadow-xs"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Upgrade Plan</span>
                    </button>
                  )}
                </div>
              </div>

              {/* UNIFIED NAVIGATION TABS (Center Area) */}
              <div className="px-6 pt-3 bg-card border-b border-border-theme flex-shrink-0 select-none">
                <div className="flex border border-border-theme text-[10px] font-black bg-bg-secondary/40 rounded-xl overflow-hidden p-0.5 max-w-2xl">
                  {[
                    { id: 'cockpit', label: 'Workspace Cockpit', icon: Layers },
                    { id: 'notes', label: 'Build Understanding', icon: FileText, disabled: !activeWorkspace.notes },
                    { id: 'quiz', label: 'Test Your Mastery', icon: Award, disabled: !activeWorkspace.notes },
                    { id: 'flashcards', label: 'Train Your Memory', icon: BookOpen, disabled: !activeWorkspace.notes },
                    { id: 'tutor', label: 'AI Tutor Chat', icon: MessageSquare }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      disabled={tab.disabled}
                      onClick={() => setActiveMainTab(tab.id)}
                      className={`flex-1 py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        activeMainTab === tab.id
                          ? 'bg-blue-600 text-white shadow-xs font-bold'
                          : 'text-muted hover:text-primary hover:bg-hover-theme'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      <span className="inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* MAIN CONTENT PORT */}
              <div className={`space-y-6 p-6 ${activeMainTab !== 'notes' ? 'flex-1 overflow-y-auto custom-scrollbar' : ''}`}>
                
                {isGeneratingNotes ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase text-blue-600 tracking-wider">Generating Notes...</h4>
                      <p className="text-[10px] text-muted font-bold">Applying depth level: {activeSummaryLevel}</p>
                    </div>
                  </div>
                                ) : activeMainTab === 'cockpit' ? (
                  <div className="space-y-6 animate-fade-in">
                    
                    {/* Grid wrapper */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Left Column: Course Overview & Chapters Checklist */}
                      <div className="lg:col-span-2 space-y-6">
                        
                        {/* Subject Workspace Card */}
                        <div className="bg-card border border-border-theme p-6 rounded-3xl shadow-xs space-y-5">
                          <div className="flex items-start justify-between flex-wrap gap-2 pb-3 border-b border-border-theme">
                            <div>
                              <h2 className="text-base font-black text-primary leading-tight">{activeWorkspace.name}</h2>
                              <span className="text-[10px] font-bold text-muted mt-0.5 block capitalize">
                                Type: {activeWorkspace.docType || 'Syllabus Course'} • Source: {activeWorkspace.topicSource?.replace('_', ' ') || 'predefined'}
                              </span>
                            </div>
                            <span className="bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase px-3 py-1 rounded-xl">
                              Active Workspace
                            </span>
                          </div>

                          {activeWorkspace.syllabus && (
                            <div className="text-xs font-semibold text-muted bg-bg-secondary/40 p-4 rounded-2xl leading-relaxed whitespace-pre-line">
                              {activeWorkspace.syllabus}
                            </div>
                          )}

                          {/* Primary Actions Prominently Displayed */}
                          <div className="flex flex-wrap gap-3 pt-1">
                            <button
                              onClick={handleGenerateUpgradedStudyNotes}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Build Detailed Understanding</span>
                            </button>
                            
                            <button
                              onClick={() => setActiveMainTab('tutor')}
                              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-755 text-white rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Open AI Tutor</span>
                            </button>

                            <button
                              disabled={!activeWorkspace.notes}
                              onClick={() => {
                                if (activeWorkspace.notes) setActiveMainTab('flashcards');
                                else alert("Please build understanding first to enable memory cards.");
                              }}
                              className="px-4 py-2.5 border border-border-theme hover:bg-hover-theme text-primary rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-40"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Train Your Memory Cards</span>
                            </button>

                            <button
                              disabled={!activeWorkspace.notes}
                              onClick={() => {
                                if (activeWorkspace.notes) setActiveMainTab('quiz');
                                else alert("Please build understanding first to enable mastery exams.");
                              }}
                              className="px-4 py-2.5 border border-border-theme hover:bg-hover-theme text-primary rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-40"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>Test Your Mastery Exams</span>
                            </button>
                          </div>
                        </div>

                        {/* Syllabus Course Outline Checklist */}
                        <div className="bg-card border border-border-theme p-6 rounded-3xl shadow-xs space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-border-theme">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Your Learning Journey Outline</span>
                            {adaptiveData && (
                              <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                                {adaptiveData.scores.completionScore}% Completed
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                            {(!topics || topics.length === 0) ? (
                              <div className="p-3 bg-bg-secondary/35 border border-dashed border-border-theme rounded-2xl text-[10px] text-muted text-center col-span-2">
                                No chapters detected
                              </div>
                            ) : (
                              topics.map((ch, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-bg-secondary/35 border border-border-theme rounded-2xl text-[10px]">
                                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                                    {ch.suspicious ? (
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                    ) : (
                                      <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${ch.completed ? 'text-green-500' : 'text-slate-400'}`} />
                                    )}
                                    <span className={`truncate font-black ${ch.completed ? 'line-through text-muted' : 'text-primary'}`}>
                                      Ch {ch.chapterNumber || ch.chapter_number || idx + 1}: {ch.title}
                                    </span>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={!!ch.completed}
                                    onChange={() => handleToggleTopicCompleted(idx)}
                                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </div>
                              ))
                            )}
                                               {/* Quick Action Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div 
                            onClick={() => setActiveMainTab('tutor')}
                            className="bg-card border border-border-theme p-4 rounded-3xl hover:border-indigo-500/50 cursor-pointer transition-all flex flex-col space-y-2 hover:-translate-y-[2px]"
                          >
                            <div className="p-2 bg-indigo-600/10 text-indigo-600 rounded-xl w-fit">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <span className="font-black text-[11px] text-primary">AI Tutor</span>
                            <p className="text-[9px] text-muted leading-relaxed font-semibold">Adaptive chat bounded by chapters.</p>
                          </div>

                          <div 
                            onClick={handleGenerateUpgradedStudyNotes}
                            className="bg-card border border-border-theme p-4 rounded-3xl hover:border-blue-500/50 cursor-pointer transition-all flex flex-col space-y-2 hover:-translate-y-[2px]"
                          >
                            <div className="p-2 bg-blue-600/10 text-blue-600 rounded-xl w-fit">
                              <FileText className="w-4 h-4" />
                            </div>
                            <span className="font-black text-[11px] text-primary">Build Understanding</span>
                            <p className="text-[9px] text-muted leading-relaxed font-semibold">Compile interactive core notes.</p>
                          </div>

                          <div 
                            onClick={() => {
                              if (activeWorkspace.notes) setActiveMainTab('flashcards');
                              else alert("Please build understanding notes first!");
                            }}
                            className="bg-card border border-border-theme p-4 rounded-3xl hover:border-purple-500/50 cursor-pointer transition-all flex flex-col space-y-2 hover:-translate-y-[2px]"
                          >
                            <div className="p-2 bg-purple-600/10 text-purple-600 rounded-xl w-fit">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <span className="font-black text-[11px] text-primary">Train Your Memory</span>
                            <p className="text-[9px] text-muted leading-relaxed font-semibold">Active recall flipping cards.</p>
                          </div>

                          <div 
                            onClick={() => {
                              if (activeWorkspace.notes) setActiveMainTab('quiz');
                              else alert("Please build understanding notes first!");
                            }}
                            className="bg-card border border-border-theme p-4 rounded-3xl hover:border-amber-500/50 cursor-pointer transition-all flex flex-col space-y-2 hover:-translate-y-[2px]"
                          >
                            <div className="p-2 bg-amber-600/10 text-amber-600 rounded-xl w-fit">
                              <Award className="w-4 h-4" />
                            </div>
                            <span className="font-black text-[11px] text-primary">Test Your Mastery</span>
                            <p className="text-[9px] text-muted leading-relaxed font-semibold">MCQ quiz testing framework.</p>
                          </div>
                        </div>     </div>
                        </div>

                      </div>

                      {/* Right Side Column: Adaptive Recommendations, Weekly Schedule & Cognitive Metrics */}
                      <div className="space-y-6">
                        
                        {/* Exam Readiness & Mastery Gauge */}
                        {adaptiveData && (
                          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 rounded-3xl shadow-sm space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase tracking-wider text-blue-100">Exam Readiness</span>
                              <span className="text-xs font-black bg-white/20 px-2.5 py-0.5 rounded-lg">{adaptiveData.examReadiness}%</span>
                            </div>
                            
                            <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
                              <div className="bg-white h-full transition-all duration-500" style={{ width: `${adaptiveData.examReadiness}%` }} />
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 text-center text-white">
                              <div className="bg-white/10 p-2.5 rounded-2xl">
                                <span className="text-[8px] font-black text-blue-200 block uppercase">Mastery Score</span>
                                <span className="text-xs font-black mt-0.5 block">{adaptiveData.scores.masteryScore}/100</span>
                              </div>
                              <div className="bg-white/10 p-2.5 rounded-2xl">
                                <span className="text-[8px] font-black text-blue-200 block uppercase">Est. Study Time</span>
                                <span className="text-xs font-black mt-0.5 block">{Math.max(1, Math.ceil(adaptiveData.estimatedStudyTime / 60))} Hrs</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Spaced Repetition Today's Study Plan */}
                        {adaptiveData && (
                          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-xs space-y-4">
                            <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400">
                              <Sparkles className="w-4 h-4 animate-pulse" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Today's Adaptive Path</span>
                            </div>

                            <div className="space-y-3">
                              {adaptiveData.todaysStudyPlan.map((plan, pIdx) => {
                                let badgeColor = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20";
                                if (plan.action === "Study Next") badgeColor = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
                                if (plan.action === "Revise") badgeColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";

                                return (
                                  <div key={pIdx} className="p-3 bg-bg-secondary/40 border border-border-theme rounded-2xl space-y-1.5">
                                    <div className="flex justify-between items-center">
                                      <span className={`${badgeColor} text-[8px] font-black uppercase px-2 py-0.5 rounded-md`}>
                                        {plan.action}
                                      </span>
                                      <span className="text-[9px] text-muted font-bold">{plan.duration} mins</span>
                                    </div>
                                    <h4 className="text-[10.5px] font-black text-primary truncate">{plan.topicName}</h4>
                                    <p className="text-[9px] text-muted font-semibold leading-normal">{plan.reason}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Interactive Weekly schedules */}
                        {schedules && (
                          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-xs space-y-4">
                            <div className="flex items-center space-x-1.5 text-indigo-500">
                              <Calendar className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Weekly target slots</span>
                            </div>

                            <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                              {schedules.weeklyPlan.map((s, idx) => (
                                <div key={idx} className="flex justify-between items-center py-2 border-b border-border-theme last:border-b-0 text-[10px]">
                                  <span className="font-black text-primary">{s.day}</span>
                                  <span className="font-semibold text-muted truncate max-w-[150px]">{s.target}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Cognitive score trackers */}
                        {adaptiveData && (
                          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-xs space-y-4">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Cognitive Matrix</span>
                            
                            <div className="space-y-3">
                              {[
                                { label: "Retention Rate", val: adaptiveData.scores.retentionScore },
                                { label: "Focus Endurance", val: adaptiveData.scores.focusScore },
                                { label: "Consistency Rate", val: adaptiveData.scores.consistencyScore }
                              ].map((score, sIdx) => (
                                <div key={sIdx} className="space-y-1">
                                  <div className="flex justify-between text-[9px] font-black text-muted">
                                    <span>{score.label}</span>
                                    <span>{score.val}%</span>
                                  </div>
                                  <div className="w-full bg-bg-secondary h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-indigo-650 h-full transition-all duration-300" style={{ width: `${score.val}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>

                    </div>
                  </div>
                ) : activeMainTab === 'tutor' ? (
                  // Dedicated Premium AI Tutor Chat Panel (Center Area)
                  <div className="flex flex-col h-[550px] bg-card border border-border-theme rounded-3xl overflow-hidden shadow-xs animate-fade-in">
                    <div className="p-4 border-b border-border-theme flex flex-col sm:flex-row justify-between items-start sm:items-center bg-bg-secondary/40 gap-3">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                        <div>
                          <h4 className="text-xs font-black uppercase text-primary tracking-wider leading-none">AI Tutor Assistant</h4>
                          <p className="text-[9px] text-muted mt-1 font-semibold leading-none">Bounded chat workspace for "{activeWorkspace.name}" chapters.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-[10px] font-bold">
                        <span className="text-slate-500 uppercase text-[9px] tracking-wider">Mode:</span>
                        <select
                          value={teachingMode}
                          onChange={(e) => setTeachingMode(e.target.value)}
                          className="bg-bg-secondary border border-border-theme text-primary text-[11px] font-black px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="doubt_solver">🎓 Doubt Solver</option>
                          <option value="explain_simply">💡 Explain Simply</option>
                          <option value="professor">🔬 Professor Mode</option>
                          <option value="exam">📋 Exam Mode</option>
                          <option value="interview">💼 Interview Mode</option>
                          <option value="revision">📝 Revision Mode</option>
                          <option value="challenge">🔥 Challenge Mode</option>
                          <option value="future_visual">📊 Future Visual Mode</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-card">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto space-y-4">
                          <MessageSquare className="w-10 h-10 text-blue-600/30 mx-auto" />
                          <h4 className="text-xs font-black text-primary">Ask AI Tutor</h4>
                          <p className="text-[10px] text-muted font-bold leading-relaxed">
                            Send a question or type a concept from your syllabus. The AI tutor is grounded specifically to your course chapters.
                          </p>
                        </div>
                      ) : (
                        messages.map((msg, i) => {
                          const isUser = msg.role === 'user';
                          let bubbleContent = msg.text || msg.content;
                          let actions = [];

                          if (!isUser) {
                            const parsed = parseAiResponse(bubbleContent);
                            bubbleContent = parsed.cleanText;
                            actions = parsed.actions;
                          }

                          return (
                            <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in space-y-1.5`}>
                              <div className={`max-w-[80%] p-3.5 rounded-2xl text-[11px] font-semibold leading-relaxed shadow-xs ${
                                isUser
                                  ? 'bg-blue-600 text-white rounded-br-none'
                                  : 'bg-bg-secondary text-primary border border-border-theme rounded-bl-none'
                              }`}>
                                {isUser ? bubbleContent : renderMarkdown(bubbleContent)}
                              </div>
                              
                              {!isUser && actions.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1 max-w-[85%]">
                                  {actions.map((act, idx) => renderActionButton(act, idx))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                      {isTyping && (
                        <div className="flex justify-start animate-pulse">
                          <div className="bg-bg-secondary border border-border-theme p-3 rounded-2xl rounded-bl-none flex items-center space-x-1.5 text-[10px] font-bold text-slate-500">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                            <span>Thinking...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendForm} className="p-3 bg-card border-t border-border-theme flex items-center space-x-2">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask AI Tutor about this subject..."
                        className="flex-1 bg-bg-secondary text-primary text-xs px-3.5 py-2.5 rounded-xl border border-border-theme focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                      />
                      <button
                        type="submit"
                        disabled={!inputValue.trim() || isTyping}
                        className="p-2.5 bg-blue-600 hover:bg-blue-755 text-white rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                                      ) : activeMainTab === 'notes' ? (
                  <div className="space-y-6">
                    {deepLearningPackage ? (
                      <div className="space-y-6 text-muted">
                        {/* Header */}
                        <div className="border-b border-border-theme pb-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <h1 className="text-sm font-black text-primary leading-tight">
                              {deepLearningPackage.title || activeWorkspace.subject_name || "Study Guide"}
                            </h1>
                            <p className="text-[9px] font-bold text-muted tracking-wider uppercase">
                              Deep Interactive AI Learning Experience
                            </p>
                          </div>
                          <button
                            onClick={() => handleCopyNotesToClipboard(activeWorkspace.notes, 1000)}
                            className="p-2 border border-border-theme hover:bg-hover-theme rounded-xl text-muted flex items-center space-x-1.5"
                            title="Copy raw package response"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{copiedNoteIndex === 1000 ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>

                        {/* Mobile Sticky Table of Contents Accordion Menu */}
                        <div className="md:hidden sticky top-[64px] z-20 -mx-6 px-6 py-3 bg-card border-b border-border-theme shadow-xs">
                          <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-secondary border border-border-theme rounded-xl text-xs font-black text-primary animate-fade-in"
                          >
                            <div className="flex items-center space-x-2">
                              <Menu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span>Table of Contents</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {isMobileMenuOpen && (
                            <div className="mt-2 bg-card border border-border-theme rounded-xl overflow-hidden shadow-lg animate-fade-in max-h-60 overflow-y-auto custom-scrollbar">
                              {[
                                { id: 'overview', label: 'Overview' },
                                { id: 'definition', label: 'Definition' },
                                { id: 'coreConcepts', label: 'Core Concepts' },
                                { id: 'formula', label: 'Formulas', cond: (pkg) => pkg.formula?.exists },
                                { id: 'detailed', label: 'Detailed Explanation' },
                                { id: 'deepUnderstanding', label: 'Intuition & Analogy' },
                                { id: 'solvedExamples', label: 'Solved Examples' },
                                { id: 'visual', label: 'Visual Learning' },
                                { id: 'mistakes', label: 'Mistakes & Tricks' },
                                { id: 'examFocus', label: 'Exam Focus' },
                                { id: 'tutorQuestions', label: 'AI Practice Qs' },
                                { id: 'revisionSheet', label: 'Revision Sheets' }
                              ].map(nav => {
                                const isCond = nav.cond ? nav.cond(deepLearningPackage) : true;
                                if (!isCond) return null;
                                return (
                                  <button
                                    key={nav.id}
                                    type="button"
                                    onClick={() => {
                                      scrollToSection(nav.id);
                                      setIsMobileMenuOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-hover-theme border-b border-border-theme last:border-b-0 text-xs font-bold text-muted flex items-center space-x-2.5 transition-colors"
                                  >
                                    <span>{nav.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Guide Explored Progress Tracker */}
                        {(() => {
                          const totalSecs = Object.keys(openSections).length;
                          const openSecs = Object.values(openSections).filter(Boolean).length;
                          const pct = Math.round((openSecs / totalSecs) * 100);
                          return (
                            <div className="bg-bg-secondary/35 p-3.5 rounded-2xl border border-border-theme flex items-center justify-between text-[10px]">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-muted uppercase tracking-wider">Guide Explored:</span>
                                <span className="font-black text-blue-600 dark:text-blue-400">{pct}%</span>
                              </div>
                              <div className="flex-1 max-w-[70%] bg-border-color h-1.5 rounded-full overflow-hidden ml-3 bg-bg-secondary/80">
                                <div className="bg-blue-600 dark:bg-blue-450 h-full transition-all duration-300" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Two-Column Side-by-Side Content Layout */}
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                          
                          {/* Desktop & Tablet Sticky Section Menu */}
                          <div className={`hidden md:flex flex-col flex-shrink-0 transition-all duration-300 sticky top-[110px] self-start ${
                            isSectionMenuCollapsed ? 'w-16' : 'w-64'
                          }`}>
                            <div className="flex justify-end mb-2 w-full">
                              <button 
                                type="button"
                                onClick={() => setIsSectionMenuCollapsed(!isSectionMenuCollapsed)}
                                className="p-1.5 bg-bg-secondary hover:bg-hover-theme border border-border-theme rounded-lg text-muted transition-all"
                                title={isSectionMenuCollapsed ? "Expand Menu" : "Collapse Menu"}
                              >
                                <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isSectionMenuCollapsed ? '' : 'rotate-180'}`} />
                              </button>
                            </div>

                            <div className="bg-card border border-border-theme rounded-3xl p-3.5 space-y-2 w-full shadow-xs">
                              {!isSectionMenuCollapsed && (
                                <span className="text-[9px] font-black text-muted uppercase tracking-widest block px-2.5 mb-2">
                                  Table of Contents
                                </span>
                              )}
                              <div className="flex flex-col space-y-1">
                                {[
                                  { id: 'overview', label: 'Overview', icon: BookOpen },
                                  { id: 'definition', label: 'Definition', icon: Sliders },
                                  { id: 'coreConcepts', label: 'Core Concepts', icon: Layers },
                                  { id: 'formula', label: 'Formulas', icon: FileCode, cond: (pkg) => pkg.formula?.exists },
                                  { id: 'detailed', label: 'Detailed Explanation', icon: Info },
                                  { id: 'deepUnderstanding', label: 'Intuition & Analogy', icon: Sparkles },
                                  { id: 'solvedExamples', label: 'Solved Examples', icon: CheckCircle },
                                  { id: 'visual', label: 'Visual Learning', icon: Eye },
                                  { id: 'mistakes', label: 'Mistakes & Tricks', icon: AlertTriangle },
                                  { id: 'examFocus', label: 'Exam Focus', icon: Award },
                                  { id: 'tutorQuestions', label: 'AI Practice Qs', icon: HelpCircle },
                                  { id: 'revisionSheet', label: 'Revision Sheets', icon: FileText }
                                ].map(nav => {
                                  const isCond = nav.cond ? nav.cond(deepLearningPackage) : true;
                                  if (!isCond) return null;
                                  const Icon = nav.icon;
                                  return (
                                    <button
                                      key={nav.id}
                                      type="button"
                                      onClick={() => scrollToSection(nav.id)}
                                      className={`flex items-center rounded-xl transition-all p-2.5 text-xs font-bold text-left group w-full ${
                                        isSectionMenuCollapsed ? 'justify-center' : 'space-x-3'
                                      } text-muted hover:text-primary hover:bg-hover-theme`}
                                      title={nav.label}
                                    >
                                      <Icon className="w-4 h-4 flex-shrink-0 text-muted group-hover:text-blue-650 dark:group-hover:text-blue-400 transition-colors" />
                                      {!isSectionMenuCollapsed && <span className="truncate">{nav.label}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Notes Content Sections (Right fluid column) - Centered Article Layout */}
                          <div className="flex-1 min-w-0 space-y-8 w-full max-w-[850px] mx-auto text-[15px] leading-relaxed font-sans">

                        {/* Section 1: Quick Overview */}
                        {deepLearningPackage.overview && (
                          <div id="notes-sec-overview" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-extrabold">
                                <BookOpen className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Quick Overview</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, overview: !prev.overview }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.overview ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>
                            
                            {openSections.overview && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in text-xs text-primary">
                                <div className="bg-blue-600/5 border border-blue-500/10 p-4 rounded-2xl space-y-1 col-span-2">
                                  <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-extrabold mb-1">
                                    <Info className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">What is this topic</span>
                                  </div>
                                  <p className="text-primary font-medium leading-relaxed">{deepLearningPackage.overview.what}</p>
                                </div>
                                
                                <div className="bg-emerald-600/5 border border-emerald-500/10 p-4 rounded-2xl space-y-1">
                                  <div className="flex items-center space-x-1.5 text-emerald-650 dark:text-emerald-450 font-extrabold mb-1">
                                    <Sparkles className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Why it matters</span>
                                  </div>
                                  <p className="text-[11px] text-muted leading-relaxed">{deepLearningPackage.overview.why}</p>
                                </div>
                                
                                <div className="bg-amber-600/5 border border-amber-500/10 p-4 rounded-2xl space-y-1">
                                  <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-450 font-extrabold mb-1">
                                    <Map className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Where it is used</span>
                                  </div>
                                  <p className="text-[11px] text-muted leading-relaxed">{deepLearningPackage.overview.where}</p>
                                </div>

                                <div className="bg-purple-600/5 border border-purple-500/10 p-4 rounded-2xl space-y-1 col-span-2">
                                  <div className="flex items-center space-x-1.5 text-purple-600 dark:text-purple-400 font-extrabold mb-1">
                                    <Activity className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Real-world Relevance</span>
                                  </div>
                                  <p className="text-[11px] text-muted leading-relaxed">{deepLearningPackage.overview.relevance}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 2: Definition */}
                        {deepLearningPackage.definition && (
                          <div id="notes-sec-definition" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-teal-600 dark:text-teal-400 font-extrabold">
                                <Sliders className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Definition</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, definition: !prev.definition }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.definition ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.definition && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in text-xs text-primary">
                                <div className="bg-teal-600/5 border border-teal-500/10 p-4 rounded-2xl space-y-2">
                                  <span className="text-[10px] font-black uppercase text-teal-600 dark:text-teal-400 tracking-wider block">Formal Textbook Definition</span>
                                  <p className="text-primary leading-relaxed font-serif">{deepLearningPackage.definition.formal}</p>
                                </div>
                                <div className="bg-amber-600/5 border border-amber-500/10 p-4 rounded-2xl space-y-2">
                                  <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider block">Student-Friendly Translation</span>
                                  <p className="text-primary leading-relaxed">{deepLearningPackage.definition.simplified}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 3: Core Concepts */}
                        {deepLearningPackage.coreConcepts && (
                          <div id="notes-sec-coreConcepts" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-purple-600 dark:text-purple-400 font-extrabold">
                                <Layers className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Core Concepts</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, coreConcepts: !prev.coreConcepts }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.coreConcepts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.coreConcepts && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in text-primary">
                                {deepLearningPackage.coreConcepts.map((concept, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-card border border-border-theme p-5 rounded-2xl hover:border-purple-500/55 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group space-y-2.5"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <div className="p-2 bg-purple-500/10 rounded-xl group-hover:scale-110 transition-transform">
                                        <Layers className="w-4 h-4 text-purple-500" />
                                      </div>
                                      <h4 className="text-xs font-black text-primary leading-tight">{concept.title}</h4>
                                    </div>
                                    <p className="text-[11px] text-muted leading-relaxed">{concept.explanation}</p>
                                    {concept.importance && (
                                      <div className="pt-2 border-t border-border-theme text-[9px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                                        <Sparkles className="w-3 h-3" />
                                        <span>Importance: {concept.importance}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 4: Formula Section */}
                        {deepLearningPackage.formula && deepLearningPackage.formula.exists && (
                          <div id="notes-sec-formula" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400 font-extrabold">
                                <FileCode className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Formula Section</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, formula: !prev.formula }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.formula ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.formula && (
                              <div className="space-y-4 animate-fade-in text-xs text-primary">
                                <div className="bg-amber-600/5 border border-amber-500/10 p-5 rounded-2xl text-center space-y-2.5">
                                  <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-widest block font-sans">Equation</span>
                                  <code className="text-sm font-black text-primary bg-bg-secondary/50 px-4 py-2 rounded-xl border border-border-theme inline-block font-mono">
                                    {deepLearningPackage.formula.formula}
                                  </code>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-wider block">Variables & Explanation</span>
                                    <div className="bg-card border border-border-theme p-4 rounded-2xl space-y-2">
                                      <ul className="space-y-1.5">
                                        {deepLearningPackage.formula.variables?.map((v, i) => (
                                          <li key={i} className="flex items-center space-x-2 text-[11px] text-primary">
                                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />
                                            <span>{v}</span>
                                          </li>
                                        ))}
                                      </ul>
                                      <div className="pt-2 border-t border-border-theme flex items-center space-x-1.5">
                                        <span className="text-[9px] font-black uppercase text-muted tracking-wider">Standard Units:</span>
                                        <span className="px-2 py-0.5 bg-amber-600/10 text-amber-600 rounded text-[10px] font-black">{deepLearningPackage.formula.units}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-wider block">Derivation Overview</span>
                                    <div className="bg-card border border-border-theme p-4 rounded-2xl leading-relaxed text-[11px] text-muted whitespace-pre-line bg-bg-secondary/20">
                                      {deepLearningPackage.formula.derivation}
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-wider block">When to use & Common mistakes</span>
                                    <div className="bg-card border border-border-theme p-4 rounded-2xl leading-relaxed text-[11px] text-muted space-y-2">
                                      <p><strong className="text-primary font-bold">When:</strong> {deepLearningPackage.formula.whenToUse}</p>
                                      <p><strong className="text-red-500 font-bold">Mistakes:</strong> {deepLearningPackage.formula.commonMistakes}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-wider block">Solved Numerical Example</span>
                                    <div className="bg-card border border-border-theme p-4 rounded-2xl leading-relaxed text-[11px] text-muted font-mono bg-bg-secondary/20 whitespace-pre-line">
                                      {deepLearningPackage.formula.calculation}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 5: Detailed Explanation */}
                        {deepLearningPackage.detailed && (
                          <div id="notes-sec-detailed" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-indigo-600 dark:text-indigo-400 font-extrabold">
                                <Info className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Detailed Explanation</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, detailed: !prev.detailed }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.detailed ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.detailed && (
                              <div className="space-y-2.5 animate-fade-in text-xs text-primary">
                                {[
                                  { id: 'what', label: 'What is it?', content: deepLearningPackage.detailed.what },
                                  { id: 'why', label: 'Why do we need it?', content: deepLearningPackage.detailed.why },
                                  { id: 'how', label: 'How does it work?', content: deepLearningPackage.detailed.how },
                                  { id: 'working', label: 'Working mechanism', content: deepLearningPackage.detailed.working },
                                  { id: 'importance', label: 'Key Importance', content: deepLearningPackage.detailed.importance },
                                  { id: 'advantages', label: 'Advantages', content: deepLearningPackage.detailed.advantages, isBullet: true },
                                  { id: 'disadvantages', label: 'Disadvantages', content: deepLearningPackage.detailed.disadvantages, isBullet: true },
                                  { id: 'applications', label: 'Applications', content: deepLearningPackage.detailed.applications }
                                ].map(sub => {
                                  if (!sub.content) return null;
                                  const isSubOpen = openDetailedSub[sub.id];
                                  return (
                                    <div key={sub.id} className="border border-border-theme rounded-2xl bg-card overflow-hidden">
                                      <button
                                        onClick={() => setOpenDetailedSub(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))}
                                        className="w-full flex items-center justify-between p-3.5 text-[11px] font-black text-primary hover:bg-hover-theme transition-all text-left"
                                      >
                                        <span>{sub.label}</span>
                                        {isSubOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-muted" />}
                                      </button>
                                      {isSubOpen && (
                                        <div className="p-4 border-t border-border-theme bg-bg-secondary/15 leading-relaxed text-muted text-[11px]">
                                          {sub.isBullet ? (
                                            <div className="whitespace-pre-line">{sub.content}</div>
                                          ) : (
                                            <p>{sub.content}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 6: Deep Understanding Section */}
                        {deepLearningPackage.deepUnderstanding && (
                          <div id="notes-sec-deepUnderstanding" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-pink-600 dark:text-pink-400 font-extrabold">
                                <Sparkles className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Intuition & Deep Logic</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, deepUnderstanding: !prev.deepUnderstanding }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.deepUnderstanding ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.deepUnderstanding && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in text-xs text-primary">
                                <div className="bg-pink-600/5 border border-pink-500/10 p-4.5 rounded-2xl space-y-2">
                                  <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400 tracking-wider block">Intuition</span>
                                  <p className="text-muted leading-relaxed font-medium">{deepLearningPackage.deepUnderstanding.intuition}</p>
                                </div>
                                <div className="bg-purple-600/5 border border-purple-500/10 p-4.5 rounded-2xl space-y-2">
                                  <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider block">Logic</span>
                                  <p className="text-muted leading-relaxed">{deepLearningPackage.deepUnderstanding.logic}</p>
                                </div>
                                <div className="bg-blue-600/5 border border-blue-500/10 p-4.5 rounded-2xl space-y-2">
                                  <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">How to Think about it</span>
                                  <p className="text-muted leading-relaxed italic">"{deepLearningPackage.deepUnderstanding.thinking}"</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 7: Solved Examples */}
                        {deepLearningPackage.solvedExamples && (
                          <div id="notes-sec-solvedExamples" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-cyan-600 dark:text-cyan-400 font-extrabold">
                                <Sliders className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Solved Textbook Examples</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, solvedExamples: !prev.solvedExamples }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.solvedExamples ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.solvedExamples && (
                              <div className="space-y-4 animate-fade-in text-xs text-primary">
                                {deepLearningPackage.solvedExamples.map((ex, idx) => (
                                  <div key={idx} className="bg-card border border-border-theme p-4.5 rounded-2xl space-y-3">
                                    <h4 className="text-[11px] font-black text-cyan-600 dark:text-cyan-400 flex items-center space-x-1.5">
                                      <span className="px-2 py-0.5 bg-cyan-600/10 text-cyan-600 rounded text-[9px] font-black">EX {idx + 1}</span>
                                      <span>{ex.title}</span>
                                    </h4>
                                    <div className="bg-bg-secondary/40 p-4 rounded-xl font-mono leading-relaxed text-muted whitespace-pre-wrap border border-border-theme bg-bg-secondary/20">
                                      {ex.content}
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-primary"><strong className="font-bold">Explanation:</strong> {ex.explanation}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 8: Visual Learning Section */}
                        {deepLearningPackage.visual && (
                          <div id="notes-sec-visual" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold">
                                <BarChart2 className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Visual Learning Section</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, visual: !prev.visual }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.visual ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.visual && (
                              <div className="bg-card border border-border-theme p-5 rounded-2xl animate-fade-in text-xs text-primary">
                                {deepLearningPackage.visual.type === 'flowchart' && Array.isArray(deepLearningPackage.visual.data) ? (
                                  <div className="flex flex-col items-center space-y-3 py-2">
                                    {deepLearningPackage.visual.data.map((step, idx) => (
                                      <React.Fragment key={idx}>
                                        <div className="px-5 py-3.5 bg-emerald-600/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-450 rounded-2xl font-black text-center max-w-sm w-full shadow-sm hover:scale-102 transition-transform">
                                          {step}
                                        </div>
                                        {idx < deepLearningPackage.visual.data.length - 1 && (
                                          <ChevronDown className="w-5 h-5 text-emerald-500" />
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="leading-relaxed text-muted whitespace-pre-line">{deepLearningPackage.visual.data}</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 9: Common Mistakes & Memory Tricks */}
                        {(deepLearningPackage.mistakes || deepLearningPackage.memoryTrick) && (
                          <div id="notes-sec-mistakes" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 font-extrabold">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Mistakes & Memory Tricks</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, mistakes: !prev.mistakes }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.mistakes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.mistakes && (
                              <div className="space-y-4 animate-fade-in text-xs text-primary">
                                {deepLearningPackage.mistakes && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {deepLearningPackage.mistakes.map((m, idx) => (
                                      <React.Fragment key={idx}>
                                        <div className="bg-red-600/5 border border-red-500/10 p-4.5 rounded-2xl space-y-1.5">
                                          <span className="text-[10px] font-black uppercase text-red-600 tracking-wider">Wrong Thinking</span>
                                          <p className="text-muted leading-relaxed">{m.wrong}</p>
                                        </div>
                                        <div className="bg-green-600/5 border border-green-500/10 p-4.5 rounded-2xl space-y-1.5">
                                          <span className="text-[10px] font-black uppercase text-green-600 dark:text-green-400 tracking-wider">Correct Understanding</span>
                                          <p className="text-muted leading-relaxed">{m.correct}</p>
                                        </div>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                )}

                                {deepLearningPackage.memoryTrick && (
                                  <div className="bg-purple-600/5 border border-purple-500/10 p-5 rounded-2xl space-y-3">
                                    <div className="flex items-center space-x-1.5 text-purple-600 dark:text-purple-400 font-extrabold">
                                      <Activity className="w-4 h-4" />
                                      <span className="text-[10px] font-black uppercase tracking-wider">Memory Mnemonics</span>
                                    </div>
                                    <p className="text-primary font-bold">{deepLearningPackage.memoryTrick.mnemonic}</p>
                                    {deepLearningPackage.memoryTrick.shortcut && (
                                      <p className="text-[11px] text-muted"><strong className="font-bold">Shortcut Trick:</strong> {deepLearningPackage.memoryTrick.shortcut}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 10: Exam Focus Section */}
                        {deepLearningPackage.examFocus && (
                          <div id="notes-sec-examFocus" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-yellow-500 font-extrabold">
                                <Award className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Exam Focus Section</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, examFocus: !prev.examFocus }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.examFocus ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.examFocus && (
                              <div className="space-y-3.5 animate-fade-in text-xs text-primary">
                                {deepLearningPackage.examFocus.map((item, idx) => {
                                  const stars = "⭐".repeat(item.rating || 1);
                                  const importanceLabel = item.rating === 3 ? "VERY IMPORTANT" : item.rating === 2 ? "IMPORTANT" : "FREQUENTLY ASKED";
                                  const badgeColor = item.rating === 3 ? "bg-red-500/10 text-red-500" : item.rating === 2 ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500";
                                  return (
                                    <div key={idx} className="bg-card border border-border-theme p-4.5 rounded-2xl space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black text-primary tracking-widest">{stars}</span>
                                        <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${badgeColor}`}>{importanceLabel}</span>
                                      </div>
                                      <h4 className="text-[11px] font-extrabold text-primary leading-relaxed">{item.question}</h4>
                                      {item.pattern && (
                                        <p className="text-[10px] text-muted bg-bg-secondary/45 p-2 rounded-lg leading-relaxed"><strong className="font-black text-primary">Pattern:</strong> {item.pattern}</p>
                                      )}
                                      {item.tip && (
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/5 p-2 rounded-lg leading-relaxed"><strong className="font-black">Exam Tip:</strong> {item.tip}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 11: AI Tutor Questions */}
                        {deepLearningPackage.tutorQuestions && (
                          <div id="notes-sec-tutorQuestions" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-extrabold">
                                <MessageSquare className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">AI Tutor Practice Questions</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, tutorQuestions: !prev.tutorQuestions }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.tutorQuestions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.tutorQuestions && (
                              <div className="space-y-3 animate-fade-in text-xs text-primary">
                                <p className="text-muted text-[11px] leading-relaxed">Click any question below to ask the AI Tutor and start a live interactive dialogue!</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {deepLearningPackage.tutorQuestions.map((item, idx) => {
                                    const diffBadgeColor = item.difficulty === 'Hard' ? 'bg-red-500/10 text-red-500' : item.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500';
                                    return (
                                      <button
                                        key={idx}
                                        onClick={() => handleAskTutor(item.question)}
                                        className="bg-card border border-border-theme p-4 rounded-2xl hover:border-blue-500/50 hover:bg-blue-600/5 text-left transition-all active:scale-98 flex flex-col justify-between space-y-3.5 group"
                                      >
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${diffBadgeColor}`}>{item.difficulty}</span>
                                            <span className="px-2 py-0.5 bg-bg-secondary text-muted rounded text-[8px] font-bold">{item.type}</span>
                                          </div>
                                          <p className="text-[11px] font-extrabold text-primary group-hover:text-blue-600 leading-normal">{item.question}</p>
                                        </div>
                                        <span className="text-[9px] font-black text-blue-600 flex items-center space-x-1 uppercase tracking-widest pt-2 border-t border-border-theme">
                                          <span>Ask AI Tutor</span>
                                          <ChevronRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 12: Quick Revision Sheet & One Minute Revision */}
                        {deepLearningPackage.revisionSheet && (
                          <div id="notes-sec-revisionSheet" className="scroll-mt-16 bg-bg-secondary/40 border border-border-theme rounded-3xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-green-600 dark:text-green-400 font-extrabold">
                                <Zap className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-wider">Quick Revision Sheets</span>
                              </div>
                              <button
                                onClick={() => setOpenSections(prev => ({ ...prev, revisionSheet: !prev.revisionSheet }))}
                                className="text-muted hover:text-primary transition-all"
                              >
                                {openSections.revisionSheet ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>

                            {openSections.revisionSheet && (
                              <div className="space-y-4 animate-fade-in text-xs text-primary">
                                <div className="bg-green-600/5 border border-green-500/10 p-5 rounded-2xl">
                                  <span className="text-[10px] font-black uppercase text-green-605 tracking-wider block mb-2 text-green-600">High-yield revision points</span>
                                  <ul className="space-y-3 font-semibold text-primary">
                                    {deepLearningPackage.revisionSheet.map((p, idx) => (
                                      <li key={idx} className="flex items-start space-x-3.5 leading-relaxed">
                                        <span className="bg-green-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5 font-sans">
                                          {idx + 1}
                                        </span>
                                        <p className="pt-0.5">{p}</p>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {deepLearningPackage.oneMinuteRevision && (
                                  <div className="bg-blue-600/5 border border-blue-500/10 p-5 rounded-2xl space-y-1">
                                    <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider block">One Minute Revision Recap</span>
                                    <p className="text-primary italic font-medium leading-relaxed">"{deepLearningPackage.oneMinuteRevision}"</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                          </div>
                        </div>
                      </div>
                    ) : parsedNotesSections && !parsedNotesSections.isRaw ? (
                      <div className="space-y-6 text-muted">
                        
                        {/* Notes Title */}
                        {parsedNotesSections.title && (
                          <div className="border-b border-border-theme pb-4 flex items-center justify-between">
                            <div className="space-y-1">
                              <h1 className="text-sm font-black text-primary leading-tight">{parsedNotesSections.title}</h1>
                              <p className="text-[9px] font-bold text-muted tracking-wider uppercase">HYPERBRAIN UPGRADED SYLLABUS ENGINE</p>
                            </div>
                            <button
                              onClick={() => handleCopyNotesToClipboard(activeWorkspace.notes, 1000)}
                              className="p-2 border border-border-theme hover:bg-hover-theme rounded-xl text-muted flex items-center space-x-1.5"
                              title="Copy text notes"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>{copiedNoteIndex === 1000 ? 'Copied!' : 'Copy'}</span>
                            </button>
                          </div>
                        )}

                        {/* Mobile Sticky Table of Contents Accordion Menu for Standard Notes */}
                        <div className="md:hidden sticky top-[64px] z-20 -mx-6 px-6 py-3 bg-card border-b border-border-theme shadow-xs">
                          <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-secondary border border-border-theme rounded-xl text-xs font-black text-primary animate-fade-in"
                          >
                            <div className="flex items-center space-x-2">
                              <Menu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span>Table of Contents</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {isMobileMenuOpen && (
                            <div className="mt-2 bg-card border border-border-theme rounded-xl overflow-hidden shadow-lg animate-fade-in max-h-60 overflow-y-auto custom-scrollbar">
                              {[
                                { id: 'overview', label: 'Overview', cond: (pkg) => pkg.overview },
                                { id: 'concepts', label: 'Key Concepts', cond: (pkg) => pkg.concepts },
                                { id: 'definitions', label: 'Definitions', cond: (pkg) => pkg.definitions },
                                { id: 'examples', label: 'Examples', cond: (pkg) => pkg.examples },
                                { id: 'examQuestions', label: 'Important Exam Questions', cond: (pkg) => pkg.examQuestions },
                                { id: 'revisionNotes', label: 'Quick Revision Notes', cond: (pkg) => pkg.revisionNotes },
                                { id: 'memoryTips', label: 'Memory Tips', cond: (pkg) => pkg.memoryTips }
                              ].map(nav => {
                                const isCond = nav.cond ? nav.cond(parsedNotesSections) : true;
                                if (!isCond) return null;
                                return (
                                  <button
                                    key={nav.id}
                                    type="button"
                                    onClick={() => {
                                      scrollToSection(nav.id);
                                      setIsMobileMenuOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-hover-theme border-b border-border-theme last:border-b-0 text-xs font-bold text-muted flex items-center space-x-2.5 transition-colors"
                                  >
                                    <span>{nav.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Two-Column Side-by-Side Content Layout for Standard Notes */}
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                          
                          {/* Desktop & Tablet Sticky Section Menu */}
                          <div className={`hidden md:flex flex-col flex-shrink-0 transition-all duration-300 sticky top-[110px] self-start ${
                            isSectionMenuCollapsed ? 'w-16' : 'w-64'
                          }`}>
                            <div className="flex justify-end mb-2 w-full">
                              <button 
                                type="button"
                                onClick={() => setIsSectionMenuCollapsed(!isSectionMenuCollapsed)}
                                className="p-1.5 bg-bg-secondary hover:bg-hover-theme border border-border-theme rounded-lg text-muted transition-all"
                                title={isSectionMenuCollapsed ? "Expand Menu" : "Collapse Menu"}
                              >
                                <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isSectionMenuCollapsed ? '' : 'rotate-180'}`} />
                              </button>
                            </div>

                            <div className="bg-card border border-border-theme rounded-3xl p-3.5 space-y-2 w-full shadow-xs">
                              {!isSectionMenuCollapsed && (
                                <span className="text-[9px] font-black text-muted uppercase tracking-widest block px-2.5 mb-2">
                                  Table of Contents
                                </span>
                              )}
                              <div className="flex flex-col space-y-1">
                                {[
                                  { id: 'overview', label: 'Overview', icon: BookOpen, cond: (pkg) => pkg.overview },
                                  { id: 'concepts', label: 'Key Concepts', icon: Layers, cond: (pkg) => pkg.concepts },
                                  { id: 'definitions', label: 'Definitions', icon: Sliders, cond: (pkg) => pkg.definitions },
                                  { id: 'examples', label: 'Examples', icon: CheckCircle, cond: (pkg) => pkg.examples },
                                  { id: 'examQuestions', label: 'Exam Questions', icon: AlertTriangle, cond: (pkg) => pkg.examQuestions },
                                  { id: 'revisionNotes', label: 'Revision Notes', icon: Zap, cond: (pkg) => pkg.revisionNotes },
                                  { id: 'memoryTips', label: 'Memory Tips', icon: Activity, cond: (pkg) => pkg.memoryTips }
                                ].map(nav => {
                                  const isCond = nav.cond ? nav.cond(parsedNotesSections) : true;
                                  if (!isCond) return null;
                                  const Icon = nav.icon;
                                  return (
                                    <button
                                      key={nav.id}
                                      type="button"
                                      onClick={() => scrollToSection(nav.id)}
                                      className={`flex items-center rounded-xl transition-all p-2.5 text-xs font-bold text-left group w-full ${
                                        isSectionMenuCollapsed ? 'justify-center' : 'space-x-3'
                                      } text-muted hover:text-primary hover:bg-hover-theme`}
                                      title={nav.label}
                                    >
                                      <Icon className="w-4 h-4 flex-shrink-0 text-muted group-hover:text-blue-650 dark:group-hover:text-blue-400 transition-colors" />
                                      {!isSectionMenuCollapsed && <span className="truncate">{nav.label}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Notes Content Sections (Right fluid column) - Centered Article Layout */}
                          <div className="flex-1 min-w-0 space-y-8 w-full max-w-[850px] mx-auto text-[15px] leading-relaxed font-sans animate-fade-in">

                        {/* Section 1: Overview */}
                        {parsedNotesSections.overview && (
                          <div id="notes-sec-overview" className="scroll-mt-16 bg-blue-600/5 border border-blue-500/10 p-5 rounded-2xl space-y-2">
                            <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-extrabold">
                              <BookOpen className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Overview</span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-wrap">{parsedNotesSections.overview}</div>
                          </div>
                        )}

                        {/* Section 2: Key Concepts */}
                        {parsedNotesSections.concepts && (
                          <div id="notes-sec-concepts" className="scroll-mt-16 bg-card border border-border-theme p-5 rounded-2xl space-y-2">
                            <div className="flex items-center space-x-1.5 text-purple-600 dark:text-purple-400 font-extrabold">
                              <Layers className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Key Concepts</span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-wrap">{parsedNotesSections.concepts}</div>
                          </div>
                        )}

                        {/* Section 3: Important Definitions */}
                        {parsedNotesSections.definitions && (
                          <div id="notes-sec-definitions" className="scroll-mt-16 bg-emerald-600/5 border border-emerald-500/10 p-5 rounded-2xl space-y-2">
                            <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-450 font-extrabold">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Important Definitions</span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-wrap">{parsedNotesSections.definitions}</div>
                          </div>
                        )}

                        {/* Section 4: Examples */}
                        {parsedNotesSections.examples && (
                          <div id="notes-sec-examples" className="scroll-mt-16 bg-indigo-600/5 border border-indigo-500/10 p-5 rounded-2xl space-y-2">
                            <div className="flex items-center space-x-1.5 text-indigo-600 dark:text-indigo-400 font-extrabold">
                              <Check className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Examples</span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-wrap">{parsedNotesSections.examples}</div>
                          </div>
                        )}

                        {/* Section 5: Important Exam Questions */}
                        {parsedNotesSections.examQuestions && (
                          <div id="notes-sec-examQuestions" className="scroll-mt-16 bg-yellow-500/10 border border-yellow-500/20 p-5 rounded-2xl space-y-2">
                            <div className="flex items-center space-x-1.5 text-yellow-650 font-extrabold">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Important Exam Questions</span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-wrap font-sans">{parsedNotesSections.examQuestions}</div>
                          </div>
                        )}

                        {/* Section 6: Quick Revision Notes */}
                        {parsedNotesSections.revisionNotes && (
                          <div id="notes-sec-revisionNotes" className="scroll-mt-16 bg-card border border-border-theme p-5 rounded-2xl space-y-2">
                            <div className="flex items-center space-x-1.5 text-pink-600 dark:text-pink-400 font-extrabold">
                              <Zap className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Quick Revision Notes</span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-wrap">{parsedNotesSections.revisionNotes}</div>
                          </div>
                        )}

                        {/* Section 7: Memory Tips */}
                        {parsedNotesSections.memoryTips && (
                          <div id="notes-sec-memoryTips" className="scroll-mt-16 bg-purple-600/5 border border-purple-500/10 p-5 rounded-2xl space-y-2">
                            <div className="flex items-center space-x-1.5 text-purple-650 font-extrabold">
                              <Activity className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Memory Tips & Mnemonics</span>
                            </div>
                            <div className="leading-relaxed whitespace-pre-wrap">{parsedNotesSections.memoryTips}</div>
                          </div>
                        )}

                          </div>
                        </div>
                      </div>
                    ) : (
                      // Fallback rendering raw notes
                      <div className="whitespace-pre-wrap leading-relaxed text-muted font-semibold">
                        {activeWorkspace.notes.replace(/```json[\s\S]*?```/g, '').trim()}
                      </div>
                    )}
                  </div>
                ) : null}

                    {/* TAB VIEW 2: DEEP INTERACTIVE QUIZ */}
                    {activeMainTab === 'quiz' && deepLearningPackage && deepLearningPackage.quiz && (
                      <div className="bg-card border border-border-theme p-6 rounded-3xl shadow-xs space-y-5 animate-fade-in text-xs">
                        <div className="flex items-center justify-between border-b border-border-theme pb-3">
                          <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center space-x-1">
                            <Award className="w-4 h-4" />
                            <span>Interactive Module Quiz</span>
                          </span>
                          <span className="font-bold text-muted">
                            Score: {notesQuizState.score} / {deepLearningPackage.quiz.length}
                          </span>
                        </div>

                        {(() => {
                          const state = notesQuizState;
                          const qIdx = state.currentQuestionIndex;
                          const quizQs = deepLearningPackage.quiz;

                          if (qIdx >= quizQs.length) {
                            return (
                              <div className="text-center py-8 space-y-4 font-semibold">
                                <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                                <h4 className="text-sm font-black">Module Quiz Completed!</h4>
                                <p className="text-xs text-muted">
                                  Final Score: You answered {state.score} of {quizQs.length} questions correctly.
                                </p>
                                <button
                                  onClick={() => setNotesQuizState({ currentQuestionIndex: 0, score: 0, answers: {}, showExplanation: false })}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-755 text-white rounded-xl font-bold transition-all"
                                >
                                  Restart Quiz
                                </button>
                              </div>
                            );
                          }

                          const activeQ = quizQs[qIdx];
                          const selectedOpt = state.answers[qIdx];
                          const isAnswered = selectedOpt !== undefined;

                          return (
                            <div className="space-y-4">
                              <div className="flex items-start space-x-2">
                                <span className="bg-blue-600/15 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black">
                                  Q{qIdx + 1}
                                </span>
                                <h4 className="text-xs font-bold text-primary pt-0.5 leading-relaxed">{activeQ.question}</h4>
                              </div>

                              <div className="grid grid-cols-1 gap-2.5">
                                {activeQ.options.map((opt, oIdx) => {
                                  const isChecked = selectedOpt === oIdx;
                                  const isCorrect = activeQ.answer === oIdx;
                                  let style = "bg-bg-secondary/40 border-border-theme text-primary hover:bg-hover-theme";

                                  if (isAnswered) {
                                    if (isCorrect) {
                                      style = "bg-green-500/15 border-green-500 text-green-700 dark:text-green-400 font-bold";
                                    } else if (isChecked) {
                                      style = "bg-red-500/15 border-red-500 text-red-700 dark:text-red-400 font-bold";
                                    } else {
                                      style = "bg-card border-border-theme text-muted opacity-50";
                                    }
                                  }

                                  return (
                                    <button
                                      key={oIdx}
                                      disabled={isAnswered}
                                      onClick={() => {
                                        const correct = activeQ.answer === oIdx;
                                        setNotesQuizState(prev => ({
                                          ...prev,
                                          score: correct ? prev.score + 1 : prev.score,
                                          answers: { ...prev.answers, [qIdx]: oIdx },
                                          showExplanation: true
                                        }));
                                      }}
                                      className={`w-full text-left p-3.5 rounded-2xl border transition-all ${style}`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>

                              {isAnswered && state.showExplanation && (
                                <div className="bg-blue-600/5 border border-blue-500/10 p-4 rounded-2xl leading-relaxed text-muted">
                                  <strong className="text-blue-600 font-bold block mb-1">Explanation:</strong>
                                  <p>{activeQ.explanation || 'No rationale available.'}</p>
                                </div>
                              )}

                              {isAnswered && (
                                <button
                                  onClick={() => setNotesQuizState(prev => ({
                                    ...prev,
                                    currentQuestionIndex: prev.currentQuestionIndex + 1,
                                    showExplanation: false
                                  }))}
                                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-center"
                                >
                                  {qIdx + 1 === quizQs.length ? "Finish Quiz" : "Next Question"}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* TAB VIEW 3: INTERACTIVE FLASHCARDS */}
                    {activeMainTab === 'flashcards' && deepLearningPackage && deepLearningPackage.flashcards && (
                      <div className="bg-card border border-border-theme p-6 rounded-3xl shadow-xs space-y-4 animate-fade-in text-xs">
                        <div className="flex items-center justify-between border-b border-border-theme pb-3">
                          <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider flex items-center space-x-1">
                            <BookOpen className="w-4 h-4" />
                            <span>Memory Flashcards</span>
                          </span>
                          <span className="font-bold text-muted">
                            Card {(notesFlashcardState.currentCardIndex + 1)} of {deepLearningPackage.flashcards.length}
                          </span>
                        </div>

                        {(() => {
                          const state = notesFlashcardState;
                          const cIdx = state.currentCardIndex;
                          const cards = deepLearningPackage.flashcards;
                          const activeC = cards[cIdx] || cards[0];

                          return (
                            <div className="space-y-4">
                              <div 
                                onClick={() => setNotesFlashcardState(prev => ({ ...prev, isFlipped: !prev.isFlipped }))}
                                className="h-48 w-full cursor-pointer perspective-1000 relative select-none"
                              >
                                <div className={`flashcard-inner absolute inset-0 w-full h-full rounded-3xl border border-border-color shadow-xs flex items-center justify-center p-6 text-center ${
                                  state.isFlipped ? 'flashcard-flipped bg-indigo-600/10' : 'bg-bg-secondary/40'
                                }`}>
                                  
                                  {/* FRONT */}
                                  <div className={`backface-hidden absolute inset-0 p-6 flex flex-col justify-center items-center ${
                                    state.isFlipped ? 'opacity-0' : 'opacity-100'
                                  }`}>
                                    <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider mb-2">Question Concept</span>
                                    <p className="text-xs font-bold text-primary leading-relaxed">{activeC.front}</p>
                                    <span className="text-[8px] font-bold text-muted mt-4 uppercase tracking-widest">(Tap to reveal answer)</span>
                                  </div>

                                  {/* BACK */}
                                  <div className={`backface-hidden absolute inset-0 p-6 flex flex-col justify-center items-center rotate-y-180 ${
                                    state.isFlipped ? 'opacity-100' : 'opacity-0'
                                  }`}>
                                    <span className="text-[9px] font-black uppercase text-green-500 tracking-wider mb-2">Explanation</span>
                                    <p className="text-[11px] font-semibold text-primary leading-relaxed">{activeC.back}</p>
                                    <span className="text-[8px] font-bold text-muted mt-4 uppercase tracking-widest">(Tap to flip back)</span>
                                  </div>

                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-3">
                                <button
                                  disabled={cIdx === 0}
                                  onClick={() => setNotesFlashcardState(prev => ({ currentCardIndex: cIdx - 1, isFlipped: false }))}
                                  className="flex-1 py-2.5 border border-border-theme hover:bg-hover-theme rounded-xl font-bold text-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Previous
                                </button>
                                <button
                                  disabled={cIdx + 1 === cards.length}
                                  onClick={() => setNotesFlashcardState(prev => ({ currentCardIndex: cIdx + 1, isFlipped: false }))}
                                  className="flex-1 py-2.5 border border-border-theme hover:bg-hover-theme rounded-xl font-bold text-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Next Card
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* TAB VIEW 4: DEEP LEARNING MIND MAP */}
                    {activeMainTab === 'mindmap' && deepLearningPackage && deepLearningPackage.mindmap && (
                      <div className="bg-card border border-border-theme p-6 rounded-3xl shadow-xs space-y-4 animate-fade-in text-xs">
                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center space-x-1">
                          <Map className="w-4 h-4" />
                          <span>Syllabus Mind Map Outline</span>
                        </span>
                        <div className="bg-bg-secondary/40 border border-border-color p-5 rounded-2xl font-mono text-[10px] text-muted overflow-x-auto whitespace-pre leading-relaxed custom-scrollbar">
                          {deepLearningPackage.mindmap}
                        </div>
                      </div>
                    )}



              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6 py-12 select-none">
              <BookOpen className="w-12 h-12 text-muted animate-pulse" />
              <div className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-primary">No Active Workspace</h3>
                <p className="text-xs text-muted font-semibold leading-relaxed">
                  Select a course or upload a document to begin
                </p>
              </div>
            </div>
          )}
        </motion.main>

        {/* ========================================================================= */}
        {/* PANEL 3: RIGHT PANEL (Summary Level Selectors & Chapters Checklist) */}
        {/* ========================================================================= */}
        <aside className={`fixed ${
          activeMainTab === 'notes'
            ? 'lg:sticky lg:top-16 lg:h-[calc(100vh-64px)]'
            : 'lg:static lg:h-full'
        } right-0 bottom-0 z-[1000] lg:z-10 transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-card border-l border-border-theme flex flex-col ${
          isRightDrawerOpen ? 'w-[300px] translate-x-0' : 'w-0 translate-x-full lg:w-76 lg:translate-x-0'
        }`}>
          {activeWorkspace ? (
            <div className="flex-1 flex flex-col overflow-hidden text-xs">
              
              {/* TOP HEADER */}
              <div className="p-4 border-b border-border-theme bg-bg-secondary/20 flex-shrink-0 flex items-center justify-between">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Upgrade Cockpit</span>
                <button 
                  onClick={() => setIsRightDrawerOpen(false)}
                  className="p-1 hover:bg-hover-theme rounded-lg lg:hidden text-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* LEVEL & JUMP SCROLL BODY */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                
                {/* 1. Summary Depth Level Selector */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Summarization Depth</span>
                  <div className="flex flex-col space-y-1.5">
                    {[
                      { id: 'Quick Summary', desc: 'Slight highlights' },
                      { id: 'Detailed Notes', desc: 'Standard college layout' },
                      { id: 'Exam Preparation Notes', desc: 'Heavily maps definitions & tip warnings' },
                      { id: 'Revision Notes', desc: 'Short revision cards' },
                      { id: 'Deep Learning Mode', desc: 'Quiz, flashcards, mind maps & notes' }
                    ].map(level => {
                      const isSel = activeSummaryLevel === level.id;
                      return (
                        <button
                          key={level.id}
                          onClick={() => setActiveSummaryLevel(level.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col space-y-0.5 ${
                            isSel 
                              ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' 
                              : 'bg-bg-secondary/20 border-border-theme text-primary hover:bg-hover-theme'
                          }`}
                        >
                          <span className="font-bold">{level.id}</span>
                          <span className="text-[9px] font-normal text-muted leading-none">{level.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Progress circle tracker */}
                <div className="bg-bg-secondary/40 border border-border-theme rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
                  <span className="text-[9px] font-black uppercase text-muted tracking-widest">Chapters Mastery</span>
                  
                  <div className="relative h-20 w-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        className="stroke-border-color fill-none"
                        strokeWidth="5.5"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        className="stroke-blue-600 dark:stroke-blue-400 fill-none transition-all duration-500"
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 34}
                        strokeDashoffset={2 * Math.PI * 34 * (1 - progressPercent / 100)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-xs font-black text-primary">{progressPercent}%</span>
                  </div>

                  <span className="text-[9px] font-bold text-muted">
                    {chaptersCompletedCount} of {totalChaptersCount} Completed
                  </span>
                </div>

                {/* 3. Chapter completion checklist */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Chapters Checklist</span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {(!(activeWorkspace.finalTopics || activeWorkspace.topics) || (activeWorkspace.finalTopics || activeWorkspace.topics).length === 0) ? (
                      <div className="p-2.5 rounded-xl border border-dashed border-border-theme bg-bg-secondary/20 text-[10px] text-muted text-center">
                        No chapters detected
                      </div>
                    ) : (
                      (activeWorkspace.finalTopics || activeWorkspace.topics).map((chapter, idx) => {
                        const chNum = chapter.chapterNumber || chapter.chapter_number || (idx + 1);
                        return (
                          <div 
                            key={idx}
                            className="p-2.5 rounded-xl border bg-bg-secondary/20 border-border-theme hover:bg-hover-theme flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2 min-w-0 pr-1">
                              <button
                                onClick={() => handleToggleTopicCompleted(idx)}
                                className="text-muted hover:text-blue-600 transition-colors flex-shrink-0"
                              >
                                {chapter.completed ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-border-color" />
                                )}
                              </button>

                              {chapter.suspicious && (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-505 text-amber-500 mr-0.5 flex-shrink-0" title={`Confidence: ${chapter.confidence}`} />
                              )}

                              <span className={`text-[10px] font-bold truncate leading-normal ${
                                chapter.completed ? 'line-through text-muted' : (chapter.suspicious ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-primary')
                              }`}>
                                Ch {chNum}: {chapter.title}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              <button
                                onClick={() => {
                                  const newTitle = prompt("Edit Chapter Title:", chapter.title);
                                  if (newTitle) handleEditTopic(idx, newTitle);
                                }}
                                className="text-muted hover:text-blue-600 p-1 rounded transition-colors"
                                title="Edit Title"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm("Delete this chapter?")) handleDeleteTopic(idx);
                                }}
                                className="text-muted hover:text-red-500 p-1 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="pt-2 flex items-center space-x-1.5">
                    <button
                      onClick={() => {
                        const title = prompt("Enter new chapter title:");
                        if (title) handleAddTopic(title);
                      }}
                      className="flex-1 py-1.5 px-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black transition-colors text-center"
                    >
                      + Add Chapter
                    </button>
                    <button
                      onClick={handleRegenerateTopics}
                      className="py-1.5 px-3 bg-bg-secondary border border-border-theme hover:bg-hover-theme rounded-xl text-[10px] font-black transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                {/* 4. Goals manager */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Workspace Goals</span>
                  <form onSubmit={handleAddGoal} className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={goalInputValue}
                      onChange={(e) => setGoalInputValue(e.target.value)}
                      placeholder="Add goal..."
                      className="flex-1 bg-bg-secondary text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-border-theme focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!goalInputValue.trim()}
                      className="p-1.5 bg-blue-600 text-white rounded-lg active:scale-95 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {(activeWorkspace.goals || []).map((goal, gIdx) => (
                      <div key={gIdx} className="flex items-center justify-between bg-bg-secondary/40 p-2 rounded-lg border border-border-theme text-[10px] font-semibold text-muted">
                        <span className="truncate pr-2">{goal}</span>
                        <button
                          onClick={() => handleRemoveGoal(gIdx)}
                          className="text-muted hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none text-muted">
              <Sliders className="w-8 h-8 mb-2" />
              <p className="text-[11px] font-semibold leading-relaxed">
                Activate a workspace to configure summaries and checkpoints.
              </p>
            </div>
          )}
        </aside>

      </div>

      {/* DIALOG 1: NEW BOOK / DOCUMENT UPLOAD MODAL */}
      {isNewWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[5000] animate-fade-in text-xs font-semibold">
          <div className="bg-card border border-border-theme w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-4 text-primary">
            
            <button
              onClick={() => setIsNewWorkspaceModalOpen(false)}
              className="absolute right-4 top-4 p-1 hover:bg-hover-theme rounded-lg text-muted"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <h3 className="text-base font-black uppercase tracking-wider">Upload New Study Material</h3>
            </div>

            <form onSubmit={handleCreateCustomWorkspace} className="space-y-3.5">
              
              <div className="space-y-1.5">
                <label className="font-bold text-muted">Document/Book Name *</label>
                <input
                  type="text"
                  required
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g. Probability and Statistics"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border-theme bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted">Initial Chapters (Comma separated)</label>
                <input
                  type="text"
                  value={newWorkspaceTopicsText}
                  onChange={(e) => setNewWorkspaceTopicsText(e.target.value)}
                  placeholder="e.g. Chapter 1: Basics, Chapter 2: Variables"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border-theme bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted">Syllabus Details (Optional)</label>
                <textarea
                  value={newWorkspaceSyllabus}
                  onChange={(e) => setNewWorkspaceSyllabus(e.target.value)}
                  placeholder="Enter outline or description..."
                  className="w-full h-14 p-3 rounded-xl border border-border-theme bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold custom-scrollbar"
                />
              </div>

              <div className="h-px bg-border-color my-4" />

              {/* Upload Syllabus PDF selection */}
              <div className="space-y-2 bg-bg-secondary/40 border border-dashed border-border-color rounded-2xl p-4 text-center">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Extract Outline From Textbook PDF</span>
                <p className="text-[9px] font-bold text-muted mb-2">Upload any PDF textbook to automatically run classification, extract index directories, and build chapters checklist!</p>
                <button
                  type="button"
                  onClick={() => document.getElementById('pdf-workspace-upload')?.click()}
                  disabled={isUploadingPdf}
                  className="px-4 py-2 border border-blue-500/30 hover:border-blue-500 bg-blue-600/5 hover:bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black transition-all flex items-center justify-center space-x-1.5 mx-auto"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingPdf ? 'Uploading...' : 'Upload Textbook PDF'}</span>
                </button>
                <input
                  type="file"
                  id="pdf-workspace-upload"
                  onChange={handlePdfUploadToWorkspace}
                  accept=".pdf"
                  className="hidden"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-750 text-white rounded-xl font-bold transition-all text-center shadow-xs"
                >
                  Add Document Workspace
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewWorkspaceModalOpen(false)}
                  className="flex-1 py-3 border border-border-theme hover:bg-hover-theme text-muted rounded-xl font-bold transition-all text-center"
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* PDF CLASSIFICATION LOADING OVERLAY */}
      {isUploadingPdf && uploadStep && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 select-none">
          <div className="bg-card border border-border-theme rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center space-y-4 text-center text-primary font-semibold">
            
            <div className="p-3 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                {uploadStep === 'uploading' && 'Uploading document...'}
                {uploadStep === 'analyzing' && 'Extracting text pages...'}
                {uploadStep === 'mapping' && 'Extracting actual table of contents...'}
                {uploadStep === 'completed' && 'Textbook successfully analyzed!'}
              </h4>
              <p className="text-[10px] text-muted font-bold max-w-[200px] truncate mx-auto mt-1">
                File: {uploadedFileName}
              </p>
            </div>

            {uploadStep === 'uploading' && (
              <div className="w-full space-y-1.5">
                <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden w-full border border-border-color">
                  <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="text-[9px] font-black text-muted tracking-wide">{uploadProgress}% Uploaded</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GUIDED ONBOARDING MODAL OVERLAY */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 select-none">
          <div className="bg-card border border-border-theme rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col space-y-5 text-primary text-xs font-semibold">
            <div className="flex justify-between items-center border-b border-border-theme pb-3">
              <h3 className="text-sm font-black uppercase text-blue-600 tracking-wider">Beta Onboarding ({onboardingStep + 1}/{onboardingSteps.length})</h3>
              <button 
                onClick={handleSkipOnboarding}
                className="text-[10px] font-bold text-muted hover:text-primary transition-all"
              >
                Skip
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-base font-black text-primary leading-tight">{onboardingSteps[onboardingStep].title}</h4>
              <p className="text-muted leading-relaxed">{onboardingSteps[onboardingStep].desc}</p>
              
              {onboardingSteps[onboardingStep].options && (
                <div className="space-y-2 pt-2">
                  {onboardingSteps[onboardingStep].options.map((opt, oIdx) => (
                    <div key={oIdx} className="p-3 bg-bg-secondary/40 border border-border-theme rounded-xl flex items-center space-x-2.5">
                      <span className="h-2 w-2 bg-blue-600 rounded-full" />
                      <span className="font-bold">{opt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3 pt-3">
              <button
                onClick={handleNextOnboarding}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-750 text-white rounded-xl font-bold transition-all text-center"
              >
                {onboardingStep === onboardingSteps.length - 1 ? 'Get Started 🚀' : 'Next Step'}
              </button>
              {onboardingStep > 0 && (
                <button
                  onClick={() => setOnboardingStep(prev => prev - 1)}
                  className="px-4 py-3 border border-border-theme hover:bg-hover-theme text-muted rounded-xl font-bold transition-all text-center"
                >
                  Back
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IN-APP FEEDBACK MODAL OVERLAY */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
          <div className="bg-card border border-border-theme rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col space-y-4 text-primary text-xs font-semibold">
            <div className="flex justify-between items-center border-b border-border-theme pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-primary">Submit Beta Feedback 🐛</h3>
              <button 
                onClick={() => setShowFeedbackModal(false)}
                className="text-[10px] font-bold text-muted hover:text-primary transition-all"
              >
                Close
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-muted">Feedback Category</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-theme bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
              >
                <option value="bug_report">Bug Report</option>
                <option value="ai_issue">AI Issue / Mistranslation</option>
                <option value="content_incorrect">Incorrect Content / Answer</option>
                <option value="missing_syllabus">Missing Syllabus Chapters</option>
                <option value="feature_request">Feature Request</option>
                <option value="general_feedback">General Feedback</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-muted">Description</label>
              <textarea
                rows={4}
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Describe your issue or request in detail..."
                className="w-full p-3 rounded-xl border border-border-theme bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold custom-scrollbar"
              />
            </div>

            <button
              onClick={handleSendFeedback}
              disabled={isFeedbackSubmitting || !feedbackMessage.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-750 text-white rounded-xl font-bold transition-all text-center disabled:opacity-40"
            >
              {isFeedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}

      {/* PREMIUM UPGRADE DIALOG OVERLAY */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
          <div className="bg-card border border-border-theme rounded-3xl p-6 w-full max-w-2xl shadow-2xl flex flex-col space-y-5 text-primary text-xs font-semibold max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            <div className="flex justify-between items-center border-b border-border-theme pb-3">
              <div className="flex items-center space-x-1.5 text-amber-500">
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider text-primary">Upgrade Your Learning Journey</h3>
              </div>
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="text-[10px] font-bold text-muted hover:text-primary transition-all"
              >
                Close
              </button>
            </div>

            {/* Quota limit diagnostics */}
            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl space-y-2">
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block">Current Plan Status</span>
              <p className="text-[11px] leading-relaxed text-muted">
                You are currently on the <strong className="text-primary">Free Basic Plan</strong>. 
                Your active workspace creation limits are capped at <strong>2 workspaces</strong>. Upgrade to unleash custom textbooks classifications and unlimited active cognitive recall outlines.
              </p>
            </div>

            {/* Plan Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              
              {/* Free Plan */}
              <div className="bg-bg-secondary/40 border border-border-theme p-4 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <h4 className="font-black text-xs uppercase tracking-wider text-primary">Free Basic</h4>
                  <span className="text-xl font-black text-primary">$0</span>
                  <p className="text-[9px] text-muted">Ideal for introductory trials</p>
                </div>
                <div className="space-y-2 text-[10px] text-muted">
                  <p>✓ AI Tutor Chat: Limited</p>
                  <p>✓ Notes: 3 per month</p>
                  <p>✓ Flashcards: 20 max</p>
                  <p>✗ Advanced Analytics</p>
                </div>
                <button
                  disabled
                  className="w-full py-2 border border-border-theme text-muted rounded-xl font-bold transition-all text-center text-[10px]"
                >
                  Current Plan
                </button>
              </div>

              {/* Student Pro Plan */}
              <div className="bg-blue-600/5 border-2 border-blue-500 p-4 rounded-2xl flex flex-col justify-between space-y-4 relative">
                <span className="absolute -top-2.5 right-4 bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">POPULAR</span>
                <div className="space-y-1">
                  <h4 className="font-black text-xs uppercase tracking-wider text-primary">Student Pro</h4>
                  <span className="text-xl font-black text-primary">$4.99/mo</span>
                  <p className="text-[9px] text-muted">Best for college semesters</p>
                </div>
                <div className="space-y-2 text-[10px] text-muted">
                  <p>✓ AI Tutor: Unlimited Priority</p>
                  <p>✓ Notes: 20 per month</p>
                  <p>✓ Flashcards: 150 max</p>
                  <p>✓ Spaced Repetition Analytics</p>
                </div>
                <button
                  onClick={() => handleUpgradeToPlan('student_pro')}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-750 text-white rounded-xl font-bold transition-all text-center text-[10px] shadow-xs active:scale-95"
                >
                  Get Student Pro
                </button>
              </div>

              {/* Student Pro+ Plan */}
              <div className="bg-bg-secondary/40 border border-border-theme p-4 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <h4 className="font-black text-xs uppercase tracking-wider text-primary">Student Pro+</h4>
                  <span className="text-xl font-black text-primary">$9.99/mo</span>
                  <p className="text-[9px] text-muted">For high-intensity prep</p>
                </div>
                <div className="space-y-2 text-[10px] text-muted">
                  <p>✓ AI Tutor: High priority priority</p>
                  <p>✓ Notes: 100 per month</p>
                  <p>✓ Flashcards: 1000 max</p>
                  <p>✓ Multi-Workspace: 50 workspaces</p>
                </div>
                <button
                  onClick={() => handleUpgradeToPlan('student_pro_plus')}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-755 text-white rounded-xl font-bold transition-all text-center text-[10px] shadow-xs active:scale-95"
                >
                  Get Student Pro+
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
