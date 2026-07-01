import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import aiService, { askTutor } from "@/services/aiService";
import { analyticsService } from '../../services/firebase/firestoreService';
import { userService } from '../../services/firebase/userService';
import { auth } from '../../services/firebase/firebase';

export default function TutorDrawer({ isOpen, onClose, currentCourse, currentTopic }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Esc key behavior to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const triggerSend = async (text, labelText = null) => {
    if (!text.trim()) return;

    const displayUserText = labelText || text;
    setMessages((prev) => [...prev, { role: 'user', text: displayUserText }]);
    setIsTyping(true);

    const uid = auth.currentUser?.uid;
    if (uid) {
      const check = await userService.checkLimit(uid, 'ai_tutor');
      if (!check.allowed) {
        const resetTime = userService.getTimeUntilMidnight().formatted;
        setMessages((prev) => [...prev, { role: 'ai', text: `You have reached today's beta limit. Reset in: ${resetTime}` }]);
        setIsTyping(false);
        return;
      }
    }

    try {
      const courseName = currentCourse ? (currentCourse.subject_name || currentCourse.name) : "General Context";
      const topicName = currentTopic ? (currentTopic.title || currentTopic.name) : "General Concept";
      const context = `Course: ${courseName}, Topic: ${topicName}`;
      
      const startTime = Date.now();
      const response = await askTutor(text, context);
      const latencyMs = Date.now() - startTime;

      analyticsService.logAiSession(courseName, topicName, 'chat_tutor', latencyMs, 950, true);

      setMessages((prev) => [...prev, { role: 'ai', text: response }]);
      if (uid) {
        await userService.incrementUsage(uid, 'ai_tutor');
      }
    } catch (err) {
      console.error(err);
      const courseName = currentCourse ? (currentCourse.subject_name || currentCourse.name) : "General Context";
      const topicName = currentTopic ? (currentTopic.title || currentTopic.name) : "General Concept";
      analyticsService.logAiSession(courseName, topicName, 'chat_tutor', 0, 0, false, err.message);

      setMessages((prev) => [...prev, { role: 'ai', text: "Error: Could not connect to AI Tutor." }]);
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

  const handleQuickAction = (actionType) => {
    if (!currentTopic) {
      triggerSend(`Perform ${actionType} on current context.`);
      return;
    }
    
    let text = "";
    let label = "";
    
    switch (actionType) {
      case 'simpler':
        text = `Explain the concept of "${currentTopic.title}" in simpler terms.`;
        label = "Explain simpler";
        break;
      case 'examples':
        text = `Provide concrete, real-world examples for the topic "${currentTopic.title}".`;
        label = "Give examples";
        break;
      case 'quiz':
        text = `Generate a short multiple choice quiz question for "${currentTopic.title}".`;
        label = "Generate quiz";
        break;
      case 'summarize':
        text = `Provide a quick summary of "${currentTopic.title}".`;
        label = "Summarize";
        break;
      default:
        return;
    }
    triggerSend(text, label);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
          />

          {/* Drawer panel */}
          <motion.div
            initial={isMobile ? { y: '100%', x: 0, opacity: 0.5 } : { x: '100%', y: 0, opacity: 0.5 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={isMobile ? { y: '100%', x: 0, opacity: 0.5 } : { x: '100%', y: 0, opacity: 0.5 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-0 sm:top-0 right-0 h-[85vh] sm:h-full w-full sm:w-[380px] bg-card rounded-t-2xl sm:rounded-none shadow-2xl border-t sm:border-t-0 sm:border-l border-border-theme z-50 flex flex-col overflow-hidden"
          >
            
            {/* Header */}
            <div className="p-4 border-b border-border-theme flex items-center justify-between flex-shrink-0 bg-bg-secondary/60">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest leading-none">
                    AI Tutor
                  </h3>
                  <div className="text-[10px] text-slate-455 mt-1 font-semibold leading-tight">
                    {currentCourse ? (
                      <span>
                        Course: {currentCourse.subject_name}
                        {currentTopic && ` • Topic: ${currentTopic.title}`}
                      </span>
                    ) : (
                      <span>General AI Chat Assistance</span>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-655"
                title="Close AI Tutor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-card">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto space-y-5">
                  <div className="p-3 bg-bg-secondary rounded-full">
                    <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Tutor active and waiting</h4>
                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                      Ask any questions related to the active course syllabus. Quick helpers are available below.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl text-[11px] font-semibold leading-relaxed shadow-xs ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-bg-secondary text-slate-800 dark:text-slate-200 border border-border-theme rounded-bl-none'
                      }`}>
                        {msg.text}
                      </div>
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
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Footer */}
            <div className="px-4 py-2 bg-bg-secondary border-t border-slate-200/50 dark:border-slate-800/50 flex flex-wrap gap-1.5 flex-shrink-0">
              <button
                onClick={() => handleQuickAction('summarize')}
                className="px-2.5 py-1.5 bg-card hover:bg-slate-100 border border-border-theme text-[9px] font-bold text-slate-600 dark:text-slate-300 rounded-lg transition-all"
              >
                Summarize
              </button>
              <button
                onClick={() => handleQuickAction('simpler')}
                className="px-2.5 py-1.5 bg-card hover:bg-slate-100 border border-border-theme text-[9px] font-bold text-slate-600 dark:text-slate-300 rounded-lg transition-all"
              >
                Explain simpler
              </button>
              <button
                onClick={() => handleQuickAction('quiz')}
                className="px-2.5 py-1.5 bg-card hover:bg-slate-100 border border-border-theme text-[9px] font-bold text-slate-600 dark:text-slate-300 rounded-lg transition-all"
              >
                Generate quiz
              </button>
              <button
                onClick={() => handleQuickAction('examples')}
                className="px-2.5 py-1.5 bg-card hover:bg-slate-100 border border-border-theme text-[9px] font-bold text-slate-600 dark:text-slate-300 rounded-lg transition-all"
              >
                Give examples
              </button>
            </div>

            {/* Message Input Form */}
            <form onSubmit={handleSend} className="p-3 bg-card border-t border-border-theme flex items-center space-x-2 flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                required
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask AI Tutor..."
                className="flex-1 bg-bg-secondary text-primary text-xs px-3.5 py-2.5 rounded-xl border border-border-theme focus-ring"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="p-2.5 bg-blue-600 hover:bg-blue-750 text-white rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
