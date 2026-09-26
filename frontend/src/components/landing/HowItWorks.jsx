import React from 'react';
import { UploadCloud, Bot, GraduationCap, ChevronRight } from 'lucide-react';

export default function HowItWorks() {
  return (
    <section id="workflow" className="py-24 px-6 bg-bg-secondary/40 border-b border-border-theme">
      <div className="max-w-7xl mx-auto text-center space-y-4 mb-20">
        <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400">Our System</span>
        <h2 className="text-3xl font-extrabold tracking-tight text-primary">
          How HyperBrain Works
        </h2>
        <p className="text-muted text-sm max-w-md mx-auto font-medium">
          Three simple layers that bridge outlines, studies, and final certifications.
        </p>
      </div>

      <div className="max-w-7xl mx-auto relative px-4">
        {/* Desktop Connected Path Connector (Horizontal Line) */}
        <div className="hidden md:block absolute top-[60px] left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-blue-500/20 -z-10" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
          
          {/* Step 1 */}
          <div className="scroll-reveal-card text-left space-y-4 relative group">
            <div className="relative">
              {/* Step indicator node */}
              <div className="w-14 h-14 bg-card border border-border-theme group-hover:border-blue-500/50 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-lg shadow-sm transition-all duration-300 transform group-hover:scale-105 group-hover:rotate-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <span className="absolute -top-3 -left-3 text-2xl font-black text-blue-500/10 select-none">01</span>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-bold text-primary flex items-center">
                <span>01 — Choose what you're learning</span>
              </h3>
              <p className="text-muted text-xs leading-relaxed font-medium">
                Upload any university syllabus file, custom textbook PDF, chapter outline, or type a list of learning goals.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="scroll-reveal-card text-left space-y-4 relative group">
            <div className="relative">
              <div className="w-14 h-14 bg-card border border-border-theme group-hover:border-blue-500/50 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-lg shadow-sm transition-all duration-300 transform group-hover:scale-105 group-hover:rotate-3">
                <Bot className="w-6 h-6" />
              </div>
              <span className="absolute -top-3 -left-3 text-2xl font-black text-blue-500/10 select-none">02</span>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-bold text-primary flex items-center">
                <span>02 — HyperBrain builds your workspace</span>
              </h3>
              <p className="text-muted text-xs leading-relaxed font-medium">
                Our parsing engine extracts the academic chapters structure and automatically compiles complete notes, flashcards, and quizzes.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="scroll-reveal-card text-left space-y-4 relative group">
            <div className="relative">
              <div className="w-14 h-14 bg-card border border-border-theme group-hover:border-blue-500/50 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-lg shadow-sm transition-all duration-300 transform group-hover:scale-105 group-hover:rotate-3">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="absolute -top-3 -left-3 text-2xl font-black text-blue-500/10 select-none">03</span>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-bold text-primary flex items-center">
                <span>03 — Learn, practice, and improve</span>
              </h3>
              <p className="text-muted text-xs leading-relaxed font-medium">
                Review structured outlines, query the Socratic AI tutor, practice with active recall cards, and monitor progress metrics.
              </p>
            </div>
          </div>

        </div>

        {/* Layered Mini-Mockup Representation of Step 3 (Visual Storytelling) */}
        <div className="mt-20 max-w-2xl mx-auto bg-card/45 border border-border-theme p-4 rounded-3xl relative shadow-md select-none perspective-1000 hidden sm:block">
          <div className="flex items-center justify-between pb-3 border-b border-border-theme/40 text-[9px] font-black text-muted uppercase">
            <span>Dynamic Workspace Generator</span>
            <div className="flex space-x-1.5 items-center bg-blue-500/10 text-blue-500 px-3 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
              <span>Workspace Ready</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-4 text-xs font-semibold" style={{ transformStyle: 'preserve-3d' }}>
            <div className="bg-bg-secondary border border-border-theme p-3 rounded-2xl text-left transform translate-z-[10px] hover:translate-z-[20px] transition-all">
              <span className="text-[9px] uppercase block text-muted mb-1.5">Step 1 File</span>
              <div className="truncate text-[10px] font-bold text-primary">syllabus.pdf</div>
              <div className="text-[8px] text-green-500 mt-1 font-semibold">✓ Parsed 4 Modules</div>
            </div>
            
            <div className="bg-bg-secondary border border-border-theme p-3 rounded-2xl text-left transform translate-z-[20px] hover:translate-z-[30px] transition-all">
              <span className="text-[9px] uppercase block text-muted mb-1.5">Step 2 Compiles</span>
              <div className="truncate text-[10px] font-bold text-primary">Generating AI Notes</div>
              <div className="w-full bg-blue-500/20 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div className="bg-blue-500 h-full w-[80%] rounded-full animate-pulse" />
              </div>
            </div>

            <div className="bg-bg-secondary border border-border-theme p-3 rounded-2xl text-left transform translate-z-[30px] hover:translate-z-[40px] transition-all">
              <span className="text-[9px] uppercase block text-muted mb-1.5">Step 3 Studies</span>
              <div className="truncate text-[10px] font-bold text-blue-500">Grounded Tutor</div>
              <div className="text-[8px] text-muted mt-1 font-normal italic leading-none">"Ready to ask questions..."</div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
