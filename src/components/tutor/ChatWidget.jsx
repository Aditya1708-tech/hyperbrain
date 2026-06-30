import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import aiService from "@/services/aiService";

export default function ChatWidget() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const triggerSend = async (text) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsTyping(true);

    try {
      const now = new Date().toLocaleString();
      const hiddenPrompt = `Current System Time: ${now}. User Question: ${text}`;
      const response = await aiService.generateTutorResponse(hiddenPrompt);
      setMessages((prev) => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: 'ai', text: "Error: Could not connect to Brain." }]);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="w-full h-full bg-card border-l border-border-theme flex flex-col transition-colors duration-300 flex-shrink-0 z-10">
      
      {/* Header */}
      <div className="p-4 border-b border-border-theme flex items-center space-x-2 transition-colors duration-300">
        <Sparkles className="w-5 h-5 text-muted" />
        <span className="font-bold text-primary text-sm transition-colors duration-300">AI Tutor</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-6 space-y-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3 animate-pulse" />
              <p className="text-muted text-xs font-bold uppercase tracking-wider transition-colors duration-300">
                AI Syllabus Tutor
              </p>
              <p className="text-[11px] text-muted mt-1.5 font-semibold leading-relaxed transition-colors duration-300">
                Ask a custom question or select one of the prompts below to initiate learning.
              </p>
            </div>
            
            <div className="w-full space-y-2.5">
              {[
                "Summarize notes for this topic",
                "Explain the primary technical formula",
                "Generate 5 mock multiple choice queries"
              ].map((promptText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => triggerSend(promptText)}
                  className="w-full text-left p-3 bg-bg-secondary border border-border-theme hover:border-blue-500/50 hover:bg-card rounded-2xl text-[11px] font-semibold text-muted transition-all active:scale-[0.99] cursor-pointer"
                >
                  {promptText}
                </button>
              ))}
            </div>

            {/* Continue Learning shortcuts */}
            <div className="w-full pt-4 border-t border-border-theme space-y-2 transition-colors duration-300">
              <span className="text-[9px] font-black text-muted uppercase tracking-widest block text-left transition-colors duration-300">Continue Learning</span>
              <div className="p-3 bg-blue-600/10 border border-blue-600/20 rounded-2xl text-left space-y-1">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Curriculum Target: 70% Done</span>
                <p className="text-[10px] text-muted font-semibold leading-relaxed transition-colors duration-300">
                  Continue studying custom mock quiz questions to optimize memory retention.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={i}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs leading-relaxed transition-colors duration-300 ${
                  isUser
                    ? 'bg-h-primary text-h-bg rounded-br-none'
                    : 'bg-bg-secondary text-primary border border-border-theme rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-bg-secondary text-muted px-4 py-3 rounded-2xl flex items-center space-x-1.5 text-xs transition-colors duration-300">
              <Loader2 className="h-3 w-3 animate-spin text-muted" />
              <span>AI is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-border-theme flex items-center space-x-2 bg-card transition-colors duration-300">
          <input
            type="text"
            required
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask AI Tutor..."
            className="flex-1 bg-bg-secondary text-primary text-xs px-3.5 py-2.5 rounded-2xl border border-border-theme focus-ring placeholder-h-secondary transition-colors duration-300"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white disabled:bg-bg-secondary disabled:text-muted rounded-2xl transition-all shadow-sm focus-ring"
          >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
