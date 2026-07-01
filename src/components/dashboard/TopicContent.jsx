import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import aiService from "@/services/aiService";
import { analyticsService } from '../../services/firebase/firestoreService';
import { BookOpen, CheckCircle2, XCircle, AlertCircle, RefreshCw, Loader2, Sparkles, ShieldAlert } from 'lucide-react';
import { userService } from '../../services/firebase/userService';
import Card from '../common/Card';

export default function TopicContent({ subjectId, subjectName, topicName }) {
  const [activeTab, setActiveTab] = useState('notes');
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState(''); // 'analyzing' | 'notes' | 'concepts'
  const [justGenerated, setJustGenerated] = useState(false);
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [answers, setAnswers] = useState({});

  // Usage limit states
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [countdown, setCountdown] = useState('');

  // Countdown timer effect
  useEffect(() => {
    if (!isLimitReached) return;
    const interval = setInterval(() => {
      setCountdown(userService.getTimeUntilMidnight().formatted);
    }, 1000);
    setCountdown(userService.getTimeUntilMidnight().formatted);
    return () => clearInterval(interval);
  }, [isLimitReached]);

  // Background adjacent topic pre-generation
  const triggerBackgroundPregeneration = async (topicsList, currentTopicIndex) => {
    const user = auth.currentUser;
    if (!user || !subjectId) return;

    // Slice next 2 topics in sequence
    const nextTopics = topicsList.slice(currentTopicIndex + 1, currentTopicIndex + 3);
    for (const topic of nextTopics) {
      const localKey = `topic_${user.uid}_${subjectId}_${topic.title}`;
      if (topic.full_content || localStorage.getItem(localKey)) continue;

      try {
        console.log(`[Background AI] Pre-generating adjacent module: ${topic.title}`);
        const startTime = Date.now();
        const rawText = await aiService.generateNotes(topic.title, subjectName);
        let generated = rawText;
        if (typeof rawText === 'string') {
          const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
          generated = JSON.parse(cleanJson);
        }
        const latencyMs = Date.now() - startTime;

        analyticsService.logAiSession(subjectName, topic.title, 'background_pregen', latencyMs, 1200, true);

        // Save locally
        localStorage.setItem(localKey, JSON.stringify(generated));

        // Save to Firestore
        if (db) {
          const subjectRef = doc(db, 'users', user.uid, 'subjects', subjectId);
          const freshSnap = await getDoc(subjectRef);
          if (freshSnap.exists()) {
            const list = freshSnap.data().topics || [];
            const updated = list.map(t => 
              t.title === topic.title ? { ...t, full_content: generated } : t
            );
            await updateDoc(subjectRef, { topics: updated });
          }
        }
      } catch (err) {
        console.warn(`[Background AI] Failed pre-generating adjacent ${topic.title}:`, err);
        analyticsService.logAiSession(subjectName, topic.title, 'background_pregen', 0, 0, false, err.message);
      }
    }
  };

  const loadContent = useCallback(async (forceRegenerate = false) => {
    const user = auth.currentUser;
    if (!user) {
      setErrorMsg("User not authenticated");
      setLoading(false);
      return;
    }

    setJustGenerated(false);
    setLoading(true);
    setErrorMsg('');

    try {
      let cachedContent = null;
      let subjectDocSnap = null;
      let topicsList = [];

      // 1. Try Firestore Lookup
      if (!forceRegenerate && subjectId && db) {
        try {
          const subjectRef = doc(db, 'users', user.uid, 'subjects', subjectId);
          subjectDocSnap = await getDoc(subjectRef);
          if (subjectDocSnap.exists()) {
            topicsList = subjectDocSnap.data().topics || [];
            const topicItem = topicsList.find(t => t.title === topicName);
            if (topicItem && topicItem.full_content) {
              cachedContent = topicItem.full_content;
            }
          }
        } catch (dbErr) {
          console.warn("Firestore fetch failed, checking localStorage fallback:", dbErr);
        }
      }

      // 2. Try localStorage Fallback
      if (!forceRegenerate && !cachedContent) {
        const local = localStorage.getItem(`topic_${user.uid}_${subjectId}_${topicName}`);
        if (local) {
          cachedContent = JSON.parse(local);
        }
      }

      // If cached content exists, render immediately with quick loader to avoid flashes
      if (cachedContent) {
        setLoadingPhase('analyzing');
        await new Promise(resolve => setTimeout(resolve, 200));
        setData(cachedContent);
        setIsLimitReached(false);
        setLoading(false);
        setLoadingPhase('');

        // Trigger background pre-generation
        if (topicsList.length > 0) {
          const currentIdx = topicsList.findIndex(t => t.title === topicName);
          if (currentIdx !== -1) {
            triggerBackgroundPregeneration(topicsList, currentIdx);
          }
        }
        return;
      }

      // Check beta limit before AI query
      const check = await userService.checkLimit(user.uid, 'notes');
      if (!check.allowed) {
        setIsLimitReached(true);
        setLoading(false);
        return;
      }

      setIsLimitReached(false);

      // 3. Generate content using AI
      setLoadingPhase('analyzing');
      await new Promise(resolve => setTimeout(resolve, 600));
      
      setLoadingPhase('notes');
      const startTime = Date.now();
      const rawText = await aiService.generateNotes(topicName, subjectName);
      let generated = rawText;
      if (typeof rawText === 'string') {
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        generated = JSON.parse(cleanJson);
      }
      const latencyMs = Date.now() - startTime;

      analyticsService.logAiSession(subjectName, topicName, 'notes', latencyMs, 1400, true);
      
      // Increment notes count
      await userService.incrementUsage(user.uid, 'notes');

      setLoadingPhase('concepts');
      await new Promise(resolve => setTimeout(resolve, 600));

      setData(generated);
      setJustGenerated(true);

      // Save generated content to Firestore
      if (subjectId && db) {
        try {
          const subjectRef = doc(db, 'users', user.uid, 'subjects', subjectId);
          const snap = await getDoc(subjectRef);
          if (snap.exists()) {
            topicsList = snap.data().topics || [];
            const updatedTopics = topicsList.map(t => {
              if (t.title === topicName) {
                return { ...t, full_content: generated };
              }
              return t;
            });
            await updateDoc(subjectRef, { topics: updatedTopics });
          }
        } catch (updateErr) {
          console.warn("Could not save AI content to Firestore:", updateErr);
        }
      }

      // Save to localStorage fallback
      localStorage.setItem(`topic_${user.uid}_${subjectId}_${topicName}`, JSON.stringify(generated));
      
      setLoading(false);
      setLoadingPhase('');

      // Trigger background pre-generation
      if (topicsList.length > 0) {
        const currentIdx = topicsList.findIndex(t => t.title === topicName);
        if (currentIdx !== -1) {
          triggerBackgroundPregeneration(topicsList, currentIdx);
        }
      }
    } catch (err) {
      console.error(err);
      analyticsService.logAiSession(subjectName, topicName, 'notes', 0, 0, false, err.message);
      setErrorMsg("AI is temporarily busy. Please try again in a moment.");
      setLoading(false);
      setLoadingPhase('');
    }
  }, [subjectId, subjectName, topicName]);

  useEffect(() => {
    let isMounted = true;

    // Reset state asynchronously to prevent synchronous set-state in effect warnings
    Promise.resolve().then(() => {
      if (isMounted) {
        setLoading(true);
        setData(null);
        setErrorMsg('');
        setAnswers({});
        setActiveTab('notes');
      }
    });

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [loadContent]);

  const handleQuizAnswer = (questionIndex, option) => {
    if (answers[questionIndex] !== undefined) return;
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: option
    }));
  };

  const getLoadingMessage = () => {
    if (loadingPhase === 'analyzing') return "Analyzing topic...";
    if (loadingPhase === 'notes') return "Generating learning notes...";
    if (loadingPhase === 'concepts') return "Creating key concepts...";
    return "Analyzing syllabus...";
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 md:p-8 space-y-6">
        {/* Step-by-step progress status */}
        <div className="bg-card border border-border-theme rounded-xl p-4 shadow-sm flex items-center space-x-3 text-xs font-bold text-primary animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>{getLoadingMessage()}</span>
        </div>

        {/* Skeleton Card Content */}
        <div className="bg-card p-6 rounded-2xl border border-border-theme space-y-4 h-64 animate-pulse">
          <div className="h-4 bg-bg-secondary rounded-lg w-full" />
          <div className="h-4 bg-bg-secondary rounded-lg w-5/6" />
          <div className="h-4 bg-bg-secondary rounded-lg w-4/5" />
          <div className="h-4 bg-bg-secondary rounded-lg w-full" />
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-20 px-6 text-center bg-bg-secondary transition-colors duration-300">
        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
        <h4 className="text-base font-bold text-primary mb-2">Error Loading Content</h4>
        <p className="text-slate-500 text-xs mb-4 max-w-xs">{errorMsg}</p>
        <button
          onClick={() => loadContent(false)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-750 active:scale-95 transition-all shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (isLimitReached) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-20 px-6 text-center bg-bg-secondary transition-colors duration-300">
        <Card className="bg-card border border-red-500/20 p-6 text-center space-y-4 rounded-2xl max-w-sm mx-auto shadow-lg text-primary">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
          <h3 className="text-sm font-black uppercase tracking-widest text-red-500">You have reached today's beta limit.</h3>
          <p className="text-xs text-muted leading-relaxed font-semibold">
            To prevent resource exhaustion during the beta launch, daily limits are enforced. Your quota will reset in:
          </p>
          <div className="bg-bg-secondary p-3 rounded-xl border border-border-theme text-sm font-black text-primary font-mono tracking-wider">
            {countdown}
          </div>
          <button
            onClick={() => loadContent(true)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Force Reload Check</span>
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary transition-colors duration-300 overflow-hidden">
      
      {/* 1. MODULE SUB-HEADER NAVBAR */}
      <div className="px-6 py-3 bg-card border-b border-border-theme flex items-center justify-between flex-shrink-0 transition-colors duration-300">
        <div className="flex space-x-1">
          {['notes', 'quiz', 'exam'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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

        {/* Regenerate Control */}
        <button
          onClick={() => loadContent(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-border-theme hover:bg-hover-theme text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-xs font-bold transition-all shadow-xs"
          title="Regenerate notes with AI"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh with AI</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-bg-secondary transition-colors duration-300 p-6 md:p-8 space-y-6">
        
        {/* Success saved badge */}
        {justGenerated && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 p-4 rounded-xl flex items-center space-x-3 text-xs text-green-600 dark:text-green-400 font-bold transition-all animate-fade-in max-w-4xl mx-auto">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <span>✓ Notes saved</span>
              <p className="text-[10px] text-muted mt-0.5 font-normal">Available instantly next time</p>
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-card p-6 md:p-8 rounded-2xl border border-border-theme shadow-sm leading-relaxed text-sm prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 transition-colors duration-300">
              <h2 className="text-xl font-black text-primary mb-4">Summary</h2>
              <div className="text-sm text-muted leading-relaxed space-y-4">
                {data?.summary?.split('\n\n').map((para, idx) => (
                  <p key={idx}>{para}</p>
                )) || "No summary available."}
              </div>
            </div>

            {/* Flashcards */}
            {data?.flashcards && data.flashcards.length > 0 && (
              <div>
                <h3 className="text-lg font-black text-primary mb-6">Flashcards</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.flashcards.map((f, i) => (
                    <div
                      key={i}
                      className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2 block">
                          Card {i + 1}
                        </span>
                        <p className="text-xs font-bold text-primary leading-relaxed mb-4">
                          Q: {f.front}
                        </p>
                      </div>
                      <div className="border-t border-border-theme pt-4">
                        <p className="text-xs text-muted leading-relaxed font-light">
                          {f.back}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            {(!data?.quiz || data.quiz.length === 0) ? (
              <div className="text-center text-slate-500 py-12 text-sm font-semibold">
                No quiz questions available.
              </div>
            ) : (
              data.quiz.map((q, idx) => {
                const answer = answers[idx];
                const isAnswered = answer !== undefined;
                const correctAnswer = q.answer.toString().trim();

                const getCorrectIndex = () => {
                  const options = q.options || [];
                  if (correctAnswer.length === 1) {
                    const charCode = correctAnswer.toLowerCase().charCodeAt(0);
                    if (charCode >= 97 && charCode <= 100) return charCode - 97;
                    if (correctAnswer >= '1' && correctAnswer <= '4') return parseInt(correctAnswer) - 1;
                  }
                  const clean = (s) => s.replace(/^[a-d1-4][).]\s*/i, '').trim().toLowerCase();
                  return options.findIndex(opt => clean(opt.toString()) === clean(correctAnswer));
                };

                const correctIdx = getCorrectIndex();

                return (
                  <div
                    key={idx}
                    className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-4"
                  >
                    <h4 className="text-sm font-bold text-primary leading-snug">
                      Q{idx + 1}: {q.question}
                    </h4>
                    
                    <div className="space-y-2.5">
                      {q.options?.map((opt, oIdx) => {
                        const rawOption = opt.toString();
                        const isSelected = answer === rawOption;
                        const isThisCorrect = oIdx === correctIdx;
                        
                        let optionStyle = "border-border-theme hover:bg-hover-theme bg-bg-secondary text-primary transition-colors";
                        let Icon = null;

                        if (isAnswered) {
                          if (isThisCorrect) {
                            optionStyle = "bg-green-500/10 border-green-500 text-green-600 dark:text-green-400";
                            Icon = CheckCircle2;
                          } else if (isSelected) {
                            optionStyle = "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400";
                            Icon = XCircle;
                          } else {
                            optionStyle = "border-border-theme text-slate-400 dark:text-slate-550 opacity-60";
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            disabled={isAnswered}
                            onClick={() => handleQuizAnswer(idx, rawOption)}
                            className={`w-full text-left p-4 rounded-2xl border flex items-center justify-between transition-all text-xs font-semibold ${optionStyle}`}
                          >
                            <span className="pr-4">{rawOption}</span>
                            {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {isAnswered && (
                      <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl text-xs text-primary leading-relaxed font-light italic">
                        💡 {q.explanation || `Correct Choice: ${q.options?.[correctIdx >= 0 ? correctIdx : 0]}`}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Exam Tab */}
        {activeTab === 'exam' && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {(!data?.exam_questions || data.exam_questions.length === 0) ? (
              <div className="text-center text-slate-500 py-12 text-sm font-semibold">
                No exam questions available.
              </div>
            ) : (
              data.exam_questions.map((q, idx) => (
                <div
                  key={idx}
                  className="bg-card p-5 rounded-2xl border border-border-theme shadow-sm flex items-start space-x-4"
                >
                  <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {q}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
