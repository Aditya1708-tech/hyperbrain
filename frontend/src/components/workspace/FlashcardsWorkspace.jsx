import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Shuffle, RotateCcw, Download, Sparkles, ChevronLeft, 
  ChevronRight, Bookmark, BookmarkCheck, Search, HelpCircle, Loader2,
  Clock, Award, AlertTriangle, ArrowRight, HelpCircle as QuestionIcon
} from 'lucide-react';
import aiService from '../../services/aiService';
import Card from '../common/Card';
import { db, auth } from '../../services/firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function FlashcardsWorkspace({ courseData, activeTopicTitle, onSelectTopic }) {
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // SRS Spaced Repetition States
  const [srsData, setSrsData] = useState({});
  const [studyMode, setStudyMode] = useState("All"); // "Due" | "All" | "Random" | "Weak" | "Bookmarks"
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  const uid = auth.currentUser?.uid || 'guest';
  const currentTopicTitle = activeTopicTitle || courseData?.topics?.[0]?.title || '';
  const currentTopic = courseData?.topics?.find(t => t.title === currentTopicTitle);

  // Load cards & SRS states on mount or topic change
  useEffect(() => {
    if (!currentTopicTitle) return;
    loadFlashcards();
  }, [currentTopicTitle]);

  // Session clock timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync load SRS state
  useEffect(() => {
    const srsKey = `srs_flashcards_${uid}_${courseData.id}`;
    setSrsData(JSON.parse(localStorage.getItem(srsKey) || '{}'));
  }, [uid, courseData.id]);

  const loadFlashcards = async () => {
    setLoading(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    
    const localKey = `flashcards_${uid}_${courseData.id}_${currentTopicTitle}`;
    const bookmarkKey = `bookmarks_flashcards_${uid}_${courseData.id}_${currentTopicTitle}`;

    setBookmarks(JSON.parse(localStorage.getItem(bookmarkKey) || '[]'));

    // First: check Knowledge Object pre-generated flashcards!
    const safeKey = currentTopicTitle.replace(/\./g, '_');
    const cachedKnowledgeObject = courseData?.generatedContent?.[safeKey];
    if (cachedKnowledgeObject && cachedKnowledgeObject.flashcards && cachedKnowledgeObject.flashcards.length > 0) {
      const mappedCards = cachedKnowledgeObject.flashcards.map((c, idx) => ({
        id: `card_${Date.now()}_${idx}`,
        title: c.title || `Concept ${idx + 1}`,
        question: c.question || c.front || '',
        answer: c.answer || c.back || '',
        explanation: c.explanation || '',
        difficulty: c.difficulty || 'Medium',
        tags: c.tags || ['Knowledge Engine']
      }));
      setCards(mappedCards);
      localStorage.setItem(localKey, JSON.stringify(mappedCards));
      setLoading(false);
      return;
    }

    // Check localStorage second
    const cached = localStorage.getItem(localKey);
    if (cached) {
      setCards(JSON.parse(cached));
      setLoading(false);
      return;
    }

    // Fallback: Generate cards
    await generateInitialCards();
  };

  const generateInitialCards = async () => {
    setLoading(true);
    const notesContext = currentTopic?.content || currentTopic?.summary || '';
    try {
      const rawText = await aiService.generateFlashcards(currentTopicTitle, courseData.subject_name, notesContext);
      let generated = [];
      if (typeof rawText === 'string') {
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        generated = JSON.parse(cleanJson);
      } else {
        generated = rawText;
      }

      const processed = generated.map((c, idx) => ({
        id: `card_${Date.now()}_${idx}`,
        title: c.title || `Concept ${idx + 1}`,
        question: c.question || c.front || '',
        answer: c.answer || c.back || '',
        explanation: c.explanation || '',
        difficulty: c.difficulty || 'Medium',
        tags: c.tags || []
      }));

      setCards(processed);
      const localKey = `flashcards_${uid}_${courseData.id}_${currentTopicTitle}`;
      localStorage.setItem(localKey, JSON.stringify(processed));
    } catch (err) {
      console.error("AI flashcard generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped && filteredCards[currentIndex]) {
        const cardId = filteredCards[currentIndex].id;
        if (e.key === '1') handleRateCard(cardId, 1);
        else if (e.key === '2') handleRateCard(cardId, 2);
        else if (e.key === '3') handleRateCard(cardId, 3);
        else if (e.key === '4') handleRateCard(cardId, 4);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentIndex, cards, srsData, studyMode, searchQuery]);

  // SRS SuperMemo-2 Calculation
  const handleRateCard = async (cardId, rating) => {
    const cardSrs = srsData[cardId] || {
      reviewCount: 0,
      easeFactor: 2.5,
      interval: 1,
      nextReviewDate: new Date().toISOString(),
      state: 'learning'
    };

    let nextEase = cardSrs.easeFactor;
    let nextInterval = cardSrs.interval;

    if (rating === 1) { // Again
      nextEase = Math.max(1.3, cardSrs.easeFactor - 0.2);
      nextInterval = 1;
    } else if (rating === 2) { // Hard
      nextEase = Math.max(1.3, cardSrs.easeFactor - 0.15);
      nextInterval = Math.ceil(cardSrs.interval * 1.2);
    } else if (rating === 3) { // Good
      if (cardSrs.reviewCount === 0) {
        nextInterval = 1;
      } else if (cardSrs.reviewCount === 1) {
        nextInterval = 4;
      } else {
        nextInterval = Math.ceil(cardSrs.interval * cardSrs.easeFactor);
      }
    } else if (rating === 4) { // Easy
      nextEase = Math.min(3.0, cardSrs.easeFactor + 0.15);
      if (cardSrs.reviewCount === 0) {
        nextInterval = 3;
      } else if (cardSrs.reviewCount === 1) {
        nextInterval = 6;
      } else {
        nextInterval = Math.ceil(cardSrs.interval * cardSrs.easeFactor * 1.3);
      }
    }

    const reviewCount = cardSrs.reviewCount + 1;
    let cardState = 'review';
    if (rating === 1) {
      cardState = 'weak';
    } else if (nextInterval > 15) {
      cardState = 'mastered';
    }

    const updatedSrs = {
      ...srsData,
      [cardId]: {
        reviewCount,
        easeFactor: nextEase,
        interval: nextInterval,
        nextReviewDate: new Date(Date.now() + nextInterval * 24 * 60 * 60 * 1000).toISOString(),
        state: cardState,
        lastReviewed: new Date().toISOString()
      }
    };

    setSrsData(updatedSrs);
    const srsKey = `srs_flashcards_${uid}_${courseData.id}`;
    localStorage.setItem(srsKey, JSON.stringify(updatedSrs));

    // Save to Firestore workspace doc
    if (db && uid !== 'guest') {
      try {
        const docRef = doc(db, 'users', uid, 'subjects', courseData.id);
        await updateDoc(docRef, {
          [`srsData.${cardId}`]: updatedSrs[cardId]
        });
      } catch (err) {
        console.warn("Could not save SRS stats to Firestore:", err);
      }
    }

    showToast(`Ease: ${nextEase.toFixed(2)} | Next Review: ${nextInterval} days`);

    // Auto-advance
    setTimeout(() => {
      handleNext();
    }, 600);
  };

  // Filter cards based on Active Study Mode
  const getFilteredCards = () => {
    const today = new Date().toISOString();
    let list = [...cards];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.question || '').toLowerCase().includes(q) ||
        (c.answer || '').toLowerCase().includes(q)
      );
    }

    if (showOnlyBookmarks) {
      list = list.filter(c => bookmarks.includes(c.id));
    }

    if (studyMode === "Due") {
      list = list.filter(c => {
        const srs = srsData[c.id];
        return !srs || srs.nextReviewDate <= today;
      });
    } else if (studyMode === "Weak") {
      list = list.filter(c => {
        const srs = srsData[c.id];
        return srs && srs.state === 'weak';
      });
    } else if (studyMode === "Random") {
      list = list.sort(() => Math.random() - 0.5);
    } else if (studyMode === "Bookmarks") {
      list = list.filter(c => bookmarks.includes(c.id));
    }

    return list;
  };

  const filteredCards = getFilteredCards();
  const activeCard = filteredCards[currentIndex];

  const handleToggleBookmark = (cardId) => {
    const bookmarkKey = `bookmarks_flashcards_${uid}_${courseData.id}_${currentTopicTitle}`;
    let updated;
    if (bookmarks.includes(cardId)) {
      updated = bookmarks.filter(id => id !== cardId);
    } else {
      updated = [...bookmarks, cardId];
    }
    setBookmarks(updated);
    localStorage.setItem(bookmarkKey, JSON.stringify(updated));
  };

  const handleNext = () => {
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const handleRestartSRS = () => {
    const srsKey = `srs_flashcards_${uid}_${courseData.id}`;
    localStorage.removeItem(srsKey);
    setSrsData({});
    setCurrentIndex(0);
    setIsFlipped(false);
    showToast("Reset spaced repetition progress!");
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const totalCards = filteredCards.length;
  const masteredCount = cards.filter(c => srsData[c.id]?.state === 'mastered').length;
  const weakCount = cards.filter(c => srsData[c.id]?.state === 'weak').length;

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6 items-start font-sans text-primary select-none">
      
      {/* 1. LEFT SIDEBAR */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-card border border-border-theme rounded-2xl p-5 space-y-5 shadow-xs">
        
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-primary border-b border-border-theme pb-2 mb-4">
            Flashcard Topics
          </h3>
          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {courseData.topics?.map((topic, i) => (
              <button
                key={i}
                onClick={() => onSelectTopic(topic.title)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-hover-theme transition-all truncate block ${
                  topic.title === currentTopicTitle
                    ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold border-l-4 border-blue-600'
                    : 'text-slate-500'
                }`}
              >
                {topic.title}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-border-theme" />

        {/* Study Mode Selector */}
        <div className="space-y-3">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
            SRS Study Mode
          </label>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: "All", label: "Sequential Deck" },
              { id: "Due", label: "Due For Review" },
              { id: "Weak", label: "Weak Cards" },
              { id: "Random", label: "Random Review" }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => { setStudyMode(mode.id); setCurrentIndex(0); }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
                  studyMode === mode.id
                    ? 'bg-blue-600/10 border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-border-theme text-slate-500 hover:bg-hover-theme'
                }`}
              >
                <span>{mode.label}</span>
                {mode.id === "Due" && (
                  <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                    {cards.filter(c => !srsData[c.id] || srsData[c.id].nextReviewDate <= new Date().toISOString()).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-border-theme" />

        {/* Progress summary stats */}
        <div className="bg-bg-secondary/60 p-4 rounded-xl space-y-3 border border-border-theme">
          <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
            <span>Mastery Progress</span>
            <span>{cards.length > 0 ? Math.round((masteredCount / cards.length) * 100) : 0}%</span>
          </div>
          <div className="h-1.5 w-full bg-border-theme rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${cards.length > 0 ? (masteredCount / cards.length) * 100 : 0}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div>Mastered: <span className="font-extrabold text-primary">{masteredCount}</span></div>
            <div>Weak Cards: <span className="font-extrabold text-primary">{weakCount}</span></div>
          </div>
        </div>

      </div>

      {/* 2. MAIN ACTIVE SPACE */}
      <div className="flex-1 w-full space-y-6">
        
        {/* Workspace Sub Header */}
        <div className="bg-card border border-border-theme rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block">
              Knowledge Engine Spaced Repetition (SRS)
            </span>
            <div className="flex items-center space-x-3 text-xs text-slate-500 font-bold">
              <span className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Session: {formatTimer(sessionSeconds)}</span>
              </span>
              <span>•</span>
              <span>Mode: {studyMode}</span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleRestartSRS}
              className="flex items-center space-x-1.5 px-3.5 py-2 border border-border-theme hover:bg-hover-theme rounded-xl text-xs font-bold text-slate-500 hover:text-primary transition-all"
              title="Reset SRS Progression Stats"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset SRS</span>
            </button>
          </div>
        </div>

        {/* Loading overlay */}
        {loading ? (
          <div className="bg-card border border-border-theme rounded-3xl min-h-[350px] shadow-sm flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="w-8 h-8 text-blue-650 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Retrieving flashcard deck from Knowledge Object cache...</p>
          </div>
        ) : !activeCard ? (
          <div className="bg-card border border-border-theme rounded-3xl min-h-[350px] shadow-sm flex flex-col items-center justify-center p-8 space-y-4 text-center">
            <HelpCircle className="w-10 h-10 text-slate-355" />
            <h4 className="text-sm font-bold text-primary">No cards due in study mode: {studyMode}</h4>
            <p className="text-xs text-muted max-w-xs font-semibold leading-relaxed">
              All cards have been scheduled! Try switching to "Sequential Deck" to browse all entries.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Perspective card box */}
            <div 
              onClick={() => setIsFlipped(!isFlipped)}
              className="group relative w-full min-h-[350px] bg-card border border-border-theme rounded-3xl shadow-sm cursor-pointer select-none transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 flex flex-col overflow-hidden"
            >
              
              {/* Card sub header */}
              <div className="p-5 border-b border-border-theme flex items-center justify-between bg-bg-secondary/40">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-widest">
                  Card {currentIndex + 1} of {totalCards} • {activeCard.title}
                </span>

                <div className="flex items-center space-x-3">
                  <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full select-none uppercase tracking-wider ${
                    srsData[activeCard.id]?.state === 'mastered'
                      ? 'bg-green-50 text-green-600 dark:bg-green-950/20'
                      : srsData[activeCard.id]?.state === 'weak'
                      ? 'bg-red-50 text-red-600 dark:bg-red-950/20'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {srsData[activeCard.id]?.state || 'Learning'}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBookmark(activeCard.id);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-yellow-500 transition-colors"
                  >
                    {bookmarks.includes(activeCard.id) ? (
                      <BookmarkCheck className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <Bookmark className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Front or back card display */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 text-center space-y-4">
                {!isFlipped ? (
                  // Front panel
                  <div className="space-y-4 animate-fade-in w-full">
                    <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-150 leading-relaxed max-w-2xl mx-auto">
                      {activeCard.question}
                    </h2>
                    
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-450 uppercase tracking-widest block pt-8 animate-pulse">
                      ⚡ Click card or press Space to reveal answer
                    </span>
                  </div>
                ) : (
                  // Back panel
                  <div className="space-y-5 text-left w-full max-w-2xl mx-auto animate-fade-in py-4">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-widest block">Correct Explanation</span>
                      <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                        {activeCard.answer}
                      </p>
                    </div>

                    {activeCard.explanation && (
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-widest block">Details</span>
                        <p className="text-xs text-slate-655 dark:text-slate-355 leading-relaxed font-light">
                          {activeCard.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* SRS ratings & hotkeys */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Manual Nav controls */}
              <div className="flex items-center space-x-2 select-none">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="p-3 bg-card border border-border-theme rounded-xl text-slate-500 hover:text-primary transition-all disabled:opacity-50"
                  title="Previous Card"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="px-5 py-3 bg-card border border-border-theme hover:bg-hover-theme rounded-xl text-xs font-black uppercase tracking-wider text-slate-655"
                >
                  {isFlipped ? 'Show Question' : 'Reveal Answer'}
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === totalCards - 1}
                  className="p-3 bg-card border border-border-theme rounded-xl text-slate-500 hover:text-primary transition-all disabled:opacity-50"
                  title="Next Card"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* SM2 rating triggers */}
              {isFlipped ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => handleRateCard(activeCard.id, 1)}
                    className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-650 dark:text-red-400 border border-red-500/25 text-xs font-bold rounded-xl transition-all"
                  >
                    Again (1)
                  </button>
                  <button
                    onClick={() => handleRateCard(activeCard.id, 2)}
                    className="px-3.5 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25 text-xs font-bold rounded-xl transition-all"
                  >
                    Hard (2)
                  </button>
                  <button
                    onClick={() => handleRateCard(activeCard.id, 3)}
                    className="px-3.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-450 border border-blue-500/25 text-xs font-bold rounded-xl transition-all"
                  >
                    Good (3)
                  </button>
                  <button
                    onClick={() => handleRateCard(activeCard.id, 4)}
                    className="px-3.5 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/25 text-xs font-bold rounded-xl transition-all"
                  >
                    Easy (4)
                  </button>
                </div>
              ) : (
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">
                  Hotkey: Space to flip • Ratings 1-4
                </div>
              )}

            </div>

          </div>
        )}

      </div>

      {/* Toast Overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-card border border-border-theme px-5 py-3.5 rounded-2xl shadow-xl z-50 flex items-center space-x-3 text-xs font-bold text-primary transition-all duration-300 transform translate-y-0 opacity-100">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
