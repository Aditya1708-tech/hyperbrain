import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, FileText, Layers, Award, MessageSquare, CheckCircle } from 'lucide-react';

export default function ProductShowcase() {
  const [activeTab, setActiveTab] = useState('notes');
  const showcaseRef = useRef(null);
  
  const label1Ref = useRef(null);
  const label2Ref = useRef(null);
  const label3Ref = useRef(null);
  const label4Ref = useRef(null);

  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // High-performance Parallax Interpolation Loop
  useEffect(() => {
    let animationFrameId;

    const updateParallax = () => {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        mouse.current.x = 0;
        mouse.current.y = 0;
      } else {
        mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.08;
        mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.08;
      }

      const mx = mouse.current.x;
      const my = mouse.current.y;

      const maxTilt = 5.5; // subtler tilt
      const rx = 4 - my * maxTilt;
      const ry = -4 + mx * maxTilt;

      if (showcaseRef.current) {
        showcaseRef.current.style.transform = `perspective(1500px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1, 1, 1)`;
      }

      // Parallax labels drift
      if (label1Ref.current) {
        label1Ref.current.style.transform = `translate3d(${mx * 20}px, ${my * 20}px, 90px) rotateZ(-3deg)`;
      }
      if (label2Ref.current) {
        label2Ref.current.style.transform = `translate3d(${mx * 15}px, ${my * 15}px, 80px) rotateZ(2deg)`;
      }
      if (label3Ref.current) {
        label3Ref.current.style.transform = `translate3d(${mx * 25}px, ${my * 25}px, 100px) rotateZ(4deg)`;
      }
      if (label4Ref.current) {
        label4Ref.current.style.transform = `translate3d(${mx * 18}px, ${my * 18}px, 75px) rotateZ(-3deg)`;
      }

      animationFrameId = requestAnimationFrame(updateParallax);
    };

    updateParallax();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleMouseMove = (e) => {
    if (!showcaseRef.current) return;
    const box = showcaseRef.current.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2;
    const y = e.clientY - box.top - box.height / 2;

    mouse.current.targetX = x / box.width;
    mouse.current.targetY = y / box.height;
  };

  const handleMouseLeave = () => {
    mouse.current.targetX = 0;
    mouse.current.targetY = 0;
  };

  return (
    <section className="py-24 px-6 border-b border-border-theme relative overflow-hidden bg-radial-gradient">
      {/* Soft background lighting glows */}
      <div className="absolute top-[30%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-[20%] right-[15%] w-[30vw] h-[30vw] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto text-center space-y-4 mb-20">
        <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400">Interactive Tour</span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
          Designed for Maximum Focus
        </h2>
        <p className="text-muted text-sm max-w-xl mx-auto font-medium">
          A clean, distraction-free environment that combines Socratic guidance, revision sheets, and progress analytics.
        </p>
      </div>

      {/* 3D Showcase Container */}
      <div className="max-w-5xl mx-auto relative px-4 select-none perspective-1500">
        
        {/* Floating Labels pointing to features in 3D */}
        <div className="absolute top-[15%] -left-6 z-20 animate-float-slow" style={{ transformStyle: 'preserve-3d' }}>
          <div 
            ref={label1Ref}
            className="bg-card border border-border-theme px-3.5 py-2 rounded-2xl shadow-xl flex items-center space-x-2 transition-all hover:scale-105"
          >
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold text-primary">Smart Notes</span>
          </div>
        </div>

        <div className="absolute top-[52%] -left-8 z-20 animate-float-medium" style={{ transformStyle: 'preserve-3d' }}>
          <div 
            ref={label2Ref}
            className="bg-card border border-border-theme px-3.5 py-2 rounded-2xl shadow-xl flex items-center space-x-2 transition-all hover:scale-105"
          >
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold text-primary">AI Tutor Chatbot</span>
          </div>
        </div>

        <div className="absolute top-[10%] -right-8 z-20 animate-float-fast" style={{ transformStyle: 'preserve-3d' }}>
          <div 
            ref={label3Ref}
            className="bg-card border border-border-theme px-3.5 py-2 rounded-2xl shadow-xl flex items-center space-x-2 transition-all hover:scale-105"
          >
            <Award className="w-4 h-4 text-yellow-500" />
            <span className="text-[10px] font-bold text-primary">Practice Exam</span>
          </div>
        </div>

        <div className="absolute top-[60%] -right-10 z-20 animate-float-slow" style={{ transformStyle: 'preserve-3d' }}>
          <div 
            ref={label4Ref}
            className="bg-card border border-border-theme px-3.5 py-2 rounded-2xl shadow-xl flex items-center space-x-2 transition-all hover:scale-105"
          >
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-bold text-primary">Progress Analytics</span>
          </div>
        </div>

        {/* Dashboard Mockup Card Frame */}
        <div
          ref={showcaseRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full bg-card/65 backdrop-blur-md rounded-3xl border border-border-theme shadow-2xl p-4 transition-all duration-300 transform-gpu cursor-default"
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Subtle soft gradient illumination overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-indigo-500/5 rounded-3xl blur-md pointer-events-none -z-10" />

          {/* Mock OS topbar */}
          <div className="flex items-center justify-between pb-3 border-b border-border-theme/60">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="text-[10px] text-muted font-mono bg-bg-secondary/60 px-3 py-0.5 rounded-full">
              hyperbrain.ai/student/dashboard/ai-semester-5
            </div>
            <div className="w-12" />
          </div>

          <div className="mt-4 grid grid-cols-12 gap-4" style={{ transformStyle: 'preserve-3d' }}>
            
            {/* Sidebar menu representation (translateZ: 10px) */}
            <div 
              className="col-span-3 bg-bg-secondary/40 border border-border-theme/40 p-4 rounded-2xl space-y-4 text-left"
              style={{ transform: 'translateZ(10px)' }}
            >
              <div className="flex items-center space-x-2 font-black text-slate-400 text-[9px] uppercase tracking-wider">
                <LayoutDashboard className="w-3.5 h-3.5 text-blue-500" />
                <span>Workspace</span>
              </div>
              <div className="space-y-1 text-[10px] font-bold text-slate-500">
                <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">Overview</div>
                <div className="p-2 hover:bg-hover-theme rounded-xl">Mock Exams</div>
                <div className="p-2 hover:bg-hover-theme rounded-xl">Flashcards</div>
                <div className="p-2 hover:bg-hover-theme rounded-xl">Study Plan</div>
                <div className="p-2 hover:bg-hover-theme rounded-xl">Progress</div>
              </div>
            </div>

            {/* Main content pane representation (translateZ: 25px) */}
            <div 
              className="col-span-9 bg-card border border-border-theme p-5 rounded-2xl shadow-sm text-left flex flex-col justify-between"
              style={{ transform: 'translateZ(25px)' }}
            >
              {/* Tabs header */}
              <div className="flex space-x-2 pb-3 border-b border-border-theme/40 text-[10px] font-bold text-muted uppercase">
                <span 
                  onClick={() => setActiveTab('notes')}
                  className={`cursor-pointer px-3 py-1 rounded-lg ${activeTab === 'notes' ? 'bg-blue-500/10 text-blue-600 font-extrabold' : 'hover:bg-hover-theme'}`}
                >
                  Notes
                </span>
                <span 
                  onClick={() => setActiveTab('quiz')}
                  className={`cursor-pointer px-3 py-1 rounded-lg ${activeTab === 'quiz' ? 'bg-blue-500/10 text-blue-600 font-extrabold' : 'hover:bg-hover-theme'}`}
                >
                  Quiz
                </span>
                <span 
                  onClick={() => setActiveTab('flashcards')}
                  className={`cursor-pointer px-3 py-1 rounded-lg ${activeTab === 'flashcards' ? 'bg-blue-500/10 text-blue-600 font-extrabold' : 'hover:bg-hover-theme'}`}
                >
                  Flashcards
                </span>
              </div>

              {/* Dynamic tab contents preview */}
              <div className="mt-4 text-xs leading-relaxed text-slate-655 dark:text-slate-350 min-h-[140px]">
                {activeTab === 'notes' && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-primary flex items-center space-x-1.5">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span>Formal Academic Definition: Artificial Intelligence</span>
                    </div>
                    <p className="italic font-normal border-l-2 border-indigo-500/30 pl-3 text-slate-500">
                      "Artificial Intelligence algorithms are computational procedures and sets of rules that enable machines to process data, reason, learn, and solve complex problems autonomously."
                    </p>
                    <p className="text-[11px] font-medium leading-relaxed">
                      This module covers foundational algorithms in Artificial Intelligence, focusing on search strategies, knowledge representation, and machine learning basics for Semester 5 students.
                    </p>
                  </div>
                )}
                {activeTab === 'quiz' && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-primary">Uninformed vs Informed Search Quiz</div>
                    <div className="space-y-2">
                      <div className="p-2 border border-border-theme rounded-xl flex justify-between items-center bg-bg-secondary/40">
                        <span className="font-semibold text-[11px]">1. Which search strategy is complete and optimal if path cost is non-decreasing?</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl font-bold flex items-center justify-between">
                          <span>A. Uniform Cost Search (UCS)</span>
                          <span>✔ Correct</span>
                        </div>
                        <div className="p-2 bg-card border border-border-theme text-muted rounded-xl">B. Depth-First Search (DFS)</div>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'flashcards' && (
                  <div className="space-y-3 flex flex-col justify-center items-center py-4">
                    <div className="bg-bg-secondary/50 border border-border-theme rounded-2xl p-4 text-center max-w-sm w-full space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Flashcard Question</span>
                      <p className="font-bold text-primary text-xs">What is the space complexity of Breadth-First Search (BFS)?</p>
                      <span className="text-[9px] text-blue-500 font-semibold block pt-2">Flip Card to Reveal Answer</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
