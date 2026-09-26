import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, Loader2, BookOpen, MessageSquare, Bookmark, 
  BookmarkCheck, Plus, Trash2, HelpCircle, CheckSquare, Square, 
  Info, AlertCircle 
} from 'lucide-react';
import aiService from '../../services/aiService';
import { db, auth } from '../../services/firebase/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { renderMarkdown } from '../../utils/markdownRenderer';

export default function TutorWorkspace({ courseData, activeTopicTitle, onSelectTopic }) {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [bookmarkedAnswers, setBookmarkedAnswers] = useState([]);
  const [completedSubsections, setCompletedSubsections] = useState({}); // { [topic_sub]: boolean }
  const [toastMessage, setToastMessage] = useState('');

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Selected topic defaults to activeTopicTitle, or falls back to first topic in list
  const currentTopicTitle = activeTopicTitle || courseData?.topics?.[0]?.title || '';
  const currentTopic = courseData?.topics?.find(t => t.title === currentTopicTitle);

  // Load chat history, suggested questions, bookmarks on mount or topic change
  useEffect(() => {
    if (!currentTopicTitle) return;
    loadTutorState();
  }, [currentTopicTitle]);

  // Scroll to bottom of chat on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadTutorState = async () => {
    setLoading(true);
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    const chatKey = `tutor_chat_${uid}_${courseData.id}_${currentTopicTitle}`;
    const bookmarksKey = `tutor_bookmarks_${uid}_${courseData.id}_${currentTopicTitle}`;
    const recentsKey = `tutor_recents_${uid}_${courseData.id}`;
    const completedKey = `tutor_completed_${uid}_${courseData.id}`;

    setMessages(JSON.parse(localStorage.getItem(chatKey) || '[]'));
    setBookmarkedAnswers(JSON.parse(localStorage.getItem(bookmarksKey) || '[]'));
    setRecentQuestions(JSON.parse(localStorage.getItem(recentsKey) || '[]'));
    setCompletedSubsections(JSON.parse(localStorage.getItem(completedKey) || '{}'));

    // Generate suggested questions for this topic
    generateSuggestions();
    setLoading(false);
  };

  const generateSuggestions = async () => {
    const suggestions = [
      `What is the primary objective of ${currentTopicTitle}?`,
      `Give me a real-world example of ${currentTopicTitle}.`,
      `Explain the differences or connections in ${currentTopicTitle}.`
    ];
    setSuggestedQuestions(suggestions);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSend = async (e, customText = null) => {
    if (e) e.preventDefault();
    const textToSend = customText || inputValue;
    if (!textToSend.trim() || isTyping) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const userMessage = { role: 'user', text: textToSend, timestamp: new Date() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

    // Save recent question
    const recentsKey = `tutor_recents_${uid}_${courseData.id}`;
    const updatedRecents = [textToSend, ...recentQuestions.filter(q => q !== textToSend)].slice(0, 5);
    setRecentQuestions(updatedRecents);
    localStorage.setItem(recentsKey, JSON.stringify(updatedRecents));

    // Save chat history
    const chatKey = `tutor_chat_${uid}_${courseData.id}_${currentTopicTitle}`;
    localStorage.setItem(chatKey, JSON.stringify(updatedMessages));

    // Context Injection
    const notesContext = currentTopic?.content || currentTopic?.summary || '';
    const fullContext = `
      Course Name: ${courseData.subject_name}
      Current Topic: ${currentTopicTitle}
      Topic Notes / Outline: ${notesContext}
      Use the above context to answer the user question. Focus on syllabus alignment.
    `;

    try {
      // Query AI Tutor API
      const aiResponse = await aiService.askTutorChat([
        ...messages.map(m => ({ role: m.role, content: m.text })),
        { role: 'user', content: textToSend }
      ], fullContext, 'Medium');

      const botMessage = { 
        id: `tutor_msg_${Date.now()}`,
        role: 'tutor', 
        text: aiResponse, 
        timestamp: new Date() 
      };

      const finalMessages = [...updatedMessages, botMessage];
      setMessages(finalMessages);
      localStorage.setItem(chatKey, JSON.stringify(finalMessages));
    } catch (err) {
      console.error("AI Tutor response error:", err);
      const errorMessage = {
        id: `tutor_err_${Date.now()}`,
        role: 'tutor',
        text: "I experienced difficulty compiling that response. Please try again or rephrase.",
        timestamp: new Date()
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (actionType) => {
    let prompt = "";
    switch (actionType) {
      case "simpler":
        prompt = `Explain "${currentTopicTitle}" in simpler terms using analogies for beginners.`;
        break;
      case "example":
        prompt = `Provide 2 concrete real-life examples illustrating "${currentTopicTitle}".`;
        break;
      case "analogy":
        prompt = `Create a memorable educational analogy for the core concepts in "${currentTopicTitle}".`;
        break;
      case "quiz":
        prompt = `Generate a quick 3-question multiple choice conceptual quiz on "${currentTopicTitle}".`;
        break;
      case "viva":
        prompt = `List 3 potential viva (oral exam) questions an examiner might ask about "${currentTopicTitle}" along with brief answers.`;
        break;
      case "formula":
        prompt = `Break down any formulas, equations, or structural notations relevant to "${currentTopicTitle}". If none, explain the logical structure.`;
        break;
      case "realworld":
        prompt = `What are the active real-life applications and industry use-cases of "${currentTopicTitle}"?`;
        break;
      case "memory":
        prompt = `Provide mnemonic devices or memory tricks to retain key definitions of "${currentTopicTitle}".`;
        break;
      case "examtips":
        prompt = `What are the critical exam checkpoints and common student pitfalls/mistakes when answering questions about "${currentTopicTitle}"?`;
        break;
      case "mindmap":
        prompt = `Compile a hierarchical outline representing a logical Mind Map of the connections within "${currentTopicTitle}".`;
        break;
      case "revisionsheet":
        prompt = `Generate a compact revision list of key definitions and essential takeaways for "${currentTopicTitle}".`;
        break;
      case "pyq":
        prompt = `Model 2 sample university exam questions (Previous Year Question style) that cover "${currentTopicTitle}".`;
        break;
      default:
        return;
    }
    handleSend(null, prompt);
  };

  const handleToggleBookmark = (msg) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const bookmarksKey = `tutor_bookmarks_${uid}_${courseData.id}_${currentTopicTitle}`;

    let updated;
    const exists = bookmarkedAnswers.find(b => b.id === msg.id);
    if (exists) {
      updated = bookmarkedAnswers.filter(b => b.id !== msg.id);
      showToast("Removed bookmark.");
    } else {
      updated = [...bookmarkedAnswers, msg];
      showToast("Saved to Bookmarks!");
    }
    setBookmarkedAnswers(updated);
    localStorage.setItem(bookmarksKey, JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    if (window.confirm("Clear conversation history for this topic?")) {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const chatKey = `tutor_chat_${uid}_${courseData.id}_${currentTopicTitle}`;
      localStorage.removeItem(chatKey);
      setMessages([]);
      showToast("History cleared.");
    }
  };

  const handleToggleSubsection = (sectionTitle) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const completedKey = `tutor_completed_${uid}_${courseData.id}`;
    
    const nextState = !completedSubsections[sectionTitle];
    const updated = { ...completedSubsections, [sectionTitle]: nextState };
    setCompletedSubsections(updated);
    localStorage.setItem(completedKey, JSON.stringify(updated));
    showToast(nextState ? "Section checked!" : "Section unchecked.");
  };

  const quickActions = [
    { label: "Explain Simpler", type: "simpler" },
    { label: "Give Example", type: "example" },
    { label: "Create Analogy", type: "analogy" },
    { label: "Generate Quiz", type: "quiz" },
    { label: "Viva Questions", type: "viva" },
    { label: "Explain Formula", type: "formula" },
    { label: "Real-world Apps", type: "realworld" },
    { label: "Memory Tricks", type: "memory" },
    { label: "Exam Tips", type: "examtips" },
    { label: "Mind Map", type: "mindmap" },
    { label: "Revision Sheet", type: "revisionsheet" },
    { label: "Exam Questions", type: "pyq" }
  ];

  return (
    <div className="w-full flex flex-col xl:flex-row gap-6 items-start font-sans text-primary">
      
      {/* 1. MAIN CHAT AREA */}
      <div className="flex-1 min-w-0 w-full bg-card border border-border-theme rounded-2xl shadow-xs flex flex-col h-[600px] overflow-hidden">
        
        {/* Chat Title / Context Header */}
        <div className="p-4 bg-bg-secondary/40 border-b border-border-theme flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-blue-650" />
            <div>
              <h2 className="text-xs font-black text-primary uppercase tracking-wider">
                AI Course Assistant
              </h2>
              <p className="text-[10px] text-slate-500 font-bold">
                Contextual Mode: {currentTopicTitle}
              </p>
            </div>
          </div>
          
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-1.5 hover:bg-hover-theme text-slate-400 hover:text-red-500 rounded-lg transition-colors"
              title="Clear Chat History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Messages list */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-card custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
              <div className="p-3 bg-bg-secondary rounded-full">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Ready to tutor
                </h4>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                  I have analyzed "{currentTopicTitle}". Ask me anything or trigger the quick actions below to kickstart revisions.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`max-w-[85%] space-y-1`}>
                    <div className={`p-4 rounded-2xl text-xs font-semibold leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-bg-secondary text-slate-850 dark:text-slate-150 border border-border-theme rounded-bl-none'
                    }`}>
                      {isUser ? msg.text : renderMarkdown(msg.text)}
                    </div>
                    {!isUser && (
                      <div className="flex justify-start pl-1">
                        <button
                          onClick={() => handleToggleBookmark(msg)}
                          className="flex items-center space-x-1 text-[9px] font-black text-slate-400 hover:text-yellow-600 transition-colors"
                        >
                          {bookmarkedAnswers.some(b => b.id === msg.id) ? (
                            <>
                              <BookmarkCheck className="w-3 h-3 text-yellow-500" />
                              <span className="text-yellow-600">Bookmarked</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="w-3 h-3" />
                              <span>Save Bookmark</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isTyping && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-bg-secondary border border-border-theme p-4 rounded-2xl rounded-bl-none flex items-center space-x-2 text-[10px] font-bold text-slate-500 shadow-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span>AI Tutor is compiling response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick action chips list */}
        <div className="px-4 py-2.5 border-t border-border-theme bg-bg-secondary/40 flex flex-wrap items-center gap-1.5 flex-shrink-0">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap flex-shrink-0 mr-1">
            Quick Actions:
          </span>
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickAction(action.type)}
              className="px-3 py-1 bg-card hover:bg-hover-theme text-[10px] font-bold border border-border-theme rounded-lg transition-all text-slate-655"
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Send message form */}
        <form 
          onSubmit={handleSend}
          className="p-3 bg-card border-t border-border-theme flex items-center space-x-2 flex-shrink-0"
        >
          <input
            type="text"
            required
            placeholder={`Ask about "${currentTopicTitle}"...`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 min-w-0 bg-bg-secondary text-primary text-xs px-4 py-2.5 rounded-xl border border-border-theme focus-ring"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="p-2.5 flex-shrink-0 bg-blue-600 hover:bg-blue-755 text-white rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>

      {/* 2. RIGHT COMPANION PANEL */}
      <div className="w-full xl:w-80 flex-shrink-0 space-y-6">
        
        {/* Outlines & Learning Progress */}
        <div className="bg-card border border-border-theme rounded-2xl p-5 space-y-4 shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary border-b border-border-theme pb-2 flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-blue-650" />
            <span>Syllabus Outline</span>
          </h3>
          
          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {courseData.topics?.map((topic, idx) => (
              <button
                key={idx}
                onClick={() => onSelectTopic(topic.title)}
                className={`w-full text-left p-2 rounded-xl text-xs font-semibold hover:bg-hover-theme transition-all truncate block ${
                  topic.title === currentTopicTitle
                    ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500'
                }`}
              >
                {topic.title}
              </button>
            ))}
          </div>

          <hr className="border-border-theme" />

          {/* Quick outline subsections progress */}
          <div className="space-y-3">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
              Checkpoint checklist
            </span>
            <div className="space-y-2">
              {["Core definitions", "Solved formulas", "Concept illustrations", "Revision quizzes"].map((sec, idx) => {
                const isChecked = completedSubsections[`${currentTopicTitle}_${sec}`];
                return (
                  <div 
                    key={idx}
                    onClick={() => handleToggleSubsection(`${currentTopicTitle}_${sec}`)}
                    className="flex items-center space-x-2.5 cursor-pointer select-none text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-green-500" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>{sec}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Suggested and Recent Questions */}
        <div className="bg-card border border-border-theme rounded-2xl p-5 space-y-4 shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary border-b border-border-theme pb-2 flex items-center space-x-1.5">
            <Info className="w-4 h-4 text-blue-650" />
            <span>Suggested Queries</span>
          </h3>

          <div className="space-y-2">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(null, q)}
                className="w-full text-left p-2.5 bg-bg-secondary hover:bg-hover-theme text-[10px] font-semibold rounded-xl text-slate-500 hover:text-primary border border-border-theme transition-all leading-normal"
              >
                {q}
              </button>
            ))}
          </div>

          {recentQuestions.length > 0 && (
            <>
              <hr className="border-border-theme" />
              <div className="space-y-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                  Recent queries
                </span>
                <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                  {recentQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(null, q)}
                      className="w-full text-left text-[10px] font-semibold text-slate-500 hover:text-primary truncate block"
                    >
                      • {q}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {bookmarkedAnswers.length > 0 && (
            <>
              <hr className="border-border-theme" />
              <div className="space-y-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                  Starred Responses ({bookmarkedAnswers.length})
                </span>
                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                  {bookmarkedAnswers.map((b, idx) => (
                    <div 
                      key={idx}
                      className="p-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-[10px] leading-normal text-slate-655 font-light"
                    >
                      <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                        {b.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>

      </div>

      {/* Floating Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-card border border-border-theme px-5 py-3.5 rounded-2xl shadow-xl z-50 flex items-center space-x-3 text-xs font-bold text-primary transition-all duration-300 transform translate-y-0 opacity-100">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
