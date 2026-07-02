import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import Sidebar from '../../components/layout/Sidebar';
import { ThemeContext } from '../../contexts/ThemeContext';
import { BookOpen, RefreshCw, ChevronLeft, ChevronRight, Menu, Sun, Moon, Sparkles, Loader2, ShieldAlert } from 'lucide-react';
import Card from '../../components/common/Card';
import { userService } from '../../services/firebase/userService';
import aiService from "@/services/aiService";

export default function FlashcardsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (window.innerWidth < 768) return false;
    return localStorage.getItem('sidebar_state') !== 'collapsed';
  });
  const [courses, setCourses] = useState([]);
  
  // Selector states
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  
  // Flashcards state
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const generatingRef = useRef(false);

  // Usage limits states
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [countdown, setCountdown] = useState('');

  // Save sidebar state
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

  // Load courses & restore selection
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
            const savedTopicTitle = localStorage.getItem('current_topic_title');

            let matchedCourse = fetched.find(c => c.id === savedCourseId) || fetched[0];
            setSelectedCourse(matchedCourse);

            if (matchedCourse.topics && matchedCourse.topics.length > 0) {
              let matchedTopic = matchedCourse.topics.find(t => t.title === savedTopicTitle) || matchedCourse.topics[0];
              setSelectedTopic(matchedTopic);
            }
          }
        }, (err) => {
          const local = JSON.parse(localStorage.getItem(`courses_${user.uid}`) || '[]');
          setCourses(local);
          if (local.length > 0) {
            const savedCourseId = localStorage.getItem('current_course_id');
            const savedTopicTitle = localStorage.getItem('current_topic_title');

            let matchedCourse = local.find(c => c.id === savedCourseId) || local[0];
            setSelectedCourse(matchedCourse);

            if (matchedCourse.topics && matchedCourse.topics.length > 0) {
              let matchedTopic = matchedCourse.topics.find(t => t.title === savedTopicTitle) || matchedCourse.topics[0];
              setSelectedTopic(matchedTopic);
            }
          }
        });
        return () => unsubFirestore();
      }
    });
    return () => unsub();
  }, [navigate]);

  // Load or generate flashcards for selected course + topic
  const loadFlashcards = async (forceRegen = false) => {
    if (generatingRef.current) {
      console.log("Skipping duplicate request");
      return;
    }
    generatingRef.current = true;

    if (!selectedCourse || !selectedTopic) {
      setCards([]);
      generatingRef.current = false;
      return;
    }
    
    setLoading(true);
    setIsFlipped(false);
    setCurrentIndex(0);
    
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      generatingRef.current = false;
      return;
    }

    const docId = `${selectedCourse.id}_${selectedTopic.title.replace(/\s+/g, '_')}`;
    const docRef = doc(db, 'users', uid, 'flashcards', docId);

    try {
      // Check Firestore saved flashcard first
      if (!forceRegen) {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setCards(snap.data().cards || []);
          setIsLimitReached(false);
          setLoading(false);
          generatingRef.current = false;
          return;
        }
      }

      // Check beta limit before AI query
      const check = await userService.checkLimit(uid, 'flashcards');
      if (!check.allowed) {
        setIsLimitReached(true);
        setLoading(false);
        generatingRef.current = false;
        return;
      }

      setIsLimitReached(false);
      
      // Perform Gemini Flashcards query
      const rawText = await aiService.generateFlashcards(selectedTopic.title, selectedCourse.subject_name);
      let generated = rawText;
      if (typeof rawText === 'string') {
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        generated = JSON.parse(cleanJson);
      }
      
      // Save result in user doc path
      await setDoc(docRef, {
        subjectId: selectedCourse.id,
        topicTitle: selectedTopic.title,
        cards: generated,
        createdAt: serverTimestamp()
      });
      
      // Increment usage in ai_usage collection
      await userService.incrementUsage(uid, 'flashcards');
      setCards(generated);
      
      if (forceRegen) {
        setToastMessage("Flashcard deck re-generated!");
        setTimeout(() => setToastMessage(''), 2500);
      }
    } catch (err) {
      console.warn("Firestore flashcard query failed, fallback local:", err);
      // local fallback
      const generated = [
        { front: `What is the core principle of ${selectedTopic.title}?`, back: `Understanding foundational framework syntheses in ${selectedCourse.subject_name}.` }
      ];
      setCards(generated);
    } finally {
      setLoading(false);
      generatingRef.current = false;
    }
  };

  useEffect(() => {
    loadFlashcards(false);
  }, [selectedCourse, selectedTopic]);

  const handleNext = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 155);
  };

  const handlePrev = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 155);
  };

  const handleShuffle = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setCards(shuffled);
      setCurrentIndex(0);
      setToastMessage("Flashcard deck shuffled!");
      setTimeout(() => setToastMessage(''), 2500);
    }, 155);
  };

  const handleCourseChange = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourse(course);
      localStorage.setItem('current_course_id', course.id);
      if (course.topics && course.topics.length > 0) {
        setSelectedTopic(course.topics[0]);
        localStorage.setItem('current_topic_title', course.topics[0].title);
      } else {
        setSelectedTopic(null);
        localStorage.removeItem('current_topic_title');
      }
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
            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-bold tracking-tight font-sans">Smart Flashcards</span>
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
        <div className="flex-1 flex flex-col bg-bg-secondary overflow-hidden">
          
          {/* Top selectors header */}
          <div className="p-4 bg-card border-b border-border-theme flex flex-wrap gap-4 items-center justify-between flex-shrink-0">
            <div className="flex flex-wrap gap-3 items-center">
              <div>
                <select
                  value={selectedCourse?.id || ''}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="px-3.5 py-2 bg-bg-secondary border border-border-theme rounded-xl text-xs font-semibold focus-ring"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.subject_name}</option>
                  ))}
                </select>
              </div>

              {selectedCourse && (
                <div>
                  <select
                    value={selectedTopic?.title || ''}
                    onChange={(e) => {
                      const topic = selectedCourse.topics?.find(t => t.title === e.target.value);
                      if (topic) {
                        setSelectedTopic(topic);
                        localStorage.setItem('current_topic_title', topic.title);
                      }
                    }}
                    className="px-3.5 py-2 bg-bg-secondary border border-border-theme rounded-xl text-xs font-semibold focus-ring"
                  >
                    {selectedCourse.topics?.map((topic, i) => (
                      <option key={i} value={topic.title}>{topic.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="text-xs font-bold text-slate-500">
              Deck size: {cards.length} cards
            </div>
          </div>

          {/* Center Card Deck */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-bg-secondary transition-colors">
            
            {loading ? (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-xs font-bold text-slate-500">Creating flashcards...</span>
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
            ) : cards.length === 0 ? (
              <div className="text-center max-w-sm space-y-4 p-8 bg-card rounded-2xl border border-border-theme">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-500">No active course syllabus selected.</p>
              </div>
            ) : (
              <div className="w-full max-w-[480px] space-y-6 sm:space-y-8 flex flex-col items-center px-2">
                
                {/* 3D Flip Card Container */}
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="w-full h-72 cursor-pointer relative perspective-1000 group select-none"
                >
                  <div className={`w-full h-full rounded-2xl shadow-md border duration-500 transform-style-3d relative transition-transform ${
                    isFlipped ? 'rotate-y-180' : ''
                  } ${
                    isFlipped 
                      ? 'bg-bg-secondary border-blue-600/30' 
                      : 'bg-card border-border-theme'
                  }`}>
                    
                    {/* FRONT OF THE CARD */}
                    <div className="absolute inset-0 w-full h-full p-6 sm:p-8 flex flex-col justify-between backface-hidden">
                      <div className="flex justify-between items-center text-[10px] font-black text-muted uppercase tracking-widest">
                        <span>Question</span>
                        <span>{currentIndex + 1} / {cards.length}</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center text-center overflow-y-auto custom-scrollbar my-3 px-1">
                        <h2 className="text-xs sm:text-sm md:text-base font-extrabold text-primary leading-relaxed">
                          {cards[currentIndex]?.front}
                        </h2>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold text-center">
                        Click card to reveal answer
                      </div>
                    </div>
 
                    {/* BACK OF THE CARD */}
                    <div className="absolute inset-0 w-full h-full p-6 sm:p-8 flex flex-col justify-between backface-hidden rotate-y-180">
                      <div className="flex justify-between items-center text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                        <span>Recall Answer</span>
                        <span>{currentIndex + 1} / {cards.length}</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center text-center overflow-y-auto custom-scrollbar my-3 px-1">
                        <p className="text-xs md:text-sm font-semibold text-primary leading-relaxed">
                          {cards[currentIndex]?.back}
                        </p>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold text-center">
                        Click to flip back
                      </div>
                    </div>
 
                  </div>
                </div>
 
                {/* Deck navigation controllers */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 w-full">
                  <button
                    onClick={handlePrev}
                    disabled={loading}
                    className="p-3 bg-card hover:bg-hover-theme border border-border-theme rounded-xl transition-all shadow-xs active:scale-90 disabled:opacity-50"
                    title="Previous Card"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-655" />
                  </button>
                  
                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-755 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>FLIP</span>
                  </button>
 
                  <button
                    onClick={handleShuffle}
                    disabled={loading}
                    className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-card hover:bg-hover-theme border border-border-theme text-xs font-bold text-slate-655 rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50"
                    title="Shuffle Cards"
                  >
                    Shuffle
                  </button>
 
                  <button
                    onClick={() => loadFlashcards(true)}
                    disabled={loading}
                    className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-blue-600/10 border border-blue-600/20 text-blue-500 hover:bg-blue-600/20 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    title="Regenerate Deck"
                  >
                    Regenerate
                  </button>
 
                  <button
                    onClick={handleNext}
                    disabled={loading}
                    className="p-3 bg-card hover:bg-hover-theme border border-border-theme rounded-xl transition-all shadow-xs active:scale-90 disabled:opacity-50"
                    title="Next Card"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-655" />
                  </button>
                </div>

              </div>
            )}

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
