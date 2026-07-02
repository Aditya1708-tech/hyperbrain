import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { ThemeContext } from '../../contexts/ThemeContext';
import { Settings, Sun, Moon, Volume2, Bell, RotateCcw, Menu } from 'lucide-react';
import Card from '../../components/common/Card';
import { auth } from '../../services/firebase/firebase';

export default function PreferencesScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // States
  const [audioSpeed, setAudioSpeed] = useState(1.0);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      // Load saved preferences
      const savedSpeed = localStorage.getItem(`audioSpeed_${user.uid}`);
      if (savedSpeed) setAudioSpeed(Number(savedSpeed));
      
      const savedReminders = localStorage.getItem(`reminders_${user.uid}`);
      if (savedReminders) setRemindersEnabled(savedReminders === 'true');
    });
    return () => unsub();
  }, [navigate]);

  const handleAudioSpeedChange = (val) => {
    setAudioSpeed(val);
    const uid = auth.currentUser?.uid;
    if (uid) {
      localStorage.setItem(`audioSpeed_${uid}`, String(val));
    }
  };

  const handleToggleReminders = () => {
    const newVal = !remindersEnabled;
    setRemindersEnabled(newVal);
    const uid = auth.currentUser?.uid;
    if (uid) {
      localStorage.setItem(`reminders_${uid}`, String(newVal));
    }
  };

  const handleResetData = () => {
    if (window.confirm("Are you sure you want to clear your study records? This resets study plans and generated flashcards.")) {
      const uid = auth.currentUser?.uid;
      if (uid) {
        // Clear local storage metrics
        localStorage.removeItem(`fc_${uid}`);
        localStorage.removeItem(`sp_${uid}`);
        // Clear all plan-related keys
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('fc_' + uid) || key.startsWith('sp_' + uid))) {
            localStorage.removeItem(key);
          }
        }
      }
      setToastMessage("Data reset successfully.");
      setTimeout(() => setToastMessage(''), 3000);
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
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-bold tracking-tight font-sans">Settings & Preferences</span>
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
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <div className={`transition-all duration-250 overflow-hidden flex-shrink-0 h-full ${
          isSidebarOpen ? 'w-[280px]' : 'w-0'
        }`}>
          <Sidebar 
            selectedSubjectId={null}
            onSelectSubject={() => {}}
            isCollapsed={!isSidebarOpen}
          />
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-bg-secondary transition-colors duration-300">
          
          <div className="pb-4 border-b border-border-theme">
            <h1 className="text-xl font-bold text-primary tracking-tight">
              System Preferences
            </h1>
            <p className="text-xs text-muted mt-1 font-semibold">
              Adjust study assistance features, auditory settings, themes, and workspace storage limits.
            </p>
          </div>

          <div className="max-w-2xl space-y-6">
            
            {/* Setting 1: Theme selection */}
            <Card className="bg-card border border-border-theme rounded-xl p-6 flex items-center justify-between transition-colors">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primary flex items-center">
                  {theme === 'dark' ? <Moon className="w-4 h-4 mr-2 text-blue-500" /> : <Sun className="w-4 h-4 mr-2 text-yellow-500" />}
                  Theme Mode
                </h3>
                <p className="text-xs text-slate-450 dark:text-slate-500">Toggle dark mode stylesheet theme for focused night studies.</p>
              </div>
              
              <button
                onClick={toggleTheme}
                className="px-4 py-2 bg-bg-secondary hover:bg-slate-200 border border-border-theme text-xs font-bold rounded-xl transition-all"
              >
                Switch to {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </Card>

            {/* Setting 2: Audio playback speed */}
            <Card className="bg-card border border-border-theme rounded-xl p-6 space-y-4 transition-colors">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primary flex items-center">
                  <Volume2 className="w-4 h-4 mr-2 text-blue-600" />
                  AI Voice Explanations
                </h3>
                <p className="text-xs text-slate-455 dark:text-slate-500">Adjust the speech rate of AI explanations inside learning tabs.</p>
              </div>
              
              <div className="space-y-3 pt-2">
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={audioSpeed}
                  onChange={(e) => handleAudioSpeedChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-bold">
                  <span>0.5x (Slow)</span>
                  <span className="text-blue-600 font-black">{audioSpeed}x (Current)</span>
                  <span>2.0x (Fast)</span>
                </div>
              </div>
            </Card>

            {/* Setting 3: Reminder Notification */}
            <Card className="bg-card border border-border-theme rounded-xl p-6 flex items-center justify-between transition-colors">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primary flex items-center">
                  <Bell className="w-4 h-4 mr-2 text-blue-600" />
                  Study Reminders
                </h3>
                <p className="text-xs text-slate-450 dark:text-slate-500">Get automatic visual notifications to maintain your daily study milestones.</p>
              </div>
              
              <button
                onClick={handleToggleReminders}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  remindersEnabled 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-bg-secondary border border-border-theme text-muted'
                }`}
              >
                {remindersEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </Card>

            {/* Setting 4: Reset data */}
            <Card className="bg-card border border-border-theme rounded-xl p-6 flex items-center justify-between border-red-500/10 hover:border-red-500/30 transition-colors">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-red-500 flex items-center">
                  <RotateCcw className="w-4 h-4 mr-2 text-red-500" />
                  Reset Study Records
                </h3>
                <p className="text-xs text-slate-450 dark:text-slate-500">Purge your roadmap schedules and generated flashcard cache.</p>
              </div>
              
              <button
                onClick={handleResetData}
                className="px-4 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 border border-red-200 dark:border-red-900/40 text-red-500 hover:text-red-655 text-xs font-bold rounded-xl transition-all"
              >
                Reset All Records
              </button>
            </Card>

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
