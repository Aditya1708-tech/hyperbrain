import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import aiService from "@/services/aiService";
import { auth } from '../../services/firebase/firebase';
import { ArrowLeft, Award, ClipboardCheck, Loader2, Sparkles, CheckCircle, Monitor, ShieldAlert } from 'lucide-react';
import { analyticsService } from '../../services/firebase/firestoreService';
import { userService } from '../../services/firebase/userService';
import Card from '../../components/common/Card';

export default function ExamScreen() {
  const { subjectName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [marksInput, setMarksInput] = useState("70");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [examData, setExamData] = useState(null);
  const [activeSet, setActiveSet] = useState(null);

  // Usage limits states
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

  // Test answers state
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [theoryAnswers, setTheoryAnswers] = useState({});

  // Submission state
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mcqScore, setMcqScore] = useState(0);

  // Theory grading states: questionIndex -> { score, feedback, loading }
  const [theoryGrades, setTheoryGrades] = useState({});

  // Auto focus ref for the first theory question
  const firstTheoryRef = useRef(null);

  // Safeguard ref to prevent proctoring events during submit transition
  const submittingRef = useRef(false);
  const cancelRef = useRef(false);

  const blueprints = {
    20: {
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 5, marks: 1 },
        { name: "Section B (Short Answer)", type: "theory", count: 3, marks: 5 }
      ]
    },
    30: {
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 5, marks: 1 },
        { name: "Section B (Short Answer)", type: "theory", count: 5, marks: 3 },
        { name: "Section C (Long Answer)", type: "theory", count: 2, marks: 5 }
      ]
    },
    50: {
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 10, marks: 1 },
        { name: "Section B (Short Answer)", type: "theory", count: 5, marks: 4 },
        { name: "Section C (Long Answer)", type: "theory", count: 2, marks: 10 }
      ]
    },
    70: {
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 10, marks: 1 },
        { name: "Section B (Short Answer)", type: "theory", count: 4, marks: 5 },
        { name: "Section C (Long Answer)", type: "theory", count: 2, marks: 10 },
        { name: "Section D (Case Study)", type: "theory", count: 1, marks: 20 }
      ]
    },
    100: {
      sections: [
        { name: "Section A (Multiple Choice)", type: "mcq", count: 20, marks: 1 },
        { name: "Section B (Short Answer)", type: "theory", count: 10, marks: 3 },
        { name: "Section C (Long Answer)", type: "theory", count: 5, marks: 10 }
      ]
    }
  };

  const handleCancelGeneration = () => {
    cancelRef.current = true;
    setIsLoading(false);
    setLoadingMessage("");
    setProgressPercent(0);
  };

  const handleGenerateExam = async (customSyllabus = null, customMarks = null, customDifficulty = null) => {
    const marks = customMarks || parseInt(marksInput, 10) || 70;
    
    const uid = auth.currentUser?.uid;
    if (uid) {
      const check = await userService.checkLimit(uid, 'mock_exams');
      if (!check.allowed) {
        setIsLimitReached(true);
        return;
      }
    }

    setIsLimitReached(false);
    setIsLoading(true);
    cancelRef.current = false;
    setProgressPercent(5);
    setLoadingMessage("Building exam structure...");

    try {
      // Step 1: Extract syllabus topics from cache
      await new Promise(resolve => setTimeout(resolve, 300));
      if (cancelRef.current) return;
      
      let syllabusTopics = customSyllabus;
      if (!syllabusTopics) {
        let uid = auth.currentUser?.uid;
        if (!uid) {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('courses_')) {
              uid = key.replace('courses_', '');
              break;
            }
          }
        }
        const local = localStorage.getItem(`courses_${uid}`);
        const courses = local ? JSON.parse(local) : [];
        const matchedCourse = courses.find(c => c.subject_name === subjectName);
        syllabusTopics = matchedCourse ? matchedCourse.topics : [];
      }

      // Step 2: Build paper blueprint instantly
      setLoadingMessage("Building exam structure...");
      setProgressPercent(20);
      await new Promise(resolve => setTimeout(resolve, 300));
      if (cancelRef.current) return;

      const blueprint = blueprints[marks] || blueprints[70];

      // Step 3: Generate questions section-by-section in parallel dynamically
      const sectionResults = [];
      for (let s = 0; s < blueprint.sections.length; s++) {
        const sec = blueprint.sections[s];
        setLoadingMessage(`Generating ${sec.name}...`);
        setProgressPercent(30 + Math.floor((s / blueprint.sections.length) * 60));
        
        const setPromises = ["Set A", "Set B", "Set C"].map(() =>
          aiService.generateMockExam(
            subjectName, 
            sec.name, 
            sec.type, 
            sec.count, 
            sec.marks, 
            syllabusTopics, 
            customDifficulty || "Mixed"
          )
        );
        const results = await Promise.all(setPromises);
        if (cancelRef.current) return;
        sectionResults.push(results);
      }

      setLoadingMessage("Finalizing paper...");
      setProgressPercent(95);
      await new Promise(resolve => setTimeout(resolve, 400));
      if (cancelRef.current) return;

      // Compile Sets dynamically
      const sets = ["Set A", "Set B", "Set C"].map((setName, setIdx) => {
        const setQuestions = [];
        blueprint.sections.forEach((sec, secIdx) => {
          const secResultForSet = sectionResults[secIdx][setIdx];
          if (secResultForSet) {
            setQuestions.push(...secResultForSet);
          }
        });
        return {
          set_name: setName,
          questions: setQuestions
        };
      });

      const generatedData = {
        exam_marks: marks,
        sets
      };

      setExamData(generatedData);
      setProgressPercent(100);
      
      if (uid) {
        await userService.incrementUsage(uid, 'mock_exams');
      }

    } catch (e) {
      console.error(e);
      if (!cancelRef.current) {
        alert("Failed to generate exam: " + e.toString());
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
      setProgressPercent(0);
    }
  };

  // Auto trigger if state is passed from setup page
  useEffect(() => {
    if (location.state && location.state.autoTrigger) {
      const { selectedTopics, marks: selectedMarks, difficulty } = location.state;
      setMarksInput(String(selectedMarks));
      handleGenerateExam(selectedTopics, selectedMarks, difficulty);
    }
  }, [location.state]);

  const handleStartTest = (setName) => {
    submittingRef.current = false;
    setActiveSet(setName);
    setIsSubmitted(false);
    setSelectedAnswers({});
    setTheoryAnswers({});
    setTheoryGrades({});
    
    // Attempt full screen
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed", err);
    }
  };

  const handleSubmitExam = (questionsList) => {
    submittingRef.current = true;
    let score = 0;
    questionsList.forEach((q, index) => {
      if (q.type === 'mcq' && selectedAnswers[index] === q.answer) {
        score += Number(q.marks || 1);
      }
    });

    setMcqScore(score);
    setIsSubmitted(true);

    // Log telemetry exam submitted
    analyticsService.logExamSubmitted(subjectName, score, parseInt(marksInput, 10) || 70);

    // Exit full screen
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Exit fullscreen failed", err);
    }
  };

  const handleGradeTheory = async (index, question, modelAnswer, maxMarks) => {
    const studentAnswer = theoryAnswers[index] || "";
    if (!studentAnswer.trim()) {
      alert("Please write an answer before requesting grading!");
      return;
    }

    setTheoryGrades(prev => ({
      ...prev,
      [index]: { loading: true }
    }));

    try {
      const result = await examService.gradeTheoryAnswer(question, modelAnswer, studentAnswer, maxMarks);
      setTheoryGrades(prev => ({
        ...prev,
        [index]: {
          score: result.score ?? 0,
          feedback: result.feedback || "Graded successfully.",
          loading: false
        }
      }));
    } catch (err) {
      console.error(err);
      setTheoryGrades(prev => ({
        ...prev,
        [index]: {
          score: 0,
          feedback: "Error requesting feedback from AI.",
          loading: false
        }
      }));
    }
  };

  const currentSetData = examData?.sets?.find(s => s.set_name === activeSet);
  const questions = currentSetData?.questions || [];

  // Proctoring logic: auto-submit exam on full screen exit, focus loss, or tab switch
  useEffect(() => {
    if (!activeSet || isSubmitted) return;

    const handleViolation = (message) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      alert(message);
      handleSubmitExam(questions);
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !submittingRef.current) {
        handleViolation("Fullscreen exited. Exam submitted automatically.");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !submittingRef.current) {
        handleViolation("Tab switching detected. Exam submitted automatically.");
      }
    };

    const handleBlur = () => {
      if (!submittingRef.current) {
        handleViolation("Window focus lost. Exam submitted automatically.");
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [activeSet, isSubmitted, questions]);

  // Focus the first theory element when active set loads
  useEffect(() => {
    if (activeSet && firstTheoryRef.current) {
      firstTheoryRef.current.focus();
    }
  }, [activeSet]);

  return (
    <div className="min-h-screen bg-bg-primary text-primary flex flex-col transition-colors duration-300 animate-fade-in">
      
      {/* Header */}
      <header className="h-16 bg-card border-b border-border-theme flex items-center justify-between px-6 flex-shrink-0 transition-colors duration-300 z-10">
        <div className="flex items-center">
          <button
            onClick={() => {
              if (activeSet && !isSubmitted) {
                if (window.confirm("Exit test? Your progress will be lost.")) {
                  setActiveSet(null);
                }
              } else {
                navigate('/dashboard');
              }
            }}
            className="p-1.5 hover:bg-bg-secondary rounded-lg text-muted mr-4 transition-colors duration-300"
          >
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <h1 className="text-lg font-black text-primary tracking-tight transition-colors duration-300">
            Hyper-Exam: {subjectName}
          </h1>
        </div>

        {activeSet && !isSubmitted && (
          <div className="flex items-center space-x-3 bg-red-500/10 px-3.5 py-1.5 rounded-2xl border border-red-500/20">
            <span className="h-2 w-2 bg-red-500 rounded-full animate-ping" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center select-none">
              <Monitor className="w-5 h-5 mr-1.5" /> Proctoring Active
            </span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8 custom-scrollbar bg-bg-primary transition-colors duration-300">
        
        {!activeSet ? (
          /* SETUP PHASE */
          <div className="flex-1 flex flex-col items-center justify-center">
            {isLoading ? (
              <div className="w-full max-w-2xl space-y-6 animate-fade-in">
                {/* Progress bar container */}
                <div className="bg-card border border-border-theme rounded-2xl p-6 shadow-sm space-y-4 transition-colors duration-300">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted">
                    <span>{loadingMessage || "Generating exam structure..."}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-bg-secondary h-2 rounded-full overflow-hidden transition-colors">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${progressPercent}%` }} 
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-semibold text-muted">Estimated time remaining: 5-15s</span>
                    <button
                      onClick={handleCancelGeneration}
                      className="text-[10px] font-black text-red-500 hover:text-red-600 hover:underline transition-colors duration-200"
                    >
                      Cancel Generation
                    </button>
                  </div>
                </div>

                {/* Skeleton Cards loading states */}
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-4 animate-pulse transition-colors duration-300">
                      <div className="flex justify-between items-center border-b border-border-theme pb-3">
                        <div className="w-24 h-4 bg-bg-secondary rounded-xl" />
                        <div className="w-16 h-4 bg-bg-secondary rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <div className="w-full h-4 bg-bg-secondary rounded-xl" />
                        <div className="w-5/6 h-4 bg-bg-secondary rounded-xl" />
                      </div>
                      <div className="pt-2 space-y-2">
                        <div className="w-full h-8 bg-bg-secondary rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !examData ? (
              isLimitReached ? (
                <div className="w-full max-w-[400px]">
                  <Card className="bg-card border border-red-500/20 p-6 text-center space-y-4 rounded-2xl shadow-lg text-primary">
                    <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-red-500">You have reached today's beta limit.</h3>
                    <p className="text-xs text-muted leading-relaxed font-semibold">
                      To prevent resource exhaustion during the beta launch, daily limits are enforced. Your quota will reset in:
                    </p>
                    <div className="bg-bg-secondary p-3 rounded-xl border border-border-theme text-sm font-black text-primary font-mono tracking-wider">
                      {countdown}
                    </div>
                    <button
                      onClick={() => setIsLimitReached(false)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center space-x-1.5"
                    >
                      <span>Try Again</span>
                    </button>
                  </Card>
                </div>
              ) : (
                /* Configure total marks */
                <div className="w-full max-w-[400px] bg-card border border-border-theme rounded-2xl p-8 shadow-sm space-y-6 transition-colors duration-300">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="p-4 bg-bg-secondary rounded-full border border-border-theme shadow-sm flex items-center justify-center transition-colors duration-300">
                      <Award className="w-10 h-10 text-muted" />
                    </div>
                    <h2 className="text-xl font-bold text-primary transition-colors duration-300">Custom Exam Setup</h2>
                  <p className="text-xs text-muted transition-colors duration-300">
                    Set your target score for the generated question paper.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                      Total Marks
                    </label>
                    <select
                      value={marksInput}
                      onChange={(e) => setMarksInput(e.target.value)}
                      className="w-full px-3.5 py-3 bg-bg-secondary border border-border-theme rounded-2xl text-primary text-sm font-semibold focus-ring transition-colors duration-300"
                    >
                      <option value="30">30 Marks (Continuous Evaluation)</option>
                      <option value="50">50 Marks (Mid Term Exam)</option>
                      <option value="70">70 Marks (University Standard)</option>
                      <option value="100">100 Marks (Full Term)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleGenerateExam}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3 rounded-2xl transition-all shadow-sm flex items-center justify-center space-x-2 text-sm focus-ring"
                  >
                    <Sparkles className="w-5 h-5 text-white" />
                    <span>GENERATE EXAM SETS</span>
                  </button>
                </div>
              </div>
              )
            ) : (
              /* Choose exam set */
              <div className="w-full max-w-4xl space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-black text-primary transition-colors duration-300">Select Question Set</h2>
                  <p className="text-sm text-muted transition-colors duration-300">Choose one of the unique syllabus configurations below to begin.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {examData.sets.map((set, i) => (
                    <div
                      key={i}
                      className="bg-card p-8 rounded-2xl border border-border-theme shadow-sm flex flex-col items-center text-center space-y-6 hover:shadow-md transition-all duration-300"
                    >
                      <div className="p-4 bg-bg-secondary rounded-full border border-border-theme flex items-center justify-center transition-colors duration-300">
                        <ClipboardCheck className="w-8 h-8 text-muted" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-primary transition-colors duration-300">{set.set_name}</h3>
                        <p className="text-xs text-muted mt-1 transition-colors duration-300">{set.questions.length} Questions</p>
                      </div>
                      <button
                        onClick={() => handleStartTest(set.set_name)}
                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-2.5 rounded-2xl transition-all text-xs focus-ring shadow-sm"
                      >
                        START TEST
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => setExamData(null)}
                    className="text-xs font-bold text-muted hover:underline transition-colors duration-300"
                  >
                    Go back & change marks settings
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TEST PHASE */
          <div className="w-full max-w-3xl mx-auto space-y-6">
            
            {/* Submission Score Header */}
            {isSubmitted && (
              <div className="bg-blue-600 text-white p-6 rounded-2xl flex items-center justify-between border border-blue-500/20 shadow-sm transition-colors duration-300">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                    EXAM SUBMITTED
                  </span>
                  <h3 className="text-xl font-bold">Performance Evaluated</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">
                    MCQ SCORE
                  </span>
                  <span className="text-3xl font-black">
                    {mcqScore} / {questions.filter(q => q.type === 'mcq').reduce((acc, q) => acc + (q.marks || 1), 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Questions list */}
            <div className="space-y-6">
              {questions.map((q, index) => {
                const isMCQ = q.type === 'mcq';
                const isFirstTheory = !isMCQ && questions.findIndex(x => x.type === 'theory') === index;

                return (
                  <div
                    key={index}
                    className="bg-card p-6 md:p-8 rounded-2xl border border-border-theme shadow-sm space-y-6 transition-colors duration-300 text-primary"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border-theme pb-4 transition-colors duration-300">
                      <span className="text-xs font-black text-muted uppercase tracking-wider transition-colors duration-300">
                        Question {index + 1}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bg-secondary border border-border-theme transition-colors duration-300">
                        {q.marks || 1} MARKS
                      </span>
                    </div>

                    {/* Question text */}
                    <p className="text-base font-extrabold text-primary leading-snug transition-colors duration-300">
                      {q.question}
                    </p>

                    {/* Input controls */}
                    <div className="pt-2">
                      {isMCQ ? (
                        /* MCQ Radios */
                        <div className="space-y-3">
                          {q.options?.map((opt, oIndex) => {
                            const optionStr = String(opt);
                            const isSelected = selectedAnswers[index] === optionStr;
                            return (
                              <label
                                key={oIndex}
                                className={`flex items-center space-x-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                                    : 'border-border-theme text-muted hover:bg-bg-secondary'
                                }`}
                              >
                                <input
                                  type="radio"
                                  disabled={isSubmitted}
                                  name={`question-${index}`}
                                  value={optionStr}
                                  checked={isSelected}
                                  onChange={() => setSelectedAnswers(prev => ({ ...prev, [index]: optionStr }))}
                                  className="h-4 w-4 text-blue-600 border-border-theme focus:ring-0"
                                />
                                <span className="text-sm">{optionStr}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        /* THEORY Textarea */
                        <textarea
                          ref={isFirstTheory ? firstTheoryRef : null}
                          disabled={isSubmitted}
                          rows={6}
                          value={theoryAnswers[index] || ""}
                          onChange={(e) => setTheoryAnswers(prev => ({ ...prev, [index]: e.target.value }))}
                          placeholder="Type your detailed technical answer here..."
                          className="w-full p-4 bg-bg-secondary border border-border-theme rounded-2xl focus-ring text-primary text-sm placeholder-h-secondary transition-colors duration-300"
                        />
                      )}
                    </div>

                    {/* Review Answers & Feedback */}
                    {isSubmitted && (
                      <div className="pt-4 border-t border-border-theme space-y-4 transition-colors duration-300">
                        
                        {/* Model answer panel */}
                        <div className="p-4 rounded-2xl bg-blue-600/10 border border-blue-600/20 space-y-1.5 transition-colors duration-300 text-primary">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center">
                            <Sparkles className="w-5 h-5 mr-1.5" /> Model Answer / Explanation:
                          </span>
                          <p className="text-xs text-muted leading-relaxed font-semibold transition-colors duration-300">
                            {isMCQ ? q.explanation : q.model_answer}
                          </p>
                        </div>

                        {/* AI Theory Grading Trigger */}
                        {!isMCQ && (
                          <div className="space-y-3">
                            {theoryGrades[index] ? (
                              theoryGrades[index].loading ? (
                                <div className="flex items-center space-x-2 text-xs font-bold text-muted">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted" />
                                  <span>AI Tutor grading response...</span>
                                </div>
                              ) : (
                                <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 space-y-2 transition-colors duration-300 text-primary">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest flex items-center">
                                      <CheckCircle className="w-5 h-5 mr-1.5" /> AI Grading Result
                                    </span>
                                    <span className="text-xs font-extrabold text-green-600 dark:text-green-400">
                                      Score: {theoryGrades[index].score} / {q.marks}
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium text-muted leading-relaxed transition-colors duration-300">
                                    {theoryGrades[index].feedback}
                                  </p>
                                </div>
                              )
                            ) : (
                              <button
                                onClick={() => handleGradeTheory(index, q.question, q.model_answer, q.marks)}
                                className="flex items-center justify-center space-x-2 bg-bg-secondary hover:bg-card border border-border-theme text-primary text-xs font-semibold py-2 px-4 rounded-2xl transition-all shadow-sm focus-ring"
                              >
                                <Sparkles className="w-5 h-5 mr-1.5 text-muted" />
                                <span>Get AI Grade & Feedback</span>
                              </button>
                            )}
                          </div>
                        )}

                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* Submit Control */}
            <div className="fixed md:static bottom-0 left-0 right-0 p-4 md:p-0 bg-bg-primary md:bg-transparent border-t md:border-t-0 border-border-theme md:border-none z-40 shadow-[0_-8px_20px_rgba(0,0,0,0.08)] md:shadow-none">
              {!isSubmitted ? (
                <button
                  onClick={() => handleSubmitExam(questions)}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3.5 md:py-4 rounded-2xl transition-all shadow-sm text-sm focus-ring"
                >
                  FINAL SUBMIT
                </button>
              ) : (
                <button
                  onClick={() => {
                    setActiveSet(null);
                    setExamData(null);
                  }}
                  className="w-full bg-card border border-border-theme hover:bg-bg-secondary text-primary font-semibold py-3.5 md:py-4 rounded-2xl transition-all shadow-sm text-sm focus-ring"
                >
                  Exit Exam Review
                </button>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
