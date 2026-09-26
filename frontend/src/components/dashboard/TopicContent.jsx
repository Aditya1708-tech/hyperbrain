import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import aiService from "@/services/aiService";
import { analyticsService } from '../../services/firebase/firestoreService';
import { 
  BookOpen, CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  Loader2, Sparkles, Eye, EyeOff, FileText, LayoutList 
} from 'lucide-react';
import { userService } from '../../services/firebase/userService';

// -------------------------------------------------------------
// NATIVE STRUCUTRED RESPONSE SCHEMAS
// -------------------------------------------------------------

const NOTES_SCHEMA = {
  type: "OBJECT",
  properties: {
    overview: { type: "STRING" },
    definition: { type: "STRING" },
    detailedExplanation: { type: "STRING" },
    coreConcepts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          content: { type: "STRING" }
        },
        required: ["title", "content"]
      }
    },
    keyTerminology: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          term: { type: "STRING" },
          definition: { type: "STRING" }
        },
        required: ["term", "definition"]
      }
    },
    formulae: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          expression: { type: "STRING" },
          explanation: { type: "STRING" }
        },
        required: ["expression", "explanation"]
      }
    },
    examples: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          scenario: { type: "STRING" },
          solution: { type: "STRING" }
        },
        required: ["scenario", "solution"]
      }
    },
    examTips: {
      type: "ARRAY",
      items: { type: "STRING" }
    }
  },
  required: ["overview", "definition", "detailedExplanation", "coreConcepts", "keyTerminology", "formulae", "examples", "examTips"]
};

const QUIZ_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          question: { type: "STRING" },
          options: {
            type: "ARRAY",
            items: { type: "STRING" }
          },
          correctAnswer: { type: "INTEGER" },
          explanation: { type: "STRING" },
          difficulty: { type: "STRING" }
        },
        required: ["id", "question", "options", "correctAnswer", "explanation", "difficulty"]
      }
    }
  },
  required: ["questions"]
};

const FLASHCARDS_SCHEMA = {
  type: "OBJECT",
  properties: {
    cards: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          front: { type: "STRING" },
          back: { type: "STRING" },
          tags: {
            type: "ARRAY",
            items: { type: "STRING" }
          }
        },
        required: ["front", "back", "tags"]
      }
    }
  },
  required: ["cards"]
};

const EXAM_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          modelAnswer: { type: "STRING" },
          marks: { type: "INTEGER" },
          difficulty: { type: "STRING" }
        },
        required: ["question", "modelAnswer", "marks", "difficulty"]
      }
    }
  },
  required: ["questions"]
};

// -------------------------------------------------------------
// FIRESTORE REFERENCE HELPER (RESOLVES WORKSPACE OR LEGACY SUBJECTS)
// -------------------------------------------------------------

async function getWorkspaceRef(uid, subjectId) {
  const wsRef = doc(db, 'users', uid, 'workspaces', subjectId);
  const wsSnap = await getDoc(wsRef);
  if (wsSnap.exists()) {
    return { ref: wsRef, snap: wsSnap, collectionName: 'workspaces' };
  }
  const subRef = doc(db, 'users', uid, 'subjects', subjectId);
  const subSnap = await getDoc(subRef);
  if (subSnap.exists()) {
    return { ref: subRef, snap: subSnap, collectionName: 'subjects' };
  }
  return { ref: wsRef, snap: wsSnap, collectionName: 'workspaces' };
}

export default function TopicContent({ subjectId, subjectName, topicName }) {
  const [activeTab, setActiveTab] = useState('notes');
  const safeTopicKey = topicName.replace(/\./g, '_');

  // Loading States
  const [notesLoading, setNotesLoading] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [examLoading, setExamLoading] = useState(false);

  // Data States
  const [notesData, setNotesData] = useState(null);
  const [quizData, setQuizData] = useState([]);
  const [flashcardsData, setFlashcardsData] = useState([]);
  const [examData, setExamData] = useState([]);

  // Error States
  const [notesError, setNotesError] = useState('');
  const [quizError, setQuizError] = useState('');
  const [flashcardsError, setFlashcardsError] = useState('');
  const [examError, setExamError] = useState('');

  // Diagnostic Logs per Tab
  const [diagnostics, setDiagnostics] = useState({});
  const updateDiagnostics = (tab, payload) => {
    setDiagnostics(prev => ({ ...prev, [tab]: payload }));
  };

  // Interactive UI states
  const [justGenerated, setJustGenerated] = useState({});
  const [answers, setAnswers] = useState({});
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [isTopicCompleted, setIsTopicCompleted] = useState(false);
  const [isLimitReached, setIsLimitReached] = useState(false);

  const toggleRevealAnswer = (idx) => setRevealedAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));

  // Helper to sync completion status
  useEffect(() => {
    const fetchCompletionStatus = async () => {
      const user = auth.currentUser;
      if (!user || !subjectId) return;
      try {
        const { snap } = await getWorkspaceRef(user.uid, subjectId);
        if (snap.exists()) {
          const ws = snap.data();
          setIsTopicCompleted(ws.completedTopics?.includes(topicName) || false);
        }
      } catch (err) {
        console.warn("Could not sync completion status:", err);
      }
    };
    fetchCompletionStatus();
  }, [subjectId, topicName]);

  const toggleComplete = async () => {
    const user = auth.currentUser;
    if (!user || !subjectId) return;
    
    const nextState = !isTopicCompleted;
    setIsTopicCompleted(nextState);

    try {
      const { ref: subjectRef, snap } = await getWorkspaceRef(user.uid, subjectId);
      if (snap.exists()) {
        const ws = snap.data();
        let completedList = ws.completedTopics || [];
        if (nextState) {
          completedList = [...completedList, topicName];
        } else {
          completedList = completedList.filter(t => t !== topicName);
        }
        
        const totalCount = ws.topics?.length || 1;
        const progressPercent = Math.round((completedList.length / totalCount) * 100);

        await updateDoc(subjectRef, {
          completedTopics: completedList,
          progress: progressPercent
        });

        window.dispatchEvent(new Event('hb_workspace_updated'));
      }
    } catch (err) {
      console.error("Failed to toggle complete inside TopicContent:", err);
    }
  };

  // -------------------------------------------------------------
  // REUSABLE PRODUCTION-GRADE STRUCTURED GENERATOR (JSON Mode)
  // -------------------------------------------------------------
  const generateStructuredAI = async (prompt, taskName, tabName, validatorFn, responseSchema) => {
    const startTime = Date.now();
    let rawText = '';
    let parsedData = null;
    let attempts = 0;
    const maxAttempts = 2; // Primary + 1 Retry

    const diagnosticsPayload = {
      prompt,
      promptLength: prompt.length,
      estimatedTokens: Math.ceil(prompt.length / 4),
      modelUsed: 'gemini-2.5-flash',
      generationTime: 0,
      validationResult: 'Pending'
    };

    const repairJSONString = (text) => {
      if (!text) return "";
      let cleaned = text.trim();
      cleaned = cleaned.replace(/```json|```/g, "").trim();
      cleaned = cleaned.replace(/[\u0000-\u001F]+/g, " ");
      cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
      
      const openBraces = (cleaned.match(/{/g) || []).length;
      const closeBraces = (cleaned.match(/}/g) || []).length;
      if (openBraces > closeBraces) cleaned += '}'.repeat(openBraces - closeBraces);

      const openBrackets = (cleaned.match(/\[/g) || []).length;
      const closeBrackets = (cleaned.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) cleaned += ']'.repeat(openBrackets - closeBrackets);

      return cleaned;
    };

    while (attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`[AI Generation Pipeline] Attempt ${attempts}/${maxAttempts} for ${taskName}...`);
        
        rawText = await aiService.generateNotes(topicName, subjectName, prompt, { 
          responseMimeType: "application/json",
          responseSchema: responseSchema
        });

        diagnosticsPayload.rawAIResponse = rawText;
        
        // Pass JSON through the repair step before validation (Requirement 8/9)
        const repaired = repairJSONString(rawText);
        diagnosticsPayload.cleanedResponse = repaired;

        parsedData = JSON.parse(repaired);
        console.log("[AI Generation Pipeline] JSON parsed successfully. Validating schema...");

        const validation = validatorFn(parsedData);
        if (validation.valid) {
          console.log("[AI Generation Pipeline] Validation success!");
          diagnosticsPayload.validationResult = 'Success';
          diagnosticsPayload.parseResult = 'JSON Mode Success';
          diagnosticsPayload.generationTime = Date.now() - startTime;
          updateDiagnostics(tabName, diagnosticsPayload);
          
          analyticsService.logAiSession(subjectName, topicName, taskName, diagnosticsPayload.generationTime, diagnosticsPayload.estimatedTokens, true);
          return parsedData;
        } else {
          console.warn(`[AI Generation Pipeline] Validation failed on attempt ${attempts}:`, validation.reason);
          if (attempts >= maxAttempts) {
            let errorText = "generation failed because the AI returned an incomplete response.";
            if (tabName === 'exam') errorText = "Practice Exam " + errorText;
            else if (tabName === 'notes') errorText = "Notes " + errorText;
            else if (tabName === 'quiz') errorText = "Quiz " + errorText;
            else if (tabName === 'flashcards') errorText = "Flashcards " + errorText;
            throw new Error(errorText);
          }
        }
      } catch (err) {
        console.error(`[AI Generation Pipeline] Failure on attempt ${attempts}:`, err.message);
        if (attempts >= maxAttempts) {
          diagnosticsPayload.validationResult = 'Failed';
          diagnosticsPayload.parseResult = err.message;
          diagnosticsPayload.generationTime = Date.now() - startTime;
          updateDiagnostics(tabName, diagnosticsPayload);
          
          let errorText = "generation failed because the AI returned an incomplete response.";
          if (tabName === 'exam') errorText = "Practice Exam " + errorText;
          else if (tabName === 'notes') errorText = "Notes " + errorText;
          else if (tabName === 'quiz') errorText = "Quiz " + errorText;
          else if (tabName === 'flashcards') errorText = "Flashcards " + errorText;
          throw new Error(errorText);
        }
      }
    }
  };

  // -------------------------------------------------------------
  // VALIDATORS & NORMALIZATION (Requirement 4/5/6)
  // -------------------------------------------------------------
  const normalizeExamData = (data) => {
    if (!data) return { questions: [] };
    const rawList = Array.isArray(data) ? data : (data.questions || data.exam_questions || []);
    const normalizedList = rawList.map(q => {
      const normalizedQ = { ...q };
      if (!normalizedQ.question && normalizedQ.q) normalizedQ.question = normalizedQ.q;
      if (!normalizedQ.modelAnswer && normalizedQ.answer) normalizedQ.modelAnswer = normalizedQ.answer;
      
      // Default fills (Requirement 4)
      if (normalizedQ.marks === undefined || normalizedQ.marks === null) {
        normalizedQ.marks = normalizedQ.points !== undefined ? normalizedQ.points : 10;
      }
      if (!normalizedQ.difficulty) {
        normalizedQ.difficulty = "Medium";
      }
      if (!normalizedQ.modelAnswer) {
        normalizedQ.modelAnswer = "Answer unavailable.";
      }
      return normalizedQ;
    });

    if (Array.isArray(data)) {
      return normalizedList;
    } else {
      return { ...data, questions: normalizedList };
    }
  };

  const examValidator = (data) => {
    const normalized = normalizeExamData(data);
    const list = Array.isArray(normalized) ? normalized : (normalized.questions || []);

    if (list.length === 0) {
      console.error("[Practice Exam Validation Failure] Expected Schema: { questions: [...] } | Actual AI JSON:", JSON.stringify(data, null, 2));
      return { valid: false, reason: "Practice subjective questions list is empty." };
    }

    const missingFields = [];
    const isValid = list.every((q, idx) => {
      const hasQ = typeof q.question === 'string' && q.question.trim().length > 0;
      if (!hasQ) {
        missingFields.push(`Question index ${idx} is missing property 'question'`);
      }
      return hasQ;
    });

    if (!isValid) {
      // Log before validation fails (Requirement 6)
      console.error("[Practice Exam Validation Failure Details]");
      console.error("Expected Schema: questions: [{ question: string, modelAnswer: string, marks: number, difficulty: string }]");
      console.error("Actual AI JSON:", JSON.stringify(data, null, 2));
      console.error("Missing Fields:", missingFields.join('; '));
      return { valid: false, reason: `One or more subjective questions are missing core queries: ${missingFields.join('; ')}` };
    }

    return { valid: true };
  };

  const notesValidator = (data) => {
    if (!data.overview) data.overview = "Overview details unavailable.";
    if (!data.definition) data.definition = "Definitions detail unavailable.";
    if (!data.detailedExplanation) data.detailedExplanation = "Detailed outlines unavailable.";
    if (!Array.isArray(data.coreConcepts)) data.coreConcepts = [];
    if (!Array.isArray(data.keyTerminology)) data.keyTerminology = [];
    if (!Array.isArray(data.formulae)) data.formulae = [];
    if (!Array.isArray(data.examples)) data.examples = [];
    if (!Array.isArray(data.examTips)) data.examTips = [];

    const hasOverview = typeof data.overview === 'string' && data.overview.trim().length > 20;
    
    if (!hasOverview) {
      console.error("[Notes Validation Failure] Expected Schema: overview, definition, detailedExplanation | Actual AI JSON:", JSON.stringify(data, null, 2));
      return { valid: false, reason: "Notes are missing primary overview text." };
    }
    return { valid: true };
  };

  const quizValidator = (data) => {
    const list = Array.isArray(data) ? data : (data.questions || []);
    if (list.length === 0) {
      console.error("[Quiz Validation Failure] Expected Schema: { questions: [...] } | Actual AI JSON:", JSON.stringify(data, null, 2));
      return { valid: false, reason: "MCQ questions list is empty." };
    }

    const missingFields = [];
    const isValid = list.every((q, idx) => {
      if (q.marks === undefined) q.marks = 1;
      if (!q.difficulty) q.difficulty = "Medium";
      if (!q.explanation) q.explanation = "Explanation unavailable.";
      if (q.correctAnswer === undefined && q.answer !== undefined) q.correctAnswer = q.answer;

      const hasQ = typeof q.question === 'string' && q.question.trim().length > 0;
      const hasOptions = Array.isArray(q.options) && q.options.length >= 4;

      if (!hasQ) missingFields.push(`Question index ${idx} is missing property 'question'`);
      if (!hasOptions) missingFields.push(`Question index ${idx} is missing 4 options`);

      return hasQ && hasOptions;
    });

    if (!isValid) {
      console.error("[Quiz Validation Failure Details]");
      console.error("Expected Schema: questions: [{ question: string, options: Array(4), correctAnswer: number, explanation: string, difficulty: string, marks: number }]");
      console.error("Actual AI JSON:", JSON.stringify(data, null, 2));
      console.error("Missing Fields:", missingFields.join('; '));
      return { valid: false, reason: `Quiz questions are missing options or text properties: ${missingFields.join('; ')}` };
    }
    return { valid: true };
  };

  const flashcardsValidator = (data) => {
    const list = Array.isArray(data) ? data : (data.cards || data.flashcards || []);
    if (list.length === 0) {
      console.error("[Flashcards Validation Failure] Expected Schema: { cards: [...] } | Actual AI JSON:", JSON.stringify(data, null, 2));
      return { valid: false, reason: "Flashcard list is empty." };
    }

    const missingFields = [];
    const isValid = list.every((c, idx) => {
      if (!c.tags) c.tags = ["vocabulary"];
      const hasFront = typeof c.front === 'string' && c.front.trim().length > 0;
      const hasBack = typeof c.back === 'string' && c.back.trim().length > 0;

      if (!hasFront) missingFields.push(`Card index ${idx} is missing 'front'`);
      if (!hasBack) missingFields.push(`Card index ${idx} is missing 'back'`);

      return hasFront && hasBack;
    });

    if (!isValid) {
      console.error("[Flashcards Validation Failure Details]");
      console.error("Expected Schema: cards: [{ front: string, back: string, tags: Array }]");
      console.error("Actual AI JSON:", JSON.stringify(data, null, 2));
      console.error("Missing Fields:", missingFields.join('; '));
      return { valid: false, reason: `Flashcards are missing text properties: ${missingFields.join('; ')}` };
    }
    return { valid: true };
  };

  // -------------------------------------------------------------
  // LAZY LOAD NOTES
  // -------------------------------------------------------------
  const loadNotes = useCallback(async (forceRegenerate = false) => {
    const user = auth.currentUser;
    if (!user) return;

    setNotesError('');
    setNotesLoading(true);
    setJustGenerated(prev => ({ ...prev, notes: false }));

    const notesDocRef = doc(db, 'users', user.uid, 'workspaces', subjectId, 'notes', safeTopicKey);

    try {
      if (!forceRegenerate) {
        const snap = await getDoc(notesDocRef);
        if (snap.exists()) {
          setNotesData(snap.data());
          setNotesLoading(false);
          return;
        }
      }

      const limitCheck = await userService.checkLimit(user.uid, 'notes');
      if (!limitCheck.allowed) {
        setIsLimitReached(true);
        setNotesLoading(false);
        return;
      }
      setIsLimitReached(false);

      const prompt = `You are a textbook author generating extremely comprehensive, in-depth academic study notes for the topic "${topicName}" inside the course "${subjectName}".
      Write highly detailed, exhaustive explanations grounded in the standard textbook curriculum for this subject. Do not summarize; deliver deep, textbook-level descriptions for each section.
      Return ONLY valid JSON. Do not wrap in markdown. Do not use \`\`\`json. Do not add explanations. Do not add comments. Do not use trailing commas. Escape every quote inside strings. Every property name must be double quoted. Every array must end correctly. Every object must close correctly.`;

      const generated = await generateStructuredAI(prompt, 'notes_generation', 'notes', notesValidator, NOTES_SCHEMA);

      const formatted = {
        topic: topicName,
        overview: generated.overview || "No overview details.",
        definition: generated.definition || "No definition details.",
        detailedExplanation: generated.detailedExplanation || "No explanation details.",
        coreConcepts: generated.coreConcepts || [],
        keyTerminology: generated.keyTerminology || [],
        formulae: generated.formulae || [],
        examples: generated.examples || [],
        examTips: generated.examTips || [],
        updatedAt: new Date().toISOString()
      };

      await setDoc(notesDocRef, formatted);
      await userService.incrementUsage(user.uid, 'notes');

      console.log("[Structured AI Log] Saved Firestore object (Notes):", formatted);

      setNotesData(formatted);
      setJustGenerated(prev => ({ ...prev, notes: true }));
    } catch (err) {
      setNotesError(err.message || "AI notes compile failed.");
    } finally {
      setNotesLoading(false);
    }
  }, [subjectId, subjectName, topicName, safeTopicKey]);

  // -------------------------------------------------------------
  // LAZY LOAD PRACTICE QUIZ
  // -------------------------------------------------------------
  const loadQuiz = useCallback(async (forceRegenerate = false) => {
    const user = auth.currentUser;
    if (!user) return;

    setQuizError('');
    setQuizLoading(true);
    setJustGenerated(prev => ({ ...prev, quiz: false }));

    const quizDocRef = doc(db, 'users', user.uid, 'workspaces', subjectId, 'quizzes', safeTopicKey);

    try {
      if (!forceRegenerate) {
        const snap = await getDoc(quizDocRef);
        if (snap.exists()) {
          setQuizData(snap.data().questions || []);
          setQuizLoading(false);
          return;
        }
      }

      const prompt = `Generate exactly 5 distinct practice MCQ questions for the topic "${topicName}" in subject "${subjectName}".
      Return ONLY valid JSON. Do not wrap in markdown. Do not use \`\`\`json. Do not add explanations. Do not add comments. Do not use trailing commas. Escape every quote inside strings. Every property name must be double quoted. Every array must end correctly. Every object must close correctly.`;

      const generated = await generateStructuredAI(prompt, 'quiz_generation', 'quiz', quizValidator, QUIZ_SCHEMA);
      const rawList = generated.questions || [];

      const formattedQuestions = rawList.map((q, idx) => {
        let corrIdx = 0;
        const options = q.options || [];
        const correctVal = q.correctAnswer !== undefined ? q.correctAnswer : (q.answer !== undefined ? q.answer : 0);
        
        if (typeof correctVal === 'number') {
          corrIdx = correctVal;
        } else if (typeof correctVal === 'string') {
          const charCode = correctVal.toLowerCase().trim().charCodeAt(0);
          if (charCode >= 97 && charCode <= 100) {
            corrIdx = charCode - 97;
          } else if (correctVal >= '1' && correctVal <= '4') {
            corrIdx = parseInt(correctVal) - 1;
          } else {
            const clean = (s) => s.replace(/^[a-d1-4][).]\s*/i, '').trim().toLowerCase();
            const matchIdx = options.findIndex(opt => clean(opt.toString()) === clean(correctVal));
            if (matchIdx !== -1) corrIdx = matchIdx;
          }
        }

        return {
          id: `q${idx + 1}`,
          question: q.question,
          options: options,
          answer: options[corrIdx] || corrIdx.toString(),
          explanation: q.explanation || `Correct Choice: Option ${corrIdx + 1}`
        };
      });

      const formatted = {
        topic: topicName,
        questions: formattedQuestions,
        updatedAt: new Date().toISOString()
      };

      await setDoc(quizDocRef, formatted);
      console.log("[Structured AI Log] Saved Firestore object (Quiz):", formatted);

      setQuizData(formatted.questions);
      setJustGenerated(prev => ({ ...prev, quiz: true }));
    } catch (err) {
      setQuizError(err.message || "AI quiz compilation failed.");
    } finally {
      setQuizLoading(false);
    }
  }, [subjectId, subjectName, topicName, safeTopicKey]);

  // -------------------------------------------------------------
  // LAZY LOAD FLASHCARDS
  // -------------------------------------------------------------
  const loadFlashcards = useCallback(async (forceRegenerate = false) => {
    const user = auth.currentUser;
    if (!user) return;

    setFlashcardsError('');
    setFlashcardsLoading(true);
    setJustGenerated(prev => ({ ...prev, flashcards: false }));

    const cardsDocRef = doc(db, 'users', user.uid, 'workspaces', subjectId, 'flashcards', safeTopicKey);

    try {
      if (!forceRegenerate) {
        const snap = await getDoc(cardsDocRef);
        if (snap.exists()) {
          setFlashcardsData(snap.data().cards || []);
          setFlashcardsLoading(false);
          return;
        }
      }

      const prompt = `Generate exactly 5 study review flashcards to memorize terminology for the topic "${topicName}" in subject "${subjectName}".
      Return ONLY valid JSON. Do not wrap in markdown. Do not use \`\`\`json. Do not add explanations. Do not add comments. Do not use trailing commas. Escape every quote inside strings. Every property name must be double quoted. Every array must end correctly. Every object must close correctly.`;

      const generated = await generateStructuredAI(prompt, 'flashcards_generation', 'flashcards', flashcardsValidator, FLASHCARDS_SCHEMA);
      const rawList = generated.cards || [];

      const formatted = {
        topic: topicName,
        cards: rawList.map((c, idx) => ({
          front: c.front || `Term ${idx + 1}`,
          back: c.back || "No detail explanation provided.",
          tags: Array.isArray(c.tags) ? c.tags : (c.tags ? [c.tags] : ["key-term"])
        })),
        updatedAt: new Date().toISOString()
      };

      await setDoc(cardsDocRef, formatted);
      console.log("[Structured AI Log] Saved Firestore object (Flashcards):", formatted);

      setFlashcardsData(formatted.cards);
      setJustGenerated(prev => ({ ...prev, flashcards: true }));
    } catch (err) {
      setFlashcardsError(err.message || "AI flashcards compilation failed.");
    } finally {
      setFlashcardsLoading(false);
    }
  }, [subjectId, subjectName, topicName, safeTopicKey]);

  // -------------------------------------------------------------
  // LAZY LOAD EXAMS
  // -------------------------------------------------------------
  const loadExam = useCallback(async (forceRegenerate = false) => {
    const user = auth.currentUser;
    if (!user) return;

    setExamError('');
    setExamLoading(true);
    setJustGenerated(prev => ({ ...prev, exam: false }));

    const examDocRef = doc(db, 'users', user.uid, 'workspaces', subjectId, 'exams', safeTopicKey);

    try {
      if (!forceRegenerate) {
        const snap = await getDoc(examDocRef);
        if (snap.exists()) {
          setExamData(snap.data().questions || []);
          setExamLoading(false);
          return;
        }
      }

      const prompt = `Generate exactly 3 theoretical practice subjective exam questions for the topic "${topicName}" in subject "${subjectName}".
      Return ONLY valid JSON. Do not wrap in markdown. Do not use \`\`\`json. Do not add explanations. Do not add comments. Do not use trailing commas. Escape every quote inside strings. Every property name must be double quoted. Every array must end correctly. Every object must close correctly.`;

      const generated = await generateStructuredAI(prompt, 'exam_generation', 'exam', examValidator, EXAM_SCHEMA);
      const rawList = generated.questions || [];

      const formatted = {
        topic: topicName,
        questions: rawList.map(q => ({
          question: q.question || "Theoretical Question outline",
          modelAnswer: q.modelAnswer || "Model Answer criteria details.",
          markingKey: `Estimated weight: ${q.marks || 5} marks. Assessment: Verify conceptual clarity.`,
          marks: q.marks !== undefined ? q.marks : 5,
          difficulty: q.difficulty || "medium"
        })),
        updatedAt: new Date().toISOString()
      };

      await setDoc(examDocRef, formatted);
      console.log("[Structured AI Log] Saved Firestore object (Exam):", formatted);

      setExamData(formatted.questions);
      setJustGenerated(prev => ({ ...prev, exam: true }));
    } catch (err) {
      setExamError(err.message || "AI practice exams compilation failed.");
    } finally {
      setExamLoading(false);
    }
  }, [subjectId, subjectName, topicName, safeTopicKey]);

  // Observer
  useEffect(() => {
    if (activeTab === 'notes') {
      loadNotes(false);
    } else if (activeTab === 'quiz') {
      loadQuiz(false);
    } else if (activeTab === 'flashcards') {
      loadFlashcards(false);
    } else if (activeTab === 'exam') {
      loadExam(false);
    }
  }, [activeTab, loadNotes, loadQuiz, loadFlashcards, loadExam]);

  // Handle quiz options selection
  const handleQuizAnswer = (questionIndex, option) => {
    if (answers[questionIndex] !== undefined) return;
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: option
    }));
  };

  // -------------------------------------------------------------
  // RENDERING
  // -------------------------------------------------------------

  const renderDiagnostics = (tabName) => {
    return null; // Disabled as per user request
  };

  const renderLoader = (message) => (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-6">
      <div className="relative flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <Sparkles className="w-5 h-5 text-indigo-500 absolute animate-pulse" />
      </div>
      <div>
        <h4 className="text-sm font-black text-primary uppercase tracking-widest animate-pulse">{message}</h4>
        <p className="text-[10px] text-muted font-semibold mt-1">Generating high-fidelity academic outlines dynamically...</p>
      </div>
    </div>
  );

  const renderError = (errorMsg, retryFn) => (
    <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-xl mx-auto bg-card border border-border-theme rounded-2xl shadow-xs">
      <AlertCircle className="w-10 h-10 text-red-500 animate-pulse" />
      <div>
        <h4 className="text-sm font-black text-primary uppercase tracking-wider">Pipeline Loading Error</h4>
        <p className="text-xs text-slate-500 mt-2 font-medium">We couldn't generate this content right now. Please retry.</p>
      </div>
      <button
        onClick={retryFn}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-[0.98] flex items-center space-x-1.5"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Retry Generation</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col bg-bg-secondary transition-colors duration-300">
      
      {/* Navbar Tabs */}
      <div className="px-6 py-3 bg-card border-b border-border-theme flex items-center justify-between flex-shrink-0 transition-colors duration-300">
        <div className="flex space-x-1">
          {['notes', 'quiz', 'flashcards'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setJustGenerated({});
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all focus-ring ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:bg-hover-theme hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {isTopicCompleted ? (
            <button 
              onClick={toggleComplete} 
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-xl text-xs font-bold text-green-600 dark:text-green-400"
            >
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Completed</span>
            </button>
          ) : (
            <button 
              onClick={toggleComplete} 
              className="flex items-center space-x-1.5 px-3 py-1.5 border border-border-theme hover:bg-hover-theme rounded-xl text-xs font-bold text-slate-500"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              <span>Mark Complete</span>
            </button>
          )}
          
          <button
            onClick={() => {
              if (activeTab === 'notes') loadNotes(true);
              if (activeTab === 'quiz') loadQuiz(true);
              if (activeTab === 'flashcards') loadFlashcards(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 border border-border-theme hover:bg-hover-theme text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Regenerate this specific module with AI"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh with AI</span>
          </button>
        </div>
      </div>

      {/* Panels Window */}
      <div className="bg-bg-secondary p-6 md:p-8 space-y-6">
        
        {/* Notes Panel */}
        {activeTab === 'notes' && (
          <>
            {justGenerated.notes && (
              <div className="bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/40 p-4 rounded-xl flex items-center space-x-3 text-xs text-green-600 dark:text-green-400 font-bold max-w-4xl mx-auto">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <span>✓ Notes saved</span>
                  <p className="text-[10px] text-muted mt-0.5 font-normal">Stored permanently in Firestore for this workspace.</p>
                </div>
              </div>
            )}

            {notesLoading && renderLoader("Generating AI Notes...")}
            {notesError && renderError(notesError, () => loadNotes(true))}

            {!notesLoading && !notesError && notesData && (
              <div className="flex flex-col lg:flex-row space-y-6 lg:space-y-0 lg:space-x-8 items-start max-w-6xl mx-auto">
                
                <div className="w-full lg:w-60 flex-shrink-0 sticky top-[90px] self-start space-y-2 z-10 bg-bg-secondary p-1">
                  <div className="bg-card border border-border-theme p-4 rounded-2xl shadow-sm space-y-1">
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Sections Menu</h4>
                    {['overview', 'definition', 'coreConcepts', 'detailedExplanation', 'keyTerminology', 'formulae', 'examples', 'examTips'].map(s => {
                      const hasData = notesData[s] && (!Array.isArray(notesData[s]) || notesData[s].length > 0);
                      return (
                        <a 
                          href={`#sec-${s}`}
                          key={s} 
                          className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold hover:bg-hover-theme transition-all ${
                            hasData ? 'text-primary font-bold' : 'text-slate-400 dark:text-slate-650 opacity-50'
                          }`}
                        >
                          <span className="capitalize">{s.replace(/([A-Z])/g, ' $1')}</span>
                          <span>{hasData ? '🟢' : '⏳'}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 space-y-6 w-full">
                  
                  <div id="sec-overview" className="bg-card border border-border-theme rounded-2xl shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-border-theme bg-card font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2 text-xs uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span>Overview</span>
                    </div>
                    <div className="p-6 text-xs text-slate-650 dark:text-slate-350 leading-relaxed select-text">
                      {notesData.overview}
                    </div>
                  </div>

                  <div id="sec-definition" className="bg-card border border-border-theme rounded-2xl shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-border-theme bg-card font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2 text-xs uppercase tracking-wider">
                      <BookOpen className="w-4 h-4 text-indigo-500" />
                      <span>Formal Academic Definition</span>
                    </div>
                    <div className="p-6 text-xs text-slate-650 dark:text-slate-350 leading-relaxed select-text">
                      {notesData.definition}
                    </div>
                  </div>

                  {notesData.coreConcepts.length > 0 && (
                    <div id="sec-coreConcepts" className="bg-card border border-border-theme rounded-2xl shadow-xs overflow-hidden">
                      <div className="p-5 border-b border-border-theme bg-card font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2 text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-yellow-500" />
                        <span>Core Concepts</span>
                      </div>
                      <div className="p-6 space-y-5 select-text">
                        {notesData.coreConcepts.map((concept, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <h5 className="font-bold text-xs text-primary">{concept.title}</h5>
                            <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed">{concept.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div id="sec-detailedExplanation" className="bg-card border border-border-theme rounded-2xl shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-border-theme bg-card font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2 text-xs uppercase tracking-wider">
                      <LayoutList className="w-4 h-4 text-purple-500" />
                      <span>Detailed Explanation</span>
                    </div>
                    <div className="p-6 text-xs text-slate-650 dark:text-slate-350 leading-[1.8] whitespace-pre-line select-text">
                      {notesData.detailedExplanation}
                    </div>
                  </div>

                  {notesData.keyTerminology.length > 0 && (
                    <div id="sec-keyTerminology" className="bg-card border border-border-theme rounded-2xl shadow-xs overflow-hidden">
                      <div className="p-5 border-b border-border-theme bg-card font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
                        Key Terminology
                      </div>
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 select-text">
                        {notesData.keyTerminology.map((t, idx) => (
                          <div key={idx} className="p-4 bg-bg-secondary/40 border border-border-theme rounded-xl text-xs space-y-1">
                            <span className="font-bold text-primary">{t.term}</span>
                            <p className="text-slate-500 text-[11px] leading-relaxed">{t.definition}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {notesData.formulae.length > 0 && (
                    <div id="sec-formulae" className="bg-card border border-border-theme rounded-2xl shadow-xs overflow-hidden">
                      <div className="p-5 border-b border-border-theme bg-card font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
                        Equations & Mathematical Formulas
                      </div>
                      <div className="p-6 space-y-4 font-mono select-text">
                        {notesData.formulae.map((f, idx) => (
                          <div key={idx} className="bg-blue-500/5 border-l-4 border-blue-500 p-4 rounded-r-xl space-y-1">
                            <span className="text-blue-700 dark:text-blue-400 font-bold block text-xs">{f.expression}</span>
                            <p className="text-muted text-[10px] leading-relaxed font-sans">{f.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {notesData.examples.length > 0 && (
                    <div id="sec-examples" className="bg-card border border-border-theme rounded-2xl shadow-xs overflow-hidden">
                      <div className="p-5 border-b border-border-theme bg-card font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
                        Solved Examples
                      </div>
                      <div className="p-6 space-y-4 select-text">
                        {notesData.examples.map((e, idx) => (
                          <div key={idx} className="p-5 border border-emerald-500/10 bg-emerald-500/5 rounded-2xl text-xs space-y-2">
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Example {idx + 1}</span>
                            <p className="font-bold text-primary">{e.scenario}</p>
                            <div className="pt-2 border-t border-emerald-500/10 text-slate-650 dark:text-slate-350 leading-relaxed whitespace-pre-line">
                              {e.solution}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {notesData.examTips.length > 0 && (
                    <div id="sec-examTips" className="bg-card border border-red-500/10 rounded-2xl shadow-xs overflow-hidden">
                      <div className="p-5 border-b border-red-500/10 bg-card font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span>Exam Focus Tips</span>
                      </div>
                      <div className="p-6 select-text">
                        <ul className="list-disc pl-5 space-y-2 text-xs text-slate-650 dark:text-slate-350">
                          {notesData.examTips.map((tip, idx) => (
                            <li key={idx} className="leading-relaxed">{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
            {renderDiagnostics('notes')}
          </>
        )}

        {/* Practice Quiz Panel */}
        {activeTab === 'quiz' && (
          <>
            {justGenerated.quiz && (
              <div className="bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/40 p-4 rounded-xl flex items-center space-x-3 text-xs text-green-600 dark:text-green-400 font-bold max-w-3xl mx-auto mb-6">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <span>✓ Quiz questions saved</span>
                  <p className="text-[10px] text-muted mt-0.5 font-normal">MCQ structure validated and generated successfully.</p>
                </div>
              </div>
            )}

            {quizLoading && renderLoader("Preparing Practice Quiz MCQs...")}
            {quizError && renderError(quizError, () => loadQuiz(true))}

            {!quizLoading && !quizError && quizData.length > 0 && (
              <div className="space-y-6 max-w-3xl mx-auto select-text">
                {quizData.map((q, idx) => {
                  const answer = answers[idx];
                  const isAnswered = answer !== undefined;
                  
                  return (
                    <div key={idx} className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-4">
                      <h4 className="text-sm font-bold text-primary leading-snug">Q{idx + 1}: {q.question}</h4>
                      
                      <div className="space-y-2.5">
                        {q.options?.map((opt, oIdx) => {
                          const optionText = opt.toString();
                          const isSelected = answer === optionText;
                          const isThisCorrect = optionText.trim().toLowerCase() === q.answer.trim().toLowerCase();
                          
                          let optStyle = "border-border-theme hover:bg-hover-theme bg-bg-secondary text-primary transition-colors";
                          let Icon = null;

                          if (isAnswered) {
                            if (isThisCorrect) {
                              optStyle = "bg-green-500/10 border-green-500 text-green-600 dark:text-green-400 font-semibold";
                              Icon = CheckCircle2;
                            } else if (isSelected) {
                              optStyle = "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 font-semibold";
                              Icon = XCircle;
                            } else {
                              optStyle = "border-border-theme text-slate-400 dark:text-slate-655 opacity-60";
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              disabled={isAnswered}
                              onClick={() => handleQuizAnswer(idx, optionText)}
                              className={`w-full text-left p-4 rounded-2xl border flex items-center justify-between transition-all text-xs font-semibold ${optStyle}`}
                            >
                              <span>{optionText}</span>
                              {Icon && <Icon className="w-5 h-5 flex-shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>

                      {isAnswered && (
                        <div className="bg-blue-600/5 border border-blue-500/10 p-4 rounded-xl text-xs text-primary leading-relaxed font-light italic">
                          💡 {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {renderDiagnostics('quiz')}
          </>
        )}

        {/* Memory Flashcards Panel */}
        {activeTab === 'flashcards' && (
          <>
            {justGenerated.flashcards && (
              <div className="bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/40 p-4 rounded-xl flex items-center space-x-3 text-xs text-green-600 dark:text-green-400 font-bold max-w-4xl mx-auto mb-6">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <span>✓ Flashcards generated</span>
                  <p className="text-[10px] text-muted mt-0.5 font-normal">Active review set populated successfully.</p>
                </div>
              </div>
            )}

            {flashcardsLoading && renderLoader("Preparing Interactive Flashcards...")}
            {flashcardsError && renderError(flashcardsError, () => loadFlashcards(true))}

            {!flashcardsLoading && !flashcardsError && flashcardsData.length > 0 && (
              <div className="max-w-4xl mx-auto select-text">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {flashcardsData.map((f, idx) => {
                    const isRevealed = revealedAnswers[idx];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleRevealAnswer(idx)}
                        className={`bg-card p-6 rounded-3xl border cursor-pointer select-none transition-all duration-300 min-h-48 flex flex-col justify-between shadow-xs hover:shadow-md hover:scale-[1.01] ${
                          isRevealed ? 'border-blue-500/35 bg-blue-500/5' : 'border-border-theme'
                        }`}
                      >
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Card {idx + 1}</span>
                          <p className="text-xs font-black text-primary leading-relaxed">
                            {f.front}
                          </p>
                        </div>
                        <div className="border-t border-border-theme/40 pt-4 flex items-center justify-between">
                          {isRevealed ? (
                            <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed">{f.back}</p>
                          ) : (
                            <div className="flex items-center space-x-1.5 text-[10px] font-bold text-blue-600">
                              <Eye className="w-4 h-4" />
                              <span>Reveal Answer</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {renderDiagnostics('flashcards')}
          </>
        )}

        {/* Practice Exams Panel */}
        {activeTab === 'exam' && (
          <>
            {justGenerated.exam && (
              <div className="bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/40 p-4 rounded-xl flex items-center space-x-3 text-xs text-green-600 dark:text-green-400 font-bold max-w-4xl mx-auto mb-6">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <span>✓ Practice exam saved</span>
                  <p className="text-[10px] text-muted mt-0.5 font-normal">Evaluation points synced successfully.</p>
                </div>
              </div>
            )}

            {examLoading && renderLoader("Creating Subjective Practice Exams...")}
            {examError && renderError(examError, () => loadExam(true))}

            {!examLoading && !examError && examData.length > 0 && (
              <div className="max-w-4xl mx-auto space-y-6 select-text">
                {examData.map((e, idx) => {
                  const isRevealed = revealedAnswers[`exam_${idx}`];
                  return (
                    <div key={idx} className="bg-card border border-border-theme rounded-2xl shadow-xs overflow-hidden transition-all">
                      <div className="p-6 bg-card flex items-start space-x-4">
                        <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase block mb-1">Subjective Practice Question {idx + 1}</span>
                          <p className="text-xs font-bold text-primary leading-relaxed">{e.question}</p>
                        </div>
                      </div>
                      
                      <div className="px-6 pb-6 bg-bg-secondary/40 border-t border-border-theme/40 pt-4">
                        <button
                          onClick={() => toggleRevealAnswer(`exam_${idx}`)}
                          className="flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-500 mb-3 select-none"
                        >
                          {isRevealed ? (
                            <>
                              <EyeOff className="w-4 h-4" />
                              <span>Hide Evaluation Criteria</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              <span>Reveal Model Answer & Marking Key</span>
                            </>
                          )}
                        </button>

                        {isRevealed && (
                          <div className="space-y-4 animate-fade-in text-xs font-medium border-l-2 border-blue-500 pl-4 mt-2">
                            <div>
                              <span className="text-slate-400 font-bold block mb-1">Model Answer:</span>
                              <p className="text-slate-700 dark:text-slate-350 leading-relaxed">{e.modelAnswer}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block mb-1">Marking Scheme / assessment criteria:</span>
                              <p className="text-slate-500 leading-relaxed italic">{e.markingKey}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {renderDiagnostics('exam')}
          </>
        )}

      </div>
    </div>
  );
}
