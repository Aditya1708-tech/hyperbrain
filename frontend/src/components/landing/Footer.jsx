import React from 'react';
import { BrainCircuit } from 'lucide-react';

export default function Footer({ onNavigate, onSetSubPage }) {
  const triggerSubPage = (pageName) => {
    if (onSetSubPage) {
      onSetSubPage(pageName);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-bg-secondary border-t border-border-theme py-16 px-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-left">
        
        {/* Brand block */}
        <div className="space-y-4 md:col-span-1">
          <div 
            onClick={() => {
              if (onSetSubPage) onSetSubPage(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center space-x-2.5 cursor-pointer pl-1 hover:opacity-95 transition-opacity"
          >
            <BrainCircuit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-xl font-bold tracking-tight text-primary">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Hyper</span>
              <span>Brain AI</span>
            </span>
          </div>
          <p className="text-xs text-muted leading-relaxed max-w-xs font-medium">
            Continuous study, grounded tutors, and institutional security structures merged in one system.
          </p>
          <p className="text-[10px] text-muted font-medium">
            © {new Date().getFullYear()} HyperBrain. All rights reserved.
          </p>
        </div>

        {/* Product links */}
        <div>
          <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Product</h5>
          <ul className="space-y-2.5 text-xs text-muted font-medium">
            <li>
              <a 
                href="#features" 
                onClick={(e) => {
                  e.preventDefault();
                  if (onSetSubPage) onSetSubPage(null);
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }} 
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Features
              </a>
            </li>
            <li>
              <a 
                href="#pricing" 
                onClick={(e) => {
                  e.preventDefault();
                  if (onSetSubPage) onSetSubPage(null);
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }} 
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Pricing Matrix
              </a>
            </li>
            <li>
              <a 
                href="#workflow" 
                onClick={(e) => {
                  e.preventDefault();
                  if (onSetSubPage) onSetSubPage(null);
                  document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' });
                }} 
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                How It Works
              </a>
            </li>
            <li>
              <a 
                href="#audience" 
                onClick={(e) => {
                  e.preventDefault();
                  if (onSetSubPage) onSetSubPage(null);
                  document.getElementById('audience')?.scrollIntoView({ behavior: 'smooth' });
                }} 
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Target Audiences
              </a>
            </li>
          </ul>
        </div>

        {/* Resources links */}
        <div>
          <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Resources</h5>
          <ul className="space-y-2.5 text-xs text-muted font-medium">
            <li>
              <a 
                href="#testimonials" 
                onClick={(e) => {
                  e.preventDefault();
                  if (onSetSubPage) onSetSubPage(null);
                  document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' });
                }} 
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Customer Success
              </a>
            </li>
            <li>
              <span className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => triggerSubPage('blog')}>
                Academic Blog
              </span>
            </li>
            <li>
              <span className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => triggerSubPage('faq')}>
                FAQ Helpdesk
              </span>
            </li>
            <li>
              <span className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => triggerSubPage('about')}>
                About Us
              </span>
            </li>
          </ul>
        </div>

        {/* Compliance links */}
        <div>
          <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Compliance</h5>
          <ul className="space-y-2.5 text-xs text-muted font-medium">
            <li>
              <span className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => triggerSubPage('privacy')}>
                Privacy Outline
              </span>
            </li>
            <li>
              <span className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => triggerSubPage('terms')}>
                Terms of Service
              </span>
            </li>
            <li>
              <span className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => triggerSubPage('faq')}>
                FERPA Guidelines
              </span>
            </li>
            <li>
              <span className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => triggerSubPage('contact')}>
                Support Desk
              </span>
            </li>
          </ul>
        </div>

      </div>
    </footer>
  );
}
