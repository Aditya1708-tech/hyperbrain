import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import aiService from "@/services/aiService";
import Sidebar from '../../components/layout/Sidebar';
import { ThemeContext } from '../../contexts/ThemeContext';
import { Sparkles, Send, Loader2, MessageSquare, BookOpen, Menu, Sun, Moon } from 'lucide-react';
import Card from '../../components/common/Card';
import { userService } from '../../services/firebase/userService';

export default function TutorScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (window.innerWidth < 768) return false;
    return localStorage.getItem('sidebar_state') !== 'collapsed';
  });
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar_state', isSidebarOpen ? 'expanded' : 'collapsed');
  }, [isSidebarOpen]);

  // Close mobile sidebar on navigate
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  // Persist messages for the current course
  useEffect(() => {
    if (selectedCourse && messages.length > 0) {
      localStorage.setItem(`tutor_session_messages_${selectedCourse.id}`, JSON.stringify(messages));
    }
  }, [messages, selectedCourse]);

  // Load persisted messages when selected course changes
  useEffect(() => {
    if (selectedCourse) {
      const stored = localStorage.getItem(`tutor_session_messages_${selectedCourse.id}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        setMessages([]);
      }
    }
  }, [selectedCourse]);

  // Load courses & restore selections
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

  const handleClearChat = () => {
    setMessages([]);
    if (selectedCourse) {
      localStorage.removeItem(`tutor_session_messages_${selectedCourse.id}`);
    }
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    localStorage.setItem('current_course_id', course.id);
    if (course.topics && course.topics.length > 0) {
      setSelectedTopic(course.topics[0]);
      localStorage.setItem('current_topic_title', course.topics[0].title);
    } else {
      setSelectedTopic(null);
      localStorage.removeItem('current_topic_title');
    }
  };

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    localStorage.setItem('current_topic_title', topic.title);
  };

  const triggerSend = async (text, labelText = null) => {
    if (!text.trim()) return;
    
    // Display user message in chat
    const displayUserText = labelText || text;
    setMessages(prev => [...prev, { role: 'user', text: displayUserText }]);
    setIsTyping(true);

    const uid = auth.currentUser?.uid;
    if (uid) {
      const check = await userService.checkLimit(uid, 'ai_tutor');
      if (!check.allowed) {
        const resetTime = userService.getTimeUntilMidnight().formatted;
        setMessages(prev => [...prev, { role: 'ai', text: `You have reached today's beta limit. Reset in: ${resetTime}` }]);
        setIsTyping(false);
        return;
      }
    }

    try {
      // Inject context
      const courseName = selectedCourse ? selectedCourse.subject_name : "General";
      const topicName = selectedTopic ? selectedTopic.title : "General Concept";
      const contextPrompt = `Context: Course=${courseName} Topic=${topicName}. Respond strictly based on this curriculum concept. Question: ${text}`;
      
      const response = await aiService.generateTutorResponse(contextPrompt);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
      if (uid) {
        await userService.incrementUsage(uid, 'ai_tutor');
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'ai', text: "Error: Could not connect to AI Tutor." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const txt = inputValue;
    setInputValue('');
    await triggerSend(txt);
  };

  const handleSuggestedAction = (actionType) => {
    if (!selectedTopic) return;
    
    let text = "";
    let label = "";
    
    switch (actionType) {
      case 'simpler':
        text = `Explain the concept of "${selectedTopic.title}" in simpler terms for a beginner.`;
        label = "Explain simpler";
        break;
      case 'examples':
        text = `Provide 3 concrete, real-world examples illustrating the concept of "${selectedTopic.title}".`;
        label = "Give examples";
        break;
      case 'quiz':
        text = `Generate a 3-question multiple choice quiz on the topic "${selectedTopic.title}" with correct answers.`;
        label = "Generate quiz";
        break;
      case 'summarize':
        text = `Provide a concise bullet-point summary of the core principles of "${selectedTopic.title}".`;
        label = "Summarize";
        break;
      default:
        return;
    }
    triggerSend(text, label);
  };

  return (
    <div className="h-screen w-screen bg-bg-secondary text-primary flex flex-col overflow-hidden transition-colors duration-300">
      
      {/* APP HEADER */}
      <header className="h-16 border-b border-border-theme bg-card flex items-center justify-between px-6 flex-shrink-0 z-10 transition-colors">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-hover-theme rounded-lg text-muted"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2.5">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-bold tracking-tight font-sans">AI Tutor Workspace</span>
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
              handleSelectCourse(course);
            }}
            isCollapsed={!isSidebarOpen}
          />
        </div>

        {/* WORKSPACE CONTENT (Split into left Selector Panel and center Chat Area) */}
        <div className="flex-1 flex overflow-hidden bg-bg-secondary">
          
          {/* LEFT: Selector Panel */}
          <div className="w-64 border-r border-border-theme bg-card flex flex-col flex-shrink-0 hidden md:flex">
            <div className="p-4 border-b border-border-theme">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2">Select Course</span>
              <select
                value={selectedCourse?.id || ''}
                onChange={(e) => {
                  const course = courses.find(c => c.id === e.target.value);
                  if (course) handleSelectCourse(course);
                }}
                className="w-full px-3 py-2 bg-bg-secondary border border-border-theme rounded-xl text-xs font-semibold focus-ring"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.subject_name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2">Select Topic</span>
              {selectedCourse?.topics?.map((topic, idx) => {
                const isSelected = selectedTopic?.title === topic.title;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectTopic(topic)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isSelected 
                        ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 font-bold' 
                        : 'text-muted hover:bg-hover-theme'
                    }`}
                  >
                    {topic.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER: Main Chat Interface */}
          <div className="flex-1 flex flex-col h-full bg-bg-secondary">
            
            {/* Top Context Badge */}
            <div className="px-6 py-3.5 bg-card border-b border-border-theme flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <div className="text-xs font-semibold text-muted">
                  Currently Studying:{' '}
                  <strong className="text-slate-800 dark:text-slate-200 font-bold">
                    {selectedCourse ? selectedCourse.subject_name : 'No Course Selected'}
                  </strong>
                  {selectedTopic && (
                    <>
                      {' '}• Topic:{' '}
                      <span className="text-blue-600 dark:text-blue-400 font-bold">
                        {selectedTopic.title}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Messages Panel */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                  <div className="p-4 bg-card border border-border-theme rounded-full shadow-sm">
                    <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-base font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">AI Tutor Workspace</h2>
                    <p className="text-xs text-muted font-semibold leading-relaxed">
                      Ask context-specific queries for the selected syllabus concept. The AI Tutor is bounded to respond only using your course topics.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                      <div className={`max-w-[75%] p-4 rounded-2xl text-xs font-semibold leading-relaxed shadow-xs transition-colors ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-card text-primary border border-border-theme rounded-bl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}

              {isTyping && (
                <div className="flex justify-start animate-pulse">
                  <div className="bg-card border border-border-theme p-4 rounded-2xl rounded-bl-none flex items-center space-x-2 text-xs font-bold text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggested actions quick-click */}
            {selectedTopic && (
              <div className="px-6 py-2.5 bg-bg-secondary border-t border-slate-200/50 dark:border-slate-800/50 flex flex-wrap gap-2 flex-shrink-0">
                <button
                  onClick={() => handleSuggestedAction('simpler')}
                  className="px-3.5 py-1.5 bg-card hover:bg-hover-theme border border-border-theme text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded-xl transition-all shadow-xs"
                >
                  Explain simpler
                </button>
                <button
                  onClick={() => handleSuggestedAction('examples')}
                  className="px-3.5 py-1.5 bg-card hover:bg-hover-theme border border-border-theme text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded-xl transition-all shadow-xs"
                >
                  Give examples
                </button>
                <button
                  onClick={() => handleSuggestedAction('quiz')}
                  className="px-3.5 py-1.5 bg-card hover:bg-hover-theme border border-border-theme text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded-xl transition-all shadow-xs"
                >
                  Generate quiz
                </button>
                <button
                  onClick={() => handleSuggestedAction('summarize')}
                  className="px-3.5 py-1.5 bg-card hover:bg-hover-theme border border-border-theme text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded-xl transition-all shadow-xs"
                >
                  Summarize
                </button>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-4 bg-card border-t border-border-theme flex items-center space-x-2 flex-shrink-0">
              <input
                type="text"
                required
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask AI Tutor context question..."
                className="flex-1 bg-bg-secondary text-primary text-xs px-4 py-3 rounded-xl border border-border-theme focus-ring"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="p-3 bg-blue-600 hover:bg-blue-750 text-white rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>

        </div>

      </div>

    </div>
  );
}
