import { useState, useRef, useEffect } from 'react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import aiService from '../../services/aiService';

import { analyticsService } from '../../services/firebase/firestoreService';
import { Book, Plus, Trash2, BarChart2, User, LogOut, Loader2, Sparkles, FileText, BrainCircuit, Check, LayoutDashboard, Settings, Star, Sparkle, MessageSquare, Award, TrendingUp, BookOpen, Compass } from 'lucide-react';

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
    const user = auth?.currentUser;
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
    const user = auth?.currentUser;
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

export default function Sidebar({ 
  selectedSubjectId, 
  onSelectSubject, 
  isCollapsed = false,
  onToggleChat,
  onSelectLearningTab
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { mobileSidebarOpen, setMobileSidebarOpen } = useSidebar();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, setMobileSidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  const [courses, setCourses] = useState([]);
  const [user, setUser] = useState(null);
  const [showNewCourseDialog, setShowNewCourseDialog] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadStep, setUploadStep] = useState(null); // null | 'uploading' | 'analyzing' | 'mapping' | 'completed'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const cancelUploadRef = useRef(false);

  const [topicsState, setTopicsState] = useState([]);
  const setTopics = (finalTopics) => {
    setTopicsState(finalTopics);
  };

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameCourseId, setRenameCourseId] = useState('');
  const [renameCourseName, setRenameCourseName] = useState('');

  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsCourse, setDetailsCourse] = useState(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCourseId, setDeleteCourseId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Pro features & Popover states
  const [isPro, setIsPro] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load initial pro subscription status
        const storedPro = localStorage.getItem(`isPro_${currentUser.uid}`) === 'true';
        setIsPro(storedPro);

        if (db) {
          const userRef = doc(db, 'users', currentUser.uid);
          onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().isPro !== undefined) {
              const firestorePro = docSnap.data().isPro;
              setIsPro(firestorePro);
              localStorage.setItem(`isPro_${currentUser.uid}`, firestorePro ? 'true' : 'false');
            }
          }, (err) => {
            console.error("Firestore user profile sync in Sidebar failed:", err);
          });
        }

        // Real-time Firestore stream for workspaces
        const wsRef = collection(db, 'users', currentUser.uid, 'workspaces');
        const q = query(wsRef, orderBy('createdAt', 'desc'));

        const unsubFirestore = onSnapshot(q, (snapshot) => {
          const fetched = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              subject_name: data.name,
              ...data
            };
          });
          setCourses(fetched);
        }, (error) => {
          console.warn("Firestore error in sidebar:", error);
          setCourses([]);
        });

        return () => unsubFirestore();
      } else {
        setCourses([]);
      }
    });

    return () => unsubAuth();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    setIsGenerating(true);

    try {
      const brainData = await aiService.generateBrainFromPdf("", newCourseName.trim());

      const courseData = {
        subject_name: newCourseName.trim(),
        topics: (brainData.topics || []).map(t => ({
          title: t.title,
          difficulty: t.difficulty || "Medium",
          summary: t.summary || ""
        })),
        createdAt: serverTimestamp()
      };

      analyticsService.logCourseCreated(courseData.subject_name);

      if (user && db) {
        try {
          const workspaceData = {
            ...courseData,
            name: courseData.subject_name || newCourseName,
            updatedAt: new Date().toISOString()
          };
          await addDoc(collection(db, 'users', user.uid, 'workspaces'), workspaceData);
          await addDoc(collection(db, 'users', user.uid, 'subjects'), courseData).catch(() => {});
        } catch (dbError) {
          console.warn("Could not save to firestore, writing to localStorage", dbError);
          const currentLocal = JSON.parse(localStorage.getItem(`courses_${user.uid}`) || '[]');
          const updatedLocal = [{ id: `course-${Date.now()}`, ...courseData, createdAt: new Date().toISOString() }, ...currentLocal];
          localStorage.setItem(`courses_${user.uid}`, JSON.stringify(updatedLocal));
          setCourses(updatedLocal);
        }
      }

      setNewCourseName('');
      setShowNewCourseDialog(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelUpload = () => {
    cancelUploadRef.current = true;
    setIsGenerating(false);
    setUploadStep(null);
    setUploadProgress(0);
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    cancelUploadRef.current = false;
    setUploadedFileName(file.name);
    setUploadStep('uploading');
    setUploadProgress(0);
    setIsGenerating(true);
    setShowNewCourseDialog(false);

    setTopics([]);
    localStorage.removeItem("topics");
    sessionStorage.removeItem("topics");

    console.log("UPLOAD START");

    const courseName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    let finalTopics = [];
    let source = "empty";

    try {
      // 1. Load pdfjs-dist dynamically
      const pdfjs = await loadPdfJs();
      if (cancelUploadRef.current) return;

      // 2. Read array buffer
      const arrayBuffer = await file.arrayBuffer();
      if (cancelUploadRef.current) return;

      // 3. Load pdf document
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      if (cancelUploadRef.current) return;

      setUploadStep('analyzing');
      setUploadProgress(50);

      // STEP 1: Extract page text page-by-page.
      const pages = [];
      const maxPagesToSearch = Math.min(pdfDoc.numPages, 40);
      let tocStarted = false;
      let contentPageCount = 0;
      const tocPages = [];

      for (let pageNum = 1; pageNum <= maxPagesToSearch; pageNum++) {
        if (cancelUploadRef.current) return;
        try {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Reconstruct line boundaries using a 4px Y-coordinate tolerance
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

      let pdfText = tocPages.map(p => p.text).join("\n");

      console.log("TEXT LENGTH", pdfText.length);

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
        finalTopics = processTopics(rawChapters).map((item, idx) => ({
          chapterNumber: idx + 1,
          title: item.title,
          subtopics: item.subtopics,
          description: `Chapter ${idx + 1}: ${item.title}.`,
          difficulty: item.difficulty || "Medium",
          pageRange: "N/A",
          completed: false,
          summary: ''
        }));
        source = "toc";
      } else {
        console.log("TOC not found. Running fallback...");
        const brainData = await aiService.generateBrainFromPdf("", courseName);
        finalTopics = (brainData.topics || []).map((t, idx) => ({
          chapterNumber: idx + 1,
          title: t.title,
          description: t.summary || `Module ${idx + 1}: ${t.title}.`,
          difficulty: t.difficulty || "Medium",
          pageRange: "N/A",
          completed: false,
          summary: ''
        }));
        source = "fallback";
      }
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
    }

    // Always save course / subject even if empty
    const courseData = {
      subject_name: courseName,
      topics: finalTopics,
      source: source,
      createdAt: serverTimestamp()
    };

    analyticsService.logCourseCreated(courseData.subject_name);

    if (user) {
      try {
        const workspaceData = {
          ...courseData,
          name: courseData.subject_name || courseName,
          updatedAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'users', user.uid, 'workspaces'), workspaceData);
        await addDoc(collection(db, 'users', user.uid, 'subjects'), courseData).catch(() => {});
      } catch (dbError) {
        console.warn("Could not save to firestore, writing to localStorage", dbError);
        const currentLocal = JSON.parse(localStorage.getItem(`courses_${user.uid}`) || '[]');
        const updatedLocal = [{ id: `course-${Date.now()}`, ...courseData, createdAt: new Date().toISOString() }, ...currentLocal];
        localStorage.setItem(`courses_${user.uid}`, JSON.stringify(updatedLocal));
        setCourses(updatedLocal);
      }
    }

    if (!cancelUploadRef.current) {
      setIsGenerating(false);
      setUploadStep(null);
      setUploadProgress(0);
      setToastMessage("Syllabus processed and Course mapped!");
      setTimeout(() => setToastMessage(''), 3000);
      console.log("UPLOAD COMPLETE");
    }
  };

  const handleRenameCourse = async (e) => {
    e.preventDefault();
    if (!renameCourseName.trim() || !user || !renameCourseId) return;
    try {
      const wsDocRef = doc(db, 'users', user.uid, 'workspaces', renameCourseId);
      await updateDoc(wsDocRef, {
        name: renameCourseName,
        subject_name: renameCourseName,
        updatedAt: new Date().toISOString()
      }).catch(() => {});

      const subjectDocRef = doc(db, 'users', user.uid, 'subjects', renameCourseId);
      await updateDoc(subjectDocRef, {
        subject_name: renameCourseName,
        name: renameCourseName
      }).catch(() => {});

      setCourses(prev => prev.map(c => c.id === renameCourseId ? { ...c, name: renameCourseName, subject_name: renameCourseName } : c));
      setShowRenameDialog(false);
      setRenameCourseId('');
      setRenameCourseName('');
      setToastMessage("Course renamed successfully");
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error(err);
      const updated = courses.map(c => c.id === renameCourseId ? { ...c, name: renameCourseName, subject_name: renameCourseName } : c);
      localStorage.setItem(`courses_${user.uid}`, JSON.stringify(updated));
      setCourses(updated);
      setShowRenameDialog(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCourseId || !user) return;
    setIsDeleting(true);
    try {
      const workspaceDocRef = doc(db, 'users', user.uid, 'workspaces', deleteCourseId);
      await deleteDoc(workspaceDocRef).catch(() => {});

      const subjectDocRef = doc(db, 'users', user.uid, 'subjects', deleteCourseId);
      await deleteDoc(subjectDocRef).catch(() => {});
 
      if (selectedSubjectId === deleteCourseId) {
        onSelectSubject(null, null);
      }
      setCourses(prev => prev.filter(c => c.id !== deleteCourseId));
      setShowDeleteConfirm(false);
      setDeleteCourseId('');
      setToastMessage("Course deleted successfully");
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.warn("Could not delete from firestore, removing from local:", err);
      const updatedLocal = courses.filter(c => c.id !== deleteCourseId);
      localStorage.setItem(`courses_${user.uid}`, JSON.stringify(updatedLocal));
      setCourses(updatedLocal);
      
      if (selectedSubjectId === deleteCourseId) {
        onSelectSubject(null, null);
      }
      setShowDeleteConfirm(false);
      setDeleteCourseId('');
      setToastMessage("Course deleted successfully");
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpgradeToPro = async () => {
    if (user) {
      if (db) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { isPro: true });
        } catch (e) {
          console.warn("Failed to set isPro in Firestore, writing locally:", e);
        }
      }
      
      analyticsService.logSubscriptionUpgraded('Annual Pro', 79.99);
      analyticsService.logPaymentCompleted('Annual Pro', 79.99);

      localStorage.setItem(`isPro_${user.uid}`, 'true');
      setIsPro(true);
    }
    setShowUpgradeModal(false);
    setToastMessage("Welcome to HyperBrain Pro!");
    setTimeout(() => setToastMessage(''), 3550);
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error(err);
      navigate('/login');
    }
  };

  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || "Student";
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  // Navigation Helpers
  const isDashboardActive = location.pathname === '/dashboard' && !selectedSubjectId;
  const isMockExamsActive = location.pathname === '/mock-exam';

  const handleNewCourseClick = () => {
    if (location.pathname === '/dashboard') {
      window.dispatchEvent(new Event('hb_open_workspace_creator'));
    } else {
      navigate('/dashboard?create=true');
    }
  };
  const isFlashcardsActive = location.pathname === '/flashcards';
  const isStudyPlanActive = location.pathname === '/study-plan';
  const isProgressActive = location.pathname === '/progress';
  const isProfileActive = location.pathname === '/profile';
  const isPreferencesActive = location.pathname === '/preferences';

  const navItemClass = (isActive) => `
    w-full flex items-center px-3 py-2.5 space-x-3 rounded-2xl transition-all duration-300 group text-xs font-semibold
    ${isActive 
      ? 'bg-primary/15 text-primary font-bold border-l-2 border-primary shadow-theme-glow' 
      : 'text-text-muted hover:bg-surface hover:text-text hover:-translate-y-[0.5px] transform'
    }
  `;

  const collapsedNavItemClass = (isActive) => `
    w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 group mx-auto
    ${isActive 
      ? 'bg-primary/15 text-primary border-l-2 border-primary shadow-theme-glow' 
      : 'text-text-muted hover:bg-surface hover:text-text hover:scale-105 transform'
    }
  `;

  return (
    <div className={`h-full bg-card border-r border-border-theme flex flex-col transition-all duration-250 flex-shrink-0 select-none ${isCollapsed ? 'w-[84px]' : 'w-[280px]'}`}>
      
      {/* New Course Button Area */}
      <div className={`flex transition-all duration-250 ${isCollapsed ? 'justify-center pt-6 pb-4 px-2' : 'px-4 pt-6 pb-2'}`}>
        {isCollapsed ? (
          <button
            onClick={handleNewCourseClick}
            className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all duration-200 active:scale-95 shadow-sm"
            title="Create/Import New Course"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        ) : (
          <button
            onClick={handleNewCourseClick}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-2.5 rounded-2xl transition-all shadow-sm text-sm focus-ring"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>New Course</span>
          </button>
        )}
      </div>

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6 custom-scrollbar py-4">
        
        {/* SECTION 1: WORKSPACE */}
        <div className="space-y-1">
          {!isCollapsed && (
            <span className="px-3 text-[10px] font-black text-muted uppercase tracking-widest block mb-2 transition-colors duration-300">
              Workspace
            </span>
          )}
          
          <button
            onClick={() => { onSelectSubject(null, null); navigate('/dashboard'); }}
            className={isCollapsed ? collapsedNavItemClass(isDashboardActive) : navItemClass(isDashboardActive)}
            title="Overview"
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
            {!isCollapsed && <span>Overview</span>}
          </button>



          <button
            onClick={() => navigate('/mock-exam')}
            className={isCollapsed ? collapsedNavItemClass(isMockExamsActive) : navItemClass(isMockExamsActive)}
            title="Mock Exams"
          >
            <Award className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
            {!isCollapsed && <span>Mock Exams</span>}
          </button>
        </div>

        {/* SECTION 2: LEARNING */}
        <div className="space-y-1">
          {!isCollapsed && (
            <span className="px-3 text-[10px] font-black text-muted uppercase tracking-widest block mb-2 transition-colors duration-300">
              Learning
            </span>
          )}

          <button
            onClick={() => {
              console.log("[Sidebar Debug] Sidebar click detected: Flashcards");
              console.log("[Sidebar Debug] Route requested: /flashcards");
              navigate('/flashcards');
            }}
            className={isCollapsed ? collapsedNavItemClass(isFlashcardsActive) : navItemClass(isFlashcardsActive)}
            title="Flashcards"
          >
            <BookOpen className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
            {!isCollapsed && <span>Flashcards</span>}
          </button>

          <button
            onClick={() => navigate('/study-plan')}
            className={isCollapsed ? collapsedNavItemClass(isStudyPlanActive) : navItemClass(isStudyPlanActive)}
            title="Study Plan"
          >
            <FileText className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
            {!isCollapsed && <span>Study Plan</span>}
          </button>

          <button
            onClick={() => navigate('/progress')}
            className={isCollapsed ? collapsedNavItemClass(isProgressActive) : navItemClass(isProgressActive)}
            title="Progress"
          >
            <TrendingUp className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
            {!isCollapsed && <span>Progress</span>}
          </button>
        </div>

        {/* SECTION 3: COURSES */}
        <div className="space-y-1">
          {!isCollapsed ? (
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest block transition-colors duration-300">
                Courses
              </span>
              <span className="bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {courses.length}
              </span>
            </div>
          ) : (
            <div className="border-t border-border-theme my-2 pt-2" />
          )}

          <div className="space-y-1">
            {courses.length === 0 ? (
              !isCollapsed && (
                <div className="px-3 py-2 text-[11px] text-muted italic">
                  No courses generated yet.
                </div>
              )
            ) : (
              courses.map((course) => {
                const isSelected = selectedSubjectId === course.id;
                
                return isCollapsed ? (
                  <button
                    key={course.id}
                    onClick={() => {
                      if (onSelectSubject) onSelectSubject(course.id, course);
                      navigate(`/course/${course.id}`);
                    }}
                    className={collapsedNavItemClass(isSelected)}
                    title={course.subject_name}
                  >
                    <Book className="w-5 h-5 flex-shrink-0" />
                  </button>
                ) : (
                  <div
                    key={course.id}
                    onClick={() => {
                      if (onSelectSubject) onSelectSubject(course.id, course);
                      navigate(`/course/${course.id}`);
                    }}
                    className={`group flex items-center justify-between rounded-2xl cursor-pointer transition-all duration-300 text-[11px] p-2.5 border ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-600/30 text-blue-600 dark:text-blue-400 font-bold shadow-sm shadow-blue-500/5'
                        : 'border-transparent text-muted hover:bg-bg-secondary hover:text-primary'
                    }`}
                    title={course.subject_name}
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0 pr-2" title={course.subject_name}>
                      <Book className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:rotate-6 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-muted'}`} />
                      <span className="truncate">{course.subject_name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteCourseId(course.id);
                        setShowDeleteConfirm(true);
                      }}
                      className="opacity-55 hover:opacity-100 p-1.5 hover:bg-red-500/10 text-red-500 hover:text-red-600 rounded-lg transition-all duration-200 flex-shrink-0"
                      title="Delete Course"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECTION 4: SYSTEM */}
        <div className="space-y-1">
          {!isCollapsed && (
            <span className="px-3 text-[10px] font-black text-muted uppercase tracking-widest block mb-2 transition-colors duration-300">
              System
            </span>
          )}

          <button
            onClick={() => navigate('/profile')}
            className={isCollapsed ? collapsedNavItemClass(isProfileActive) : navItemClass(isProfileActive)}
            title="Profile"
          >
            <User className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
            {!isCollapsed && <span>Profile</span>}
          </button>

          <button
            onClick={() => navigate('/preferences')}
            className={isCollapsed ? collapsedNavItemClass(isPreferencesActive) : navItemClass(isPreferencesActive)}
            title="Preferences"
          >
            <Settings className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:rotate-45" />
            {!isCollapsed && <span>Preferences</span>}
          </button>
        </div>

        {/* Upgrade Banner for Non-Pro accounts */}
        {!isPro && !isCollapsed && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white space-y-3 relative overflow-hidden shadow-sm mt-4">
            <div className="absolute -right-6 -bottom-6 opacity-10">
              <BrainCircuit className="w-20 h-20 text-white" />
            </div>
            <div className="flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-yellow-300 fill-yellow-300 animate-bounce" />
              <span className="text-[10px] font-black uppercase tracking-wider text-yellow-300">HyperBrain Premium</span>
            </div>
            <p className="text-[11px] font-medium leading-relaxed opacity-95">
              Unlock unlimited mock exams and advanced AI syllabus mappings.
            </p>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="w-full bg-white hover:bg-slate-50 text-blue-700 text-xs font-bold py-2 rounded-2xl transition-all active:scale-[0.98] shadow-sm hover:shadow"
            >
              Upgrade to Pro
            </button>
          </div>
        )}

        {/* Mini Pro badge shortcut if collapsed and not Pro */}
        {!isPro && isCollapsed && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full transition-all hover:scale-105 active:scale-95 shadow-md group relative"
              title="Upgrade to Pro"
            >
              <Sparkle className="w-4 h-4 text-yellow-300 fill-yellow-300 animate-spin" style={{ animationDuration: '6s' }} />
            </button>
          </div>
        )}
      </div>

      {/* User Info Footer Section */}
      <div 
        ref={profileMenuRef}
        className={`border-t border-border-theme bg-bg-secondary/40 transition-all duration-300 relative ${
          isCollapsed ? 'p-3 flex justify-center' : 'p-4 flex items-center justify-between'
        }`}
      >
        {isCollapsed ? (
          <div className="relative">
            <div 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0 cursor-pointer shadow-md hover:ring-2 hover:ring-blue-500/50 transition-all"
            >
              {userInitial}
              {isPro && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-yellow-400 border border-white dark:border-slate-900 rounded-full flex items-center justify-center text-[7px] text-black font-extrabold font-sans">
                  ★
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <div 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-3 overflow-hidden cursor-pointer group"
            >
              <div className="relative h-10 w-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0 group-hover:opacity-95 transition-opacity">
                {userInitial}
                {isPro && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-yellow-400 border border-white dark:border-slate-800 rounded-full flex items-center justify-center text-[8px] text-black font-black">
                    ★
                  </span>
                )}
              </div>
              <div className="flex flex-col overflow-hidden text-left font-sans">
                <span className="text-sm font-bold text-primary truncate group-hover:text-blue-600 transition-colors duration-300">
                  {userDisplayName}
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wider transition-colors duration-300">
                    {isPro ? 'Pro Account' : 'Free Tier'}
                  </span>
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 text-muted hover:text-red-500 rounded-2xl hover:bg-bg-secondary transition-colors duration-300"
              title="Sign Out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </>
        )}

        {/* Custom Profile Dropdown Popover */}
        {showProfileMenu && (
          <div className={`absolute bg-card border border-border-theme rounded-2xl shadow-xl z-50 py-1.5 text-xs font-semibold text-primary w-48 ${
            isCollapsed ? 'bottom-16 left-3' : 'bottom-16 right-4'
          }`}>
            <div className="px-3.5 py-2 border-b border-border-theme mb-1">
              <p className="text-[9px] font-black uppercase text-muted tracking-wider transition-colors duration-300">My Account</p>
              <p className="text-xs font-bold text-primary truncate transition-colors duration-300">{userDisplayName}</p>
            </div>
            
            <button
              onClick={() => { navigate('/profile'); setShowProfileMenu(false); }}
              className="w-full text-left px-3.5 py-2 hover:bg-bg-secondary flex items-center space-x-2 text-primary transition-colors duration-300"
            >
              <User className="w-3.5 h-3.5 text-muted" />
              <span>Edit Profile</span>
            </button>
            
            <button
              onClick={() => { navigate('/stats'); setShowProfileMenu(false); }}
              className="w-full text-left px-3.5 py-2 hover:bg-bg-secondary flex items-center space-x-2 text-primary transition-colors duration-300"
            >
              <BarChart2 className="w-3.5 h-3.5 text-muted" />
              <span>Performance</span>
            </button>

            <button
              onClick={() => { navigate('/profile', { state: { focusSection: 'preferences' } }); setShowProfileMenu(false); }}
              className="w-full text-left px-3.5 py-2 hover:bg-bg-secondary flex items-center space-x-2 text-primary transition-colors duration-300"
            >
              <Settings className="w-3.5 h-3.5 text-muted" />
              <span>Preferences</span>
            </button>

            {!isPro && (
              <button
                onClick={() => { setShowUpgradeModal(true); setShowProfileMenu(false); }}
                className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-blue-955/20 flex items-center space-x-2 text-blue-600 dark:text-blue-400 border-t border-border-theme my-1 font-bold transition-colors duration-300"
              >
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-500" />
                <span>Go Pro Member</span>
              </button>
            )}

            <hr className="border-border-theme my-1" />

            <button
              onClick={handleSignOut}
              className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-955/20 flex items-center space-x-2 text-red-600 font-bold transition-colors duration-300"
            >
              <LogOut className="w-3.5 h-3.5 text-muted" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* New Course Dialog Modal */}
      {showNewCourseDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card border border-border-theme p-6 rounded-2xl w-full max-w-sm shadow-xl text-primary transition-colors duration-300">
            <h3 className="text-lg font-bold text-primary mb-4 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-indigo-655 dark:text-indigo-400 animate-pulse" />
              Generate Course
            </h3>
            
            {isGenerating && !uploadStep ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-sm font-bold text-primary">Analyzing Syllabus...</p>
                  <p className="text-xs text-muted">This may take a moment based on file size.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 font-sans">
                 <div>
                   <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                     Upload Syllabus PDF
                   </label>
                   <input
                     type="file"
                     accept=".pdf"
                     onChange={handlePdfUpload}
                     className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-2xl file:border file:border-border-theme file:text-xs file:font-semibold file:bg-bg-secondary file:text-primary hover:file:bg-bg-secondary/80 cursor-pointer transition-colors duration-300"
                   />
                 </div>

                 <div className="flex items-center my-3">
                   <div className="flex-1 border-t border-border-theme"></div>
                   <span className="px-3 text-xs text-muted font-bold">OR</span>
                   <div className="flex-1 border-t border-border-theme"></div>
                 </div>

                 <form onSubmit={handleCreateCourse}>
                   <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                     Enter Course Name
                   </label>
                   <input
                     type="text"
                     required
                     value={newCourseName}
                     onChange={(e) => setNewCourseName(e.target.value)}
                     placeholder="e.g. Computer Science"
                     className="w-full px-3 py-2.5 border border-border-theme rounded-2xl bg-bg-secondary text-primary text-sm focus-ring mb-4 transition-colors duration-300 placeholder-h-secondary"
                   />
                   <div className="flex space-x-2 justify-end">
                     <button
                       type="button"
                       onClick={() => setShowNewCourseDialog(false)}
                       className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-2xl text-muted hover:bg-bg-secondary transition-colors duration-300"
                     >
                       Cancel
                     </button>
                     <button
                       type="submit"
                       className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm focus-ring"
                     >
                       Generate
                     </button>
                   </div>
                 </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Syllabus Upload Progress Modal */}
      {isGenerating && uploadStep && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card border border-border-theme p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-6 text-primary transition-colors duration-300">
            
            <div className="flex items-center justify-between pb-3 border-b border-border-theme">
              <div className="flex items-center space-x-2.5">
                <FileText className="w-5 h-5 text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest">Processing Syllabus</span>
                  <span className="text-sm font-bold text-primary truncate max-w-[240px]">{uploadedFileName}</span>
                </div>
              </div>
              <span className="text-[10px] text-muted font-bold bg-bg-secondary px-2 py-0.5 rounded-full select-none border border-border-theme">
                Est. time: 6s
              </span>
            </div>

            <div className="flex flex-col items-center justify-center py-6 space-y-5 text-center">
              {uploadStep === 'uploading' && (
                <div className="w-full space-y-4 font-sans">
                  <div className="h-12 w-12 bg-bg-secondary border border-border-theme rounded-full flex items-center justify-center mx-auto text-blue-600">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-primary">Uploading syllabus...</h4>
                    <p className="text-xs text-muted font-semibold">Uploading your syllabus file</p>
                  </div>
                  <div className="w-full max-w-[280px] mx-auto space-y-1.5">
                    <div className="w-full bg-bg-secondary h-2 rounded-full overflow-hidden border border-border-theme">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted font-bold">{uploadProgress}% uploaded</span>
                  </div>
                </div>
              )}

              {uploadStep === 'analyzing' && (
                <div className="w-full space-y-4 font-sans">
                  <div className="h-12 w-12 bg-bg-secondary border border-border-theme rounded-full flex items-center justify-center mx-auto text-blue-600">
                    <BrainCircuit className="h-6 w-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-primary">Analyzing Syllabus structure...</h4>
                    <p className="text-xs text-muted font-semibold">AI is analyzing chapters and topics</p>
                  </div>
                  <div className="w-48 bg-bg-secondary h-1.5 rounded-full overflow-hidden mx-auto border border-border-theme">
                    <div className="bg-indigo-600 h-full w-2/3 rounded-full animate-pulse" />
                  </div>
                </div>
              )}

              {uploadStep === 'mapping' && (
                <div className="w-full space-y-4 font-sans">
                  <div className="h-12 w-12 bg-bg-secondary border border-border-theme rounded-full flex items-center justify-center mx-auto text-indigo-600">
                    <Sparkles className="h-6 w-6 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-primary">Generating Study Modules...</h4>
                    <p className="text-xs text-muted font-semibold">Mapping custom lectures and exams</p>
                  </div>
                  <div className="w-48 bg-bg-secondary h-1.5 rounded-full overflow-hidden mx-auto border border-border-theme">
                    <div className="bg-indigo-600 h-full w-5/6 rounded-full animate-pulse" style={{ animationDuration: '1s' }} />
                  </div>
                </div>
              )}

              {uploadStep === 'completed' && (
                <div className="w-full space-y-4 font-sans">
                  <div className="h-12 w-12 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto text-green-500">
                    <Check className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-primary">Syllabus Mapping Completed!</h4>
                    <p className="text-xs text-muted font-semibold">Your workspace has been customized</p>
                  </div>
                </div>
              )}
            </div>

            {uploadStep !== 'completed' && (
              <div className="flex justify-end pt-3 border-t border-border-theme">
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-2xl text-muted hover:bg-bg-secondary transition-colors duration-300"
                >
                  Cancel
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Rename Course Dialog Modal */}
      {showRenameDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card border border-border-theme p-6 rounded-2xl w-full max-w-sm shadow-xl space-y-4 text-primary transition-colors duration-300 animate-scale-up">
            <h3 className="text-sm font-black text-primary uppercase tracking-widest">
              Rename Course
            </h3>
            <form onSubmit={handleRenameCourse} className="space-y-4">
              <input
                type="text"
                required
                value={renameCourseName}
                onChange={(e) => setRenameCourseName(e.target.value)}
                className="w-full px-3 py-2.5 border border-border-theme rounded-2xl bg-bg-secondary text-primary text-sm focus-ring transition-colors duration-300 placeholder-h-secondary"
              />
              <div className="flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => { setShowRenameDialog(false); setRenameCourseId(''); }}
                  className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-2xl text-muted hover:bg-bg-secondary transition-colors duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm focus-ring"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Details Dialog Modal */}
      {showDetailsDialog && detailsCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card border border-border-theme p-6 rounded-2xl w-full max-w-sm shadow-xl space-y-4 text-primary transition-colors duration-300 animate-scale-up">
            <div className="flex items-center space-x-2 pb-2 border-b border-border-theme">
              <Book className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-black text-primary uppercase tracking-widest">
                Course Details
              </h3>
            </div>
            
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Subject Name</span>
                <span className="font-bold text-primary">{detailsCourse.subject_name}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Topics Count</span>
                <span className="font-bold text-primary">{detailsCourse.topics?.length || 0} Modules</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Generation Date</span>
                <span className="font-bold text-primary">
                  {detailsCourse.createdAt?.seconds 
                    ? new Date(detailsCourse.createdAt.seconds * 1000).toLocaleDateString()
                    : new Date().toLocaleDateString()
                  }
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border-theme">
              <button
                type="button"
                onClick={() => { setShowDetailsDialog(false); setDetailsCourse(null); }}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm focus-ring"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card border border-border-theme p-6 rounded-2xl w-full max-w-sm shadow-xl space-y-4 text-primary transition-colors duration-300 animate-scale-up">
            <h3 className="text-sm font-black text-red-500 uppercase tracking-widest">
              Delete Course?
            </h3>
            <p className="text-xs text-muted font-semibold leading-relaxed">
              Are you sure you want to permanently delete this course study brain? This action is irreversible.
            </p>
            <div className="flex justify-end space-x-2.5 pt-2 border-t border-border-theme">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => { setShowDeleteConfirm(false); setDeleteCourseId(''); }}
                className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-2xl text-muted hover:bg-bg-secondary transition-colors duration-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-semibold rounded-2xl transition-all shadow-sm focus-ring flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
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

      {/* Upgrade Pro Plan modal dialog */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card border border-border-theme p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-5 text-primary transition-colors duration-300 animate-scale-up font-sans">
            
            <div className="flex items-center justify-between pb-3 border-b border-border-theme">
              <div className="flex items-center space-x-2">
                <Sparkle className="w-5 h-5 text-yellow-400 fill-yellow-400 animate-pulse" />
                <h3 className="text-sm font-black text-primary uppercase tracking-widest">
                  HyperBrain Pro upgrade
                </h3>
              </div>
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="text-muted hover:text-primary text-sm font-bold p-1 hover:bg-bg-secondary rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-bg-secondary rounded-2xl border border-border-theme flex items-center justify-between transition-colors duration-300">
                <div>
                  <h4 className="text-sm font-bold text-primary">Annual Pro subscription</h4>
                  <p className="text-[10px] text-muted">Billed annually. Cancel anytime.</p>
                </div>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">$79.99/yr</span>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-bold text-primary text-[10px] uppercase tracking-wider text-muted mb-1">Included pro features:</p>
                <div className="flex items-center space-x-2 bg-bg-secondary p-2.5 rounded-2xl border border-border-theme transition-colors duration-300">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-[11px] font-semibold text-muted">Unlimited Syllabus maps uploads</span>
                </div>
                <div className="flex items-center space-x-2 bg-bg-secondary p-2.5 rounded-2xl border border-border-theme transition-colors duration-300">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-[11px] font-semibold text-muted">Unlimited AI Custom exam generations</span>
                </div>
                <div className="flex items-center space-x-2 bg-bg-secondary p-2.5 rounded-2xl border border-border-theme transition-colors duration-300">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-[11px] font-semibold text-muted">Unrestricted AI Syllabus chat access</span>
                </div>
                <div className="flex items-center space-x-2 bg-bg-secondary p-2.5 rounded-2xl border border-border-theme transition-colors duration-300">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-[11px] font-semibold text-muted">Sync modules to Google Drive fallbacks</span>
                </div>
              </div>

              <div className="flex space-x-3 pt-3 border-t border-border-theme">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 py-2.5 border border-border-theme text-xs font-semibold rounded-2xl text-muted hover:bg-bg-secondary transition-all text-center duration-300"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleUpgradeToPro}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl active:scale-[0.98] transition-all shadow-md flex items-center justify-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  <span>Subscribe Now</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-card border border-border-theme text-primary text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 animate-fade-in transition-colors duration-300">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
