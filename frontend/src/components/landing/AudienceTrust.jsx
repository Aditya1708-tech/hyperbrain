import React, { useState } from 'react';
import { Check, Star, BookOpen, School, Target, Award, Compass } from 'lucide-react';

export default function AudienceTrust() {
  const [activeTab, setActiveTab] = useState('students');

  return (
    <section id="audience" className="py-24 px-6 border-b border-border-theme bg-card/10">
      <div className="max-w-5xl mx-auto text-center space-y-6">
        <div className="space-y-3">
          <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400">Audience Focus</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-primary">
            Built For Real Academic Cohesion
          </h2>
          <p className="text-muted text-sm max-w-lg mx-auto font-medium">
            Designed to match the high standards of top-tier universities, competitive schools, and self-directed academic learners.
          </p>
        </div>

        {/* Selection Toggles */}
        <div className="bg-bg-secondary p-1.5 rounded-2xl inline-flex space-x-1 border border-border-theme select-none mt-6">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'students'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
          >
            For Students & Self-Learners
          </button>
          <button
            onClick={() => setActiveTab('colleges')}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'colleges'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
          >
            For Schools & Institutions
          </button>
        </div>

        {/* Dynamic Tab Contents */}
        {activeTab === 'students' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center pt-8 text-left">
            <div className="space-y-6 scroll-reveal-card">
              <div className="space-y-2">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center space-x-1">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span>Smarter Roadmaps</span>
                </span>
                <h3 className="text-xl font-black text-primary tracking-tight">Learn Faster, Save Time</h3>
              </div>
              <p className="text-muted text-xs leading-relaxed font-medium">
                Stop searching for study outlines and lecture guides across scattered folders. HyperBrain maps your university textbook syllabus or specific competitive exam structure into a single workspace.
              </p>
              <ul className="space-y-3.5 text-xs font-medium text-slate-700 dark:text-slate-350">
                <li className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-blue-500" />
                  <span>Extract active recall flashcard decks automatically</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-blue-500" />
                  <span>Query the Socratic AI tutor for instant doubt explanations</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-blue-500" />
                  <span>Generate non-repeating practice questions aligned to your syllabus</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-bg-secondary/50 border border-border-theme rounded-2xl p-6 space-y-4 scroll-reveal-card select-none">
              <span className="text-[10px] font-bold tracking-wider text-blue-500 uppercase">Flashcard deck preview</span>
              <h4 className="text-base font-bold text-primary">Web Technology Core</h4>
              <div className="space-y-3">
                <div className="p-3.5 bg-card rounded-xl border border-border-theme flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-655 dark:text-slate-350">HTML5 Semantic Structure</span>
                  <span className="text-[10px] text-blue-500 font-bold">Review deck</span>
                </div>
                <div className="p-3.5 bg-card rounded-xl border border-border-theme flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-655 dark:text-slate-350">CSS3 Flexbox Grids Layout</span>
                  <span className="text-[10px] text-blue-500 font-bold">Review deck</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center pt-8 text-left animate-fade-in">
            <div className="space-y-6 scroll-reveal-card">
              <div className="space-y-2">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center space-x-1">
                  <School className="w-4 h-4 text-indigo-500" />
                  <span>Administrative Control</span>
                </span>
                <h3 className="text-xl font-black text-primary tracking-tight">Institutional Testing & Integrity</h3>
              </div>
              <p className="text-muted text-xs leading-relaxed font-medium">
                Set mock examinations matching official board schemas, import course arrays directly in student registries, and verify answer feedback keys under strict lockdown browsers.
              </p>
              <ul className="space-y-3.5 text-xs font-medium text-slate-700 dark:text-slate-350">
                <li className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-blue-500" />
                  <span>Enforce focus mode with secure browser lockdown technology</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-blue-500" />
                  <span>Compare student responses against marking schemes automatically</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-blue-500" />
                  <span>Bulk manage syllabus indexes for school departments</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-bg-secondary/50 border border-border-theme rounded-2xl p-6 space-y-4 scroll-reveal-card select-none">
              <span className="text-[10px] font-bold tracking-wider text-blue-500 uppercase">Institutional panel preview</span>
              <h4 className="text-base font-bold text-primary">Active Registries</h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2.5 border-b border-border-theme/40">
                  <span className="font-semibold text-slate-655 dark:text-slate-350">Undergrad Computer Science</span>
                  <span className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 text-[10px] px-2 py-0.5 rounded">Active</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-border-theme/40">
                  <span className="font-semibold text-slate-655 dark:text-slate-350">Advanced Linear Algebra</span>
                  <span className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 text-[10px] px-2 py-0.5 rounded">Active</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="font-semibold text-slate-655 dark:text-slate-350">Introduction to Databases</span>
                  <span className="bg-yellow-100 dark:bg-yellow-950/60 text-yellow-750 dark:text-yellow-450 text-[10px] px-2 py-0.5 rounded">Pending Upload</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
