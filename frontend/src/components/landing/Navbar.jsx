import React, { useState, useEffect } from 'react';
import { BrainCircuit, Sun, Moon } from 'lucide-react';

export default function Navbar({ 
  theme, 
  toggleTheme, 
  onNavigate, 
  onSetSubPage, 
  enableThemeToggle = true 
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-border-theme transition-all duration-300 ${
      scrolled 
        ? 'py-3 bg-card/90 backdrop-blur-lg shadow-sm' 
        : 'py-5 bg-card/75 backdrop-blur-md'
    }`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => {
            onSetSubPage(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center space-x-2.5 cursor-pointer hover:opacity-95 transition-opacity"
        >
          <BrainCircuit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <div className="flex flex-col text-left">
            <span className="text-xl font-bold tracking-tight leading-none">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Hyper</span>
              <span className="text-primary">Brain AI</span>
            </span>
            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-wider text-muted mt-0.5 leading-none">
              AI-Powered Academic Intelligence
            </span>
          </div>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-muted">
          <a 
            href="#features" 
            onClick={(e) => {
              e.preventDefault();
              onSetSubPage(null);
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }} 
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Features
          </a>
          <a 
            href="#workflow" 
            onClick={(e) => {
              e.preventDefault();
              onSetSubPage(null);
              document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' });
            }} 
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            How It Works
          </a>
          <a 
            href="#audience" 
            onClick={(e) => {
              e.preventDefault();
              onSetSubPage(null);
              document.getElementById('audience')?.scrollIntoView({ behavior: 'smooth' });
            }} 
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            AI Learning
          </a>
          <a 
            href="#pricing" 
            onClick={(e) => {
              e.preventDefault();
              onSetSubPage(null);
              document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
            }} 
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Pricing
          </a>
        </div>

        {/* Right side CTAs */}
        <div className="flex items-center space-x-4">
          {enableThemeToggle && (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-2xl hover:bg-hover-theme text-muted transition-all focus-ring"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-slate-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
          )}
          
          <button
            onClick={() => onNavigate('/login')}
            className="hidden sm:inline text-sm font-semibold text-primary hover:text-black dark:hover:text-white px-4 py-2 transition-colors hover:bg-white/5 rounded-xl"
          >
            Log In
          </button>
          
          <button
            onClick={() => onNavigate('/login')}
            className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold px-5 py-2.5 rounded-2xl transition-all shadow-sm focus-ring"
          >
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}
