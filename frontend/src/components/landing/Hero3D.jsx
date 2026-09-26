import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Sparkles, MessageSquare, Layers, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Hero3D({ onStart, onExplore }) {
  const canvasRef = useRef(null);
  const workspaceRef = useRef(null);
  const canvasContainerRef = useRef(null);
  
  const card1Ref = useRef(null);
  const card2Ref = useRef(null);
  const card3Ref = useRef(null);
  const card4Ref = useRef(null);
  const card5Ref = useRef(null);

  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const [activeMockTab, setActiveMockTab] = useState('notes');

  // Interactive 3D Brain Canvas Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let width = canvas.width = 380;
    let height = canvas.height = 380;

    const points = [];
    const numPoints = 75;
    for (let i = 0; i < numPoints; i++) {
      const isLeft = Math.random() > 0.5;
      const hemiOffset = isLeft ? -25 : 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      const rx = 75 * Math.sin(phi) * Math.cos(theta) + hemiOffset;
      const ry = 60 * Math.sin(phi) * Math.sin(theta);
      const rz = 60 * Math.cos(phi);
      
      points.push({
        x: rx,
        y: ry,
        z: rz,
        ox: rx,
        oy: ry,
        oz: rz,
        color: isLeft ? '#3B82F6' : '#6366F1'
      });
    }

    let angleX = 0.002;
    let angleY = 0.003;

    const rotateX = (point, rad) => {
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const y = point.y * cos - point.z * sin;
      const z = point.y * sin + point.z * cos;
      point.y = y;
      point.z = z;
    };

    const rotateY = (point, rad) => {
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const x = point.x * cos - point.z * sin;
      const z = point.x * sin + point.z * cos;
      point.x = x;
      point.z = z;
    };

    const renderCanvas = () => {
      ctx.clearRect(0, 0, width, height);

      const mx = mouse.current.x;
      const my = mouse.current.y;

      const projected = points.map(p => {
        const temp = { ...p };
        rotateY(temp, angleY);
        rotateX(temp, angleX);
        
        // Add subtle mouse rotation offsets
        rotateY(temp, mx * 0.22);
        rotateX(temp, my * 0.22);

        const distance = 250;
        const scale = distance / (distance + temp.z);
        const projX = temp.x * scale + width / 2;
        const projY = temp.y * scale + height / 2;

        return {
          x: projX,
          y: projY,
          scale: scale,
          color: p.color,
          z: temp.z
        };
      });

      // Connections
      ctx.lineWidth = 0.5;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 50) {
            const opacity = (1 - dist / 50) * 0.1;
            ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      // Nodes
      projected.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const radius = Math.max(0.6, p.scale * 1.8);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      angleY += 0.001;
      angleX += 0.0005;

      animationFrameId = requestAnimationFrame(renderCanvas);
    };

    renderCanvas();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // High-performance Parallax Interpolation Loop (No React re-renders)
  useEffect(() => {
    let animationFrameId;

    const updateParallax = () => {
      const isMobile = window.innerWidth < 768;
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        // static state
        mouse.current.x = 0;
        mouse.current.y = 0;
      } else {
        // interpolate target values smoothly
        mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.075;
        mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.075;
      }

      const mx = mouse.current.x;
      const my = mouse.current.y;

      // Apply tilt limits
      const maxTilt = isMobile ? 1.5 : 8.5;
      const rx = -my * maxTilt;
      const ry = mx * maxTilt;

      // Workspace Tilt
      if (workspaceRef.current) {
        workspaceRef.current.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0px)`;
      }

      // Canvas Drift (Slightly slower)
      if (canvasContainerRef.current) {
        const drift = isMobile ? 0 : -15;
        canvasContainerRef.current.style.transform = `translate3d(${mx * drift}px, ${my * drift}px, -45px)`;
      }

      // Floating Cards (Staggered speeds/parallax indices)
      const speedMultiplier = isMobile ? 0.15 : 1.0;
      
      if (card1Ref.current) {
        card1Ref.current.style.transform = `translate3d(${mx * 25 * speedMultiplier}px, ${my * 25 * speedMultiplier}px, 60px) rotateZ(-3deg)`;
      }
      if (card2Ref.current) {
        card2Ref.current.style.transform = `translate3d(${mx * 18 * speedMultiplier}px, ${my * 18 * speedMultiplier}px, 50px) rotateZ(4deg)`;
      }
      if (card3Ref.current) {
        card3Ref.current.style.transform = `translate3d(${mx * 32 * speedMultiplier}px, ${my * 32 * speedMultiplier}px, 75px) rotateZ(5deg)`;
      }
      if (card4Ref.current) {
        card4Ref.current.style.transform = `translate3d(${mx * 22 * speedMultiplier}px, ${my * 22 * speedMultiplier}px, 55px) rotateZ(-4deg)`;
      }
      if (card5Ref.current) {
        card5Ref.current.style.transform = `translate3d(${mx * 28 * speedMultiplier}px, ${my * 28 * speedMultiplier}px, 80px) rotateZ(2deg) translateY(-50%)`;
      }

      animationFrameId = requestAnimationFrame(updateParallax);
    };

    updateParallax();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // GSAP ScrollTrigger for story transition
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    if (workspaceRef.current) {
      gsap.to(workspaceRef.current, {
        y: 120,
        scale: 0.92,
        opacity: 0.6,
        rotateX: 12,
        scrollTrigger: {
          trigger: workspaceRef.current,
          start: "top 20%",
          end: "bottom top",
          scrub: 1
        }
      });
    }
  }, []);

  const handleMouseMove = (e) => {
    if (!workspaceRef.current) return;
    const box = workspaceRef.current.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2;
    const y = e.clientY - box.top - box.height / 2;

    mouse.current.targetX = x / box.width;
    mouse.current.targetY = y / box.height;
  };

  const handleMouseLeave = () => {
    mouse.current.targetX = 0;
    mouse.current.targetY = 0;
  };

  // Mock Tab Rotation
  useEffect(() => {
    const tabs = ['notes', 'flashcards', 'quiz', 'tutor'];
    const interval = setInterval(() => {
      setActiveMockTab(prev => {
        const nextIdx = (tabs.indexOf(prev) + 1) % tabs.length;
        return tabs[nextIdx];
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden pt-36 pb-28 px-6 lg:px-8 border-b border-border-theme bg-radial-gradient"
    >
      {/* Background Soft Lighting Radial Glows (Layer 1) */}
      <div className="absolute top-[20%] right-[15%] w-[35vw] h-[35vw] rounded-full bg-blue-600/10 dark:bg-blue-500/5 blur-[120px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-[10%] left-[10%] w-[35vw] h-[35vw] rounded-full bg-indigo-600/5 dark:bg-indigo-500/5 blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        
        {/* Left Column: Hero Content with Framer Motion Entrance */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="lg:col-span-6 space-y-8 text-left z-10"
        >
          <div className="inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-955/40 border border-blue-100 dark:border-blue-900/60 px-4 py-1.5 rounded-full text-xs font-semibold text-blue-750 dark:text-blue-300 shadow-xs">
            <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
            <span>Next-Gen Study & Assessment Platform</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter text-primary leading-tight">
              Your AI-Powered <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Learning Workspace
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted leading-relaxed max-w-xl font-medium">
              HyperBrain transforms any syllabus, textbook, or learning goal into an intelligent academic workspace. Instantly generate detailed notes, active recall flashcards, custom quizzes, and practice exams with grounded AI tutoring.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <button
              onClick={onStart}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:scale-[0.98] hover:-translate-y-0.5 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 flex items-center justify-center space-x-2 focus-ring"
            >
              <span>Start Learning Free</span>
              <ArrowRight className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={onExplore}
              className="w-full sm:w-auto flex items-center justify-center border border-border-theme text-primary hover:bg-hover-theme/60 active:scale-[0.98] hover:-translate-y-0.5 font-semibold px-8 py-4 rounded-2xl text-base transition-all"
            >
              <span>Explore HyperBrain</span>
            </button>
          </div>
        </motion.div>

        {/* Right Column: Redesigned 3D Workspace */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
          className="lg:col-span-6 relative flex items-center justify-center perspective-1500 py-8 lg:py-0"
        >
          
          {/* Synapse Canvas Layer (Layer 1 Atmosphere) */}
          <div 
            ref={canvasContainerRef}
            className="absolute pointer-events-none -z-20 opacity-35 dark:opacity-55 transition-transform duration-300 ease-out"
          >
            <canvas ref={canvasRef} className="w-[380px] h-[380px]" />
          </div>

          {/* Master 3D Workspace Container (Layer 2 Workspace) */}
          <div 
            ref={workspaceRef}
            className="relative w-full max-w-[480px] bg-card/70 backdrop-blur-lg p-4 rounded-3xl border border-white/10 dark:border-white/5 shadow-2xl transition-all duration-300 transform-gpu"
            style={{
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Subtle soft gradient illumination overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-indigo-500/5 rounded-3xl blur-md pointer-events-none -z-10" />

            {/* Mock OS Frame Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-theme/60 select-none">
              <div className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
              </div>
              <div className="text-[10px] text-muted font-mono bg-bg-secondary/65 px-3 py-0.5 rounded-full">
                hyperbrain.ai/workspace/ai-semester-5
              </div>
              <div className="w-10" />
            </div>

            {/* Core Panels Wrapper (Layer 3 Floating UI Panels) */}
            <div className="mt-4 grid grid-cols-12 gap-4 relative" style={{ transformStyle: 'preserve-3d' }}>
              
              {/* Left Column: Syllabus Outline Panel (translateZ: 15px) */}
              <div 
                className="col-span-4 bg-bg-secondary/40 border border-border-theme/55 p-3 rounded-2xl text-left space-y-2.5 shadow-2xs"
                style={{ transform: 'translateZ(15px)', transformStyle: 'preserve-3d' }}
              >
                <div className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Syllabus Outline</div>
                <div className="space-y-1.5 text-[10px] font-semibold text-muted">
                  <div className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-between font-bold">
                    <span className="truncate">1. AI Algorithms</span>
                    <span className="text-[8px] bg-blue-500 text-white px-1 rounded font-bold">Active</span>
                  </div>
                  <div className="p-1.5 hover:bg-hover-theme rounded-lg truncate">2. Heuristic Search</div>
                  <div className="p-1.5 hover:bg-hover-theme rounded-lg truncate">3. Neural Networks</div>
                  <div className="p-1.5 hover:bg-hover-theme rounded-lg truncate">4. Decision Trees</div>
                </div>
              </div>

              {/* Right Column: Study Material Window (translateZ: 35px) */}
              <div 
                className="col-span-8 bg-card border border-border-theme/80 p-4 rounded-2xl shadow-lg text-left relative min-h-[160px] flex flex-col justify-between"
                style={{ transform: 'translateZ(35px)', transformStyle: 'preserve-3d' }}
              >
                <div>
                  <div className="flex space-x-1.5 pb-2 border-b border-border-theme/40 text-[9px] font-bold text-muted uppercase">
                    <span className={activeMockTab === 'notes' ? 'text-blue-500 font-extrabold' : ''}>Notes</span>
                    <span>•</span>
                    <span className={activeMockTab === 'flashcards' ? 'text-blue-500 font-extrabold' : ''}>Flashcards</span>
                    <span>•</span>
                    <span className={activeMockTab === 'quiz' ? 'text-blue-500 font-extrabold' : ''}>Quiz</span>
                    <span>•</span>
                    <span className={activeMockTab === 'tutor' ? 'text-blue-500 font-extrabold' : ''}>Tutor</span>
                  </div>

                  {/* Tab views transitions */}
                  <div className="mt-3 text-xs leading-relaxed text-slate-655 dark:text-slate-350 min-h-[90px]">
                    {activeMockTab === 'notes' && (
                      <div className="space-y-1.5 animate-fade-in">
                        <div className="text-[10px] font-extrabold text-primary flex items-center space-x-1">
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          <span>Uninformed Search Notes</span>
                        </div>
                        <p className="text-[10px] leading-relaxed">
                          Uninformed search (blind search) explores search space without domain-specific knowledge, relying entirely on queue paths like Breadth-First Search (BFS) and Depth-First Search (DFS).
                        </p>
                      </div>
                    )}
                    {activeMockTab === 'flashcards' && (
                      <div className="space-y-2 animate-fade-in flex flex-col justify-center items-center py-2">
                        <div className="bg-bg-secondary border border-border-theme rounded-xl p-3 w-full text-center text-[10px] font-bold">
                          <span>Q: What is A* heuristic search?</span>
                          <span className="text-[8px] text-blue-500 block mt-1 font-semibold">Click to Flip</span>
                        </div>
                      </div>
                    )}
                    {activeMockTab === 'quiz' && (
                      <div className="space-y-2 animate-fade-in">
                        <div className="text-[10px] font-bold">1. BFS guarantees optimal solutions if:</div>
                        <div className="space-y-1 text-[9px]">
                          <div className="p-1 bg-green-500/10 border border-green-500/20 text-green-600 rounded flex items-center justify-between font-bold">
                            <span>A. Path costs are uniform</span>
                            <span>✔ Correct</span>
                          </div>
                          <div className="p-1 bg-bg-secondary rounded">B. Space is infinite</div>
                        </div>
                      </div>
                    )}
                    {activeMockTab === 'tutor' && (
                      <div className="space-y-1.5 animate-fade-in">
                        <div className="bg-blue-600 text-white p-2 rounded-xl rounded-br-none text-[9px] max-w-[90%] ml-auto text-right font-medium">
                          Can you explain PEAS for self driving cars?
                        </div>
                        <div className="bg-bg-secondary text-primary border border-border-theme p-2 rounded-xl rounded-bl-none text-[9px] max-w-[90%] flex items-start space-x-1.5">
                          <MessageSquare className="w-3 h-3 text-indigo-500 flex-shrink-0 mt-0.5" />
                          <span className="leading-snug">Performance: Safety, speed. Environment: Roads. Actuators: Steering. Sensors: Cameras.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Layer 4: Small Information Cards (Staggered floating animations + JS Mouse Parallax) */}
            
            {/* Card 1: AI Notes Generated (top-left) */}
            <div className="absolute -top-6 -left-8 animate-float-slow" style={{ transformStyle: 'preserve-3d' }}>
              <div 
                ref={card1Ref} 
                className="bg-card/95 border border-white/10 dark:border-white/5 py-2 px-3 rounded-xl shadow-lg flex items-center space-x-2 select-none font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[9px] font-extrabold text-primary">AI Notes Generated</span>
              </div>
            </div>

            {/* Card 2: 72% Progress (bottom-left) */}
            <div className="absolute -bottom-6 -left-6 animate-float-medium" style={{ transformStyle: 'preserve-3d' }}>
              <div 
                ref={card2Ref} 
                className="bg-card/90 border border-white/10 dark:border-white/5 p-2.5 rounded-xl shadow-lg text-left select-none space-y-0.5 font-semibold"
              >
                <span className="text-[7.5px] uppercase font-bold text-slate-400">Workspace Progress</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-[10px] font-black text-blue-500">72% Completed</span>
                  <span className="text-[7px] text-green-500 font-semibold">+8.4%</span>
                </div>
              </div>
            </div>

            {/* Card 3: 12 Flashcards (top-right) */}
            <div className="absolute -top-8 -right-6 animate-float-fast" style={{ transformStyle: 'preserve-3d' }}>
              <div 
                ref={card3Ref} 
                className="bg-card/95 border border-white/10 dark:border-white/5 py-2 px-3 rounded-xl shadow-lg flex items-center space-x-2 select-none font-semibold"
              >
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[9px] font-extrabold text-primary">12 Active Cards</span>
              </div>
            </div>

            {/* Card 4: Quiz Score 86% (bottom-right) */}
            <div className="absolute -bottom-8 -right-4 animate-float-slow" style={{ transformStyle: 'preserve-3d' }}>
              <div 
                ref={card4Ref} 
                className="bg-card/90 border border-white/10 dark:border-white/5 p-2.5 rounded-xl shadow-lg text-left select-none space-y-0.5 font-semibold"
              >
                <span className="text-[7.5px] uppercase font-bold text-slate-400">Latest Quiz Score</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-[10px] font-black text-indigo-500">86% Success</span>
                  <span className="text-[7px] text-green-500 font-semibold">Set A</span>
                </div>
              </div>
            </div>

            {/* Card 5: Next: Algorithms (right-middle) */}
            <div className="absolute top-1/2 -right-14 animate-float-medium" style={{ transformStyle: 'preserve-3d' }}>
              <div 
                ref={card5Ref} 
                className="bg-card/90 border border-white/10 dark:border-white/5 py-1.5 px-2.5 rounded-lg shadow-lg flex items-center space-x-1.5 select-none font-semibold"
              >
                <span className="text-[8px] font-bold text-slate-400">Next:</span>
                <span className="text-[9px] font-black text-primary flex items-center">
                  Algorithms <ChevronRight className="w-3 h-3 text-blue-500 ml-0.5" />
                </span>
              </div>
            </div>

          </div>

        </motion.div>

      </div>
    </section>
  );
}
