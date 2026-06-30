import { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BrainCircuit, 
  FileText, 
  Layers, 
  Sun, 
  Moon, 
  ArrowRight, 
  Check, 
  Sparkles, 
  UploadCloud, 
  ShieldAlert, 
  BarChart4, 
  Star,
  Lock,
  Search,
  MessageSquare
} from 'lucide-react';
import { ThemeContext } from '../../contexts/ThemeContext';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

export default function LandingScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState('students'); // 'students' or 'colleges'

  const canvasRef = useRef(null);
  const cardRef = useRef(null);
  const statsSectionRef = useRef(null);
  
  const count1Ref = useRef(null);
  const count2Ref = useRef(null);
  const count3Ref = useRef(null);
  const count4Ref = useRef(null);

  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // 1. 3D Interactive Brain Parallax Canvas Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let width = canvas.width = 450;
    let height = canvas.height = 450;

    // Generate coordinate node points mapping a brain hemisphere structure
    const points = [];
    const numPoints = 85;
    for (let i = 0; i < numPoints; i++) {
      const isLeftHemisphere = Math.random() > 0.5;
      const hemiOffset = isLeftHemisphere ? -30 : 30;
      
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      const rx = 90 * Math.sin(phi) * Math.cos(theta) + hemiOffset;
      const ry = 70 * Math.sin(phi) * Math.sin(theta);
      const rz = 70 * Math.cos(phi);
      
      points.push({
        x: rx,
        y: ry,
        z: rz,
        ox: rx,
        oy: ry,
        oz: rz,
        color: isLeftHemisphere ? '#2563eb' : '#4f46e5'
      });
    }

    let angleX = 0.003;
    let angleY = 0.004;

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

    // Parallax mouse movements listener
    const handleMouseMoveGlobal = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      mouseRef.current.targetX = (x / rect.width) * 0.35;
      mouseRef.current.targetY = (y / rect.height) * 0.35;
    };
    window.addEventListener('mousemove', handleMouseMoveGlobal);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Interpolate target values smoothly
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.075;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.075;

      // Project vertices to 2D perspective screen space
      const projected = points.map(p => {
        const temp = { ...p };
        // Spin rotations
        rotateY(temp, angleY);
        rotateX(temp, angleX);
        
        // Interactive mouse parallax shifts
        rotateY(temp, mouseRef.current.x);
        rotateX(temp, mouseRef.current.y);

        const distance = 280;
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

      // Render wireframe connection pathways
      ctx.lineWidth = 0.5;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 55) {
            const opacity = (1 - dist / 55) * 0.12;
            ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      // Render glowing nodes
      projected.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const radius = Math.max(0.8, p.scale * 2.2);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (p.z < -15) {
          ctx.fillStyle = p.color === '#2563eb' ? 'rgba(37, 99, 235, 0.05)' : 'rgba(79, 70, 229, 0.05)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      angleY += 0.0015;
      angleX += 0.0008;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
    };
  }, []);

  // 2. GSAP ScrollTrigger reveals and counter animations
  useEffect(() => {
    // Standard stat number defaults
    if (count1Ref.current) count1Ref.current.innerText = "12,000+";
    if (count2Ref.current) count2Ref.current.innerText = "84,000+";
    if (count3Ref.current) count3Ref.current.innerText = "45+";
    if (count4Ref.current) count4Ref.current.innerText = "99.2%";

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Stagger reveal hero tags, titles, buttons
    gsap.fromTo(".hero-animate", 
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.65, stagger: 0.12, ease: "power2.out", delay: 0.1 }
    );

    // Stagger reveal card elements on scroll
    const scrollCards = document.querySelectorAll(".scroll-reveal-card");
    scrollCards.forEach(card => {
      gsap.fromTo(card,
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: card,
            start: "top 88%",
            toggleActions: "play none none none",
            once: true
          }
        }
      );
    });

    // Stats counter animation
    const statsObj = { c1: 0, c2: 0, c3: 0, c4: 0 };
    gsap.to(statsObj, {
      c1: 12000,
      c2: 84000,
      c3: 45,
      c4: 99.2,
      duration: 1.8,
      ease: "power2.out",
      scrollTrigger: {
        trigger: statsSectionRef.current,
        start: "top 88%",
        once: true
      },
      onUpdate: () => {
        if (count1Ref.current) count1Ref.current.innerText = Math.floor(statsObj.c1).toLocaleString() + "+";
        if (count2Ref.current) count2Ref.current.innerText = Math.floor(statsObj.c2).toLocaleString() + "+";
        if (count3Ref.current) count3Ref.current.innerText = Math.floor(statsObj.c3) + "+";
        if (count4Ref.current) count4Ref.current.innerText = statsObj.c4.toFixed(1) + "%";
      }
    });

  }, []);

  // 3. Interactive card mouse tilt logic
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const box = card.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2;
    const y = e.clientY - box.top - box.height / 2;
    
    // Low degree rotation values
    const rx = -(y / box.height) * 8;
    const ry = (x / box.width) * 8;
    card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.01, 1.01, 1.01)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  };

  const handleStart = () => {
    navigate('/login');
  };

  const handleSelectPlan = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-primary text-primary transition-colors duration-300 font-sans relative overflow-hidden bg-gradient-to-tr from-h-bg via-h-sec/10 to-h-bg animate-gradient-shift">
      
      {/* Floating Low-Opacity Gradient Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tr from-blue-500/5 to-indigo-500/5 blur-[120px] pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tr from-purple-500/5 to-pink-500/5 blur-[120px] pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '10s' }} />

      {/* SECTION 1 - STICKY NAVBAR */}
      <nav className="sticky top-0 z-50 bg-card/85 backdrop-blur-md border-b border-border-theme transition-all">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 cursor-pointer pl-1 md:pl-3 hover:opacity-95 transition-opacity" onClick={() => navigate('/')}>
            <BrainCircuit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight leading-none">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Hyper</span>
                <span className="text-primary">Brain</span>
              </span>
              <span className="hidden sm:inline text-[9px] font-black uppercase tracking-wider text-muted mt-0.5 leading-none">
                AI-Powered Academic Intelligence
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-muted">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-450 transition-colors">Features</a>
            <a href="#workflow" className="hover:text-blue-600 dark:hover:text-blue-450 transition-colors">Workflow</a>
            <a href="#audience" className="hover:text-blue-600 dark:hover:text-blue-450 transition-colors">Audiences</a>
            <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-450 transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-blue-600 dark:hover:text-blue-450 transition-colors">About</a>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-2xl hover:bg-hover-theme text-muted transition-all focus-ring"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-slate-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            <button
              onClick={handleStart}
              className="hidden sm:inline text-sm font-semibold text-primary hover:text-black dark:hover:text-white px-2 py-1 transition-colors"
            >
              Login
            </button>
            <button
              onClick={handleStart}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold px-5 py-2.5 rounded-2xl transition-all shadow-sm focus-ring"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* SECTION 2 - HERO SECTION */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero Left Content */}
          <div className="lg:col-span-6 space-y-8 text-left">
            <div className="hero-animate inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 px-4 py-1.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
              <span>Next-Gen Study & Assessment Platform</span>
            </div>
            
            <h1 className="hero-animate text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter text-primary leading-tight">
              Transform Learning With{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                AI-Powered
              </span>{' '}
              Academic Intelligence
            </h1>

            <p className="hero-animate text-lg sm:text-xl text-muted leading-relaxed max-w-xl">
              HyperBrain helps students learn smarter and institutions conduct intelligent, secure examinations.
            </p>

            <div className="hero-animate flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={handleStart}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all shadow-md shadow-blue-500/10 flex items-center justify-center space-x-2"
              >
                <span>Start Free</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#workflow"
                className="w-full sm:w-auto flex items-center justify-center border border-border-theme text-primary hover:bg-hover-theme/60 active:scale-[0.98] font-semibold px-8 py-4 rounded-2xl text-base transition-all"
              >
                <span>Watch Demo</span>
              </a>
            </div>
          </div>

          {/* Hero Right Mockup Frame & Parallax Brain */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            
            {/* Interactive 3D Synapse Brain Canvas */}
            <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center opacity-40 dark:opacity-60 scale-75 sm:scale-100">
              <canvas ref={canvasRef} className="w-[450px] h-[450px]" />
            </div>

            {/* Dashboard tilt-aware preview card */}
            <div 
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative w-full bg-bg-secondary/45 p-3 rounded-2xl border border-border-theme shadow-2xl backdrop-blur-sm transition-all duration-200 transform-gpu cursor-default"
            >
              
              {/* Simulated OS frame topbar */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-theme">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="text-[10px] text-muted font-mono select-none">hyperbrain.ai/student-dashboard</div>
                <div className="w-12" />
              </div>

              {/* Inside Dashboard mockup elements */}
              <div className="p-4 grid grid-cols-12 gap-4">
                
                {/* AI Tutor Chat Mock */}
                <div className="col-span-12 md:col-span-7 bg-card border border-border-theme rounded-2xl p-4 shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center space-x-2 border-b border-border-theme pb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-bold text-primary flex items-center">
                      Grounded AI Tutor <Sparkles className="w-3.5 h-3.5 text-blue-500 ml-1" />
                    </span>
                  </div>

                  <div className="space-y-3 text-left">
                    <div className="bg-bg-secondary rounded-2xl p-3 text-[11px] text-muted border border-border-theme/40">
                      Based on your Syllabus topic <strong>"Module 2: Neural Architecture"</strong>, I recommend practicing flashcards.
                    </div>
                    <div className="bg-blue-600 text-white rounded-2xl p-3 text-[11px] font-medium max-w-[85%] ml-auto">
                      Generate 5 key cards for this topic please!
                    </div>
                    <div className="bg-bg-secondary rounded-2xl p-3 text-[11px] text-slate-800 dark:text-slate-200 border border-border-theme/40">
                      ✨ Done. Ready to study active recall questions?
                    </div>
                  </div>
                </div>

                {/* Study Stats & Cards columns */}
                <div className="col-span-12 md:col-span-5 space-y-4">
                  
                  {/* Performance stats mini card */}
                  <div className="bg-card border border-border-theme rounded-2xl p-4 shadow-sm text-left">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Target score goal</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-2xl font-black text-primary">92%</span>
                      <span className="text-xs text-green-500 font-semibold">+8.3% trend</span>
                    </div>
                    <div className="w-full bg-bg-secondary h-2 rounded-full overflow-hidden mt-3">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: '85%' }} />
                    </div>
                  </div>

                  {/* Flashcards preview mock */}
                  <div className="bg-card border border-border-theme rounded-2xl p-4 shadow-sm text-left relative overflow-hidden">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Card 1 of 12</span>
                    <p className="text-xs font-bold text-primary mt-2 line-clamp-2">
                      Describe difference between feed-forward and recurrent nets?
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[9px] font-semibold text-slate-400">Tag: Neural Nets</span>
                      <span className="text-[10px] font-semibold text-blue-500 cursor-pointer">Flip Card →</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 3 - SOCIAL PROOF (Stats Section Counters) */}
      <section ref={statsSectionRef} className="bg-bg-secondary/30 border-t border-b border-border-theme py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div ref={count1Ref} className="text-3xl md:text-4xl font-extrabold text-blue-600 dark:text-blue-400">0+</div>
            <p className="text-xs md:text-sm text-muted font-medium mt-1">Students Learning Smarter</p>
          </div>
          <div>
            <div ref={count2Ref} className="text-3xl md:text-4xl font-extrabold text-blue-600 dark:text-blue-400">0+</div>
            <p className="text-xs md:text-sm text-muted font-medium mt-1">AI Mock Exams Answered</p>
          </div>
          <div>
            <div ref={count3Ref} className="text-3xl md:text-4xl font-extrabold text-blue-600 dark:text-blue-400">0+</div>
            <p className="text-xs md:text-sm text-muted font-medium mt-1">Colleges & Institutions</p>
          </div>
          <div>
            <div ref={count4Ref} className="text-3xl md:text-4xl font-extrabold text-blue-600 dark:text-blue-400">0%</div>
            <p className="text-xs md:text-sm text-muted font-medium mt-1">Student Satisfaction Score</p>
          </div>
        </div>
      </section>

      {/* SECTION 4 - FEATURES GRID */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400">Core Features</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
            Everything You Need to Reclaim Your Grades
          </h2>
          <p className="text-muted text-sm max-w-xl mx-auto">
            HyperBrain delivers institutional grade security and individual level study systems within a single platform.
          </p>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Feature 1 */}
          <div className="scroll-reveal-card bg-card border border-border-theme p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 text-left group">
            <div className="bg-blue-50 dark:bg-blue-955/60 text-blue-600 dark:text-blue-400 p-3 rounded-2xl inline-block mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-primary mb-2">Syllabus Cracker</h3>
            <p className="text-muted text-xs leading-relaxed">
              Upload any university syllabus file and watch our AI extract modules, topics, and structures.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="scroll-reveal-card bg-card border border-border-theme p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 text-left group">
            <div className="bg-blue-50 dark:bg-blue-955/60 text-blue-600 dark:text-blue-400 p-3 rounded-2xl inline-block mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-primary mb-2">Grounded AI Tutor</h3>
            <p className="text-muted text-xs leading-relaxed">
              Get detailed conversational guidance that aligns with your specific institution outline.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="scroll-reveal-card bg-card border border-border-theme p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 text-left group">
            <div className="bg-blue-50 dark:bg-blue-955/60 text-blue-600 dark:text-blue-400 p-3 rounded-2xl inline-block mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-primary mb-2">Smart Flashcards</h3>
            <p className="text-muted text-xs leading-relaxed">
              Extract key active recall triggers for each subject automatically without copy pasting.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="scroll-reveal-card bg-card border border-border-theme p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 text-left group">
            <div className="bg-blue-50 dark:bg-blue-955/60 text-blue-600 dark:text-blue-400 p-3 rounded-2xl inline-block mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-primary mb-2">AI Exam Evaluation</h3>
            <p className="text-muted text-xs leading-relaxed">
              Take mock exams and receive line-by-line feedback mapped directly to marking schemes.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="scroll-reveal-card bg-card border border-border-theme p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 text-left group">
            <div className="bg-blue-50 dark:bg-blue-955/60 text-blue-600 dark:text-blue-400 p-3 rounded-2xl inline-block mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-primary mb-2">Browser Lockdown</h3>
            <p className="text-muted text-xs leading-relaxed">
              Enforce focus with lockdown technology to simulate official testing constraints.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="scroll-reveal-card bg-card border border-border-theme p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 text-left group">
            <div className="bg-blue-50 dark:bg-blue-955/60 text-blue-600 dark:text-blue-400 p-3 rounded-2xl inline-block mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <BarChart4 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-primary mb-2">Performance Tracking</h3>
            <p className="text-muted text-xs leading-relaxed">
              Log progress indices and review diagnostic charts tracking study hours and course coverage.
            </p>
          </div>

          {/* Feature 7 */}
          <div className="scroll-reveal-card bg-card border border-border-theme p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 text-left group">
            <div className="bg-blue-50 dark:bg-blue-955/60 text-blue-600 dark:text-blue-400 p-3 rounded-2xl inline-block mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-primary mb-2">Omnipresent Search</h3>
            <p className="text-muted text-xs leading-relaxed">
              Find any lecture concept, flashcard detail, or exam grade in a unified lightning interface.
            </p>
          </div>

          {/* Feature 8 */}
          <div className="scroll-reveal-card bg-card border border-border-theme p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 text-left group">
            <div className="bg-blue-50 dark:bg-blue-955/60 text-blue-600 dark:text-blue-400 p-3 rounded-2xl inline-block mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-primary mb-2">Strict Integrity Engines</h3>
            <p className="text-muted text-xs leading-relaxed">
              Identify secondary browser activities and protect testing trust indicators automatically.
            </p>
          </div>

        </div>
      </section>

      {/* SECTION 5 - WORKFLOW / HOW IT WORKS */}
      <section id="workflow" className="bg-bg-secondary/20 border-t border-b border-border-theme py-24 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-4 mb-20">
          <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400">Our System</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-primary">
            How HyperBrain Operates
          </h2>
          <p className="text-muted text-sm max-w-md mx-auto">
            Three simple layers that bridge outlines, studies, and final certifications.
          </p>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          
          {/* Step 1 */}
          <div className="scroll-reveal-card space-y-4 text-left relative">
            <div className="text-5xl font-black text-blue-600/10 dark:text-blue-500/15">01</div>
            <h3 className="text-lg font-bold text-primary">Crack Outline</h3>
            <p className="text-muted text-xs leading-relaxed">
              Upload syllabus outlines or registry lists. Our layout cracker registers modules, credits, and evaluation weights.
            </p>
          </div>

          {/* Step 2 */}
          <div className="scroll-reveal-card space-y-4 text-left relative">
            <div className="text-5xl font-black text-blue-600/10 dark:text-blue-500/15">02</div>
            <h3 className="text-lg font-bold text-primary">Active Learn</h3>
            <p className="text-muted text-xs leading-relaxed">
              AI maps study resources, coordinates flashcard grids, and powers the grounded tutor chatbot workspace.
            </p>
          </div>

          {/* Step 3 */}
          <div className="scroll-reveal-card space-y-4 text-left relative">
            <div className="text-5xl font-black text-blue-600/10 dark:text-blue-500/15">03</div>
            <h3 className="text-lg font-bold text-primary">Certify Integrity</h3>
            <p className="text-muted text-xs leading-relaxed">
              Evaluate mastery with mock tests under lockdown, generating report logs for students and administrators.
            </p>
          </div>

        </div>
      </section>

      {/* SECTION 6 - TARGET AUDIENCES */}
      <section id="audience" className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="space-y-3">
            <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400">Target Audiences</span>
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">
              Built For Academic Cohesion
            </h2>
          </div>

          {/* Selection Toggles */}
          <div className="bg-bg-secondary p-1.5 rounded-2xl inline-flex space-x-1 border border-border-theme">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-6 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'students'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              For Students
            </button>
            <button
              onClick={() => setActiveTab('colleges')}
              className={`px-6 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'colleges'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              For Institutions & Colleges
            </button>
          </div>

          {/* Dynamic Tabs contents */}
          {activeTab === 'students' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-8 text-left">
              <div className="space-y-6 scroll-reveal-card">
                <h3 className="text-2xl font-black text-primary tracking-tight">Learn Faster, Save Time</h3>
                <p className="text-muted text-xs leading-relaxed">
                  Stop looking for summary notes across secondary folders. HyperBrain turns your actual course syllabus into an interactive study guide.
                </p>
                <ul className="space-y-3.5 text-xs font-medium text-slate-700 dark:text-slate-350">
                  <li className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span>Generate flashcards without typing</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span>Get grounded AI tutoring aligned to your syllabus</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span>Animate test prep with customized mock datasets</span>
                  </li>
                </ul>
                <button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition-all inline-flex items-center space-x-2">
                  <span>Sign Up Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              
              <div className="bg-bg-secondary border border-border-theme rounded-2xl p-6 space-y-4 scroll-reveal-card">
                <span className="text-[10px] font-bold tracking-wider text-blue-500 uppercase">Flashcard deck preview</span>
                <h4 className="text-base font-bold text-primary">Web Technology Core</h4>
                <div className="space-y-3">
                  <div className="p-3.5 bg-card rounded-2xl border border-border-theme flex items-center justify-between text-xs">
                    <span className="font-semibold">HTML5 Semantic structure</span>
                    <span className="text-[10px] text-blue-500 font-bold">Review deck</span>
                  </div>
                  <div className="p-3.5 bg-card rounded-2xl border border-border-theme flex items-center justify-between text-xs">
                    <span className="font-semibold">CSS3 Flexbox grids layout</span>
                    <span className="text-[10px] text-blue-500 font-bold">Review deck</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-8 text-left animate-fade-in">
              <div className="space-y-6 scroll-reveal-card">
                <h3 className="text-2xl font-black text-primary tracking-tight">Institutional Testing, Reimagined</h3>
                <p className="text-muted text-xs leading-relaxed">
                  Generate secure, anti-leak mock examinations and structure secure testing outlines for remote registries.
                </p>
                <ul className="space-y-3.5 text-xs font-medium text-slate-700 dark:text-slate-350">
                  <li className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span>Lockdown browser mode simulating exam setups</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span>Evaluate student responses with grounded outline keys</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span>Bulk import university syllabi arrays in dashboard</span>
                  </li>
                </ul>
                <button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-2xl text-sm transition-all inline-flex items-center space-x-2">
                  <span>Contact Sales Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-bg-secondary border border-border-theme rounded-2xl p-6 space-y-4 scroll-reveal-card">
                <span className="text-[10px] font-bold tracking-wider text-blue-500 uppercase">Institutional panel preview</span>
                <h4 className="text-base font-bold text-primary">Active Registries</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-border-theme/40">
                    <span className="font-semibold">Undergrad Computer Science</span>
                    <span className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 text-[10px] px-2 py-0.5 rounded">Active</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-theme/40">
                    <span className="font-semibold">Advanced Linear Algebra</span>
                    <span className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 text-[10px] px-2 py-0.5 rounded">Active</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="font-semibold">Introduction to Databases</span>
                    <span className="bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-450 text-[10px] px-2 py-0.5 rounded">Pending Upload</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 7 - PRICING MATRIX */}
      <section id="pricing" className="py-24 px-6 bg-bg-secondary/30 border-t border-b border-border-theme">
        <div className="max-w-7xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400">Pricing System</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-primary">
            Choose The Plan That Matches Your Ambition
          </h2>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Plan 1 */}
          <div className="scroll-reveal-card bg-card border border-border-theme rounded-2xl p-8 flex flex-col justify-between text-left shadow-sm hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Free</span>
              <div className="flex items-baseline space-x-1 mt-4">
                <span className="text-4xl font-extrabold">$0</span>
                <span className="text-xs text-slate-400 font-medium">/forever</span>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">Perfect for checking out platform capability</p>
              
              <ul className="space-y-3 mt-8">
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-350">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Limited AI exams</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Basic study flashcards</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Community support access</span>
                </li>
              </ul>
            </div>
            <button onClick={() => handleSelectPlan('Free')} className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-primary font-semibold py-3 rounded-2xl text-xs transition-all mt-8">
              Start Free
            </button>
          </div>

          {/* Plan 2 */}
          <div className="scroll-reveal-card bg-card border-2 border-blue-500 dark:border-blue-600 rounded-2xl p-8 flex flex-col justify-between text-left shadow-md relative hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full z-10 animate-pulse">
              Most Popular
            </div>
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-blue-600 dark:text-blue-400">Pro</span>
              <div className="flex items-baseline space-x-1 mt-4">
                <span className="text-4xl font-extrabold">$9.99</span>
                <span className="text-xs text-slate-400 font-medium">/month</span>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">Complete suite for individual academic excellence</p>
              
              <ul className="space-y-3 mt-8">
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Unlimited AI exams</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Grounded AI Tutor access</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Performance analytics</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Advanced active recall tools</span>
                </li>
              </ul>
            </div>
            <button onClick={() => handleSelectPlan('Pro')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-2xl text-xs transition-all mt-8">
              Upgrade to Pro
            </button>
          </div>

          {/* Plan 3 */}
          <div className="scroll-reveal-card bg-card border border-border-theme rounded-2xl p-8 flex flex-col justify-between text-left shadow-sm hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Semester Saver</span>
              <div className="flex items-baseline space-x-1 mt-4">
                <span className="text-4xl font-extrabold">$39.99</span>
                <span className="text-xs text-slate-400 font-medium">/6 months</span>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">Optimized duration to save through final exam sessions</p>
              
              <ul className="space-y-3 mt-8">
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Everything in Pro plan</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Semester optimized priorities</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Dedicated priority servers</span>
                </li>
              </ul>
            </div>
            <button onClick={() => handleSelectPlan('Semester')} className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-primary font-semibold py-3 rounded-2xl text-xs transition-all mt-8">
              Save with Semester Plan
            </button>
          </div>

          {/* Plan 4 */}
          <div className="scroll-reveal-card bg-card border border-border-theme rounded-2xl p-8 flex flex-col justify-between text-left shadow-sm hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Institution</span>
              <div className="flex items-baseline space-x-1 mt-4">
                <span className="text-4xl font-extrabold">Custom</span>
                <span className="text-xs text-slate-400 font-medium">/details</span>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">Complete compliance metrics for departments</p>
              
              <ul className="space-y-3 mt-8">
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Administrative dashboard panel</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Secure exam lockdown controls</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Multi-user registry licensing</span>
                </li>
                <li className="flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-355">
                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span>Dedicated account manager support</span>
                </li>
              </ul>
            </div>
            <button onClick={handleStart} className="w-full bg-slate-900 hover:bg-slate-950 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold py-3 rounded-2xl text-xs transition-all mt-8">
              Contact Sales
            </button>
          </div>

        </div>
      </section>

      {/* SECTION 8 - TESTIMONIALS */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400">Testimonials</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-primary">
            What Our Academic Community Says
          </h2>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1 */}
          <div className="scroll-reveal-card bg-slate-50 dark:bg-bg-secondary p-8 rounded-2xl text-left border border-border-theme/60 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
            <div className="space-y-4">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm italic leading-relaxed">
                "HyperBrain literally cured my finals anxiety. Generating 3 non-repeating question sets based on my actual course syllabus was what helped me get my highest score."
              </p>
            </div>
            <div className="mt-8 flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">AS</div>
              <div>
                <span className="text-xs font-bold block text-primary">Alex Rivera</span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Computer Science Student</span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="scroll-reveal-card bg-slate-50 dark:bg-bg-secondary p-8 rounded-2xl text-left border border-border-theme/60 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
            <div className="space-y-4">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm italic leading-relaxed">
                "The grounded AI tutor is incredible. Instead of answering random textbook summaries, it queries information based on my specific module structure."
              </p>
            </div>
            <div className="mt-8 flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">MH</div>
              <div>
                <span className="text-xs font-bold block text-primary">Maya Harrison</span>
                <span className="text-[10px] text-slate-450 uppercase font-semibold">Bioengineering Student</span>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="scroll-reveal-card bg-slate-50 dark:bg-bg-secondary p-8 rounded-2xl text-left border border-border-theme/60 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
            <div className="space-y-4">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm italic leading-relaxed">
                "Using the secure browser lockdown has helped us structure weekly evaluations for our remote classes without worry. Grading feedback is generated instantly."
              </p>
            </div>
            <div className="mt-8 flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">DK</div>
              <div>
                <span className="text-xs font-bold block text-primary">Dr. Karen Vance</span>
                <span className="text-[10px] text-slate-450 uppercase font-semibold">Department Head, Chemistry</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 9 - FINAL CTA */}
      <section className="max-w-5xl mx-auto my-20 px-6 scroll-reveal-card">
        <div className="bg-slate-50 dark:bg-bg-secondary/60 border border-border-theme p-12 md:p-16 rounded-3xl text-center relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="max-w-2xl mx-auto space-y-6 relative">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary leading-tight">
              Ready to Upgrade Your Academic Intelligence?
            </h2>
            <p className="text-muted max-w-md mx-auto text-xs sm:text-sm leading-relaxed">
              Upload your syllabus now and construct your custom learning roadmap in less than 30 seconds.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
              <button
                onClick={handleStart}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition-all shadow-md shadow-blue-500/10 flex items-center justify-center space-x-2"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleStart}
                className="w-full sm:w-auto border border-border-theme text-primary hover:bg-hover-theme active:scale-[0.98] font-semibold px-8 py-3.5 rounded-2xl text-sm transition-all"
              >
                Book Custom Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10 - FOOTER */}
      <footer className="bg-bg-secondary border-t border-border-theme py-16 px-6 transition-colors">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12 text-left">
          
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center space-x-2.5 cursor-pointer pl-1 hover:opacity-95 transition-opacity" onClick={() => navigate('/')}>
              <BrainCircuit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-xl font-bold tracking-tight text-primary">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Hyper</span>
                <span>Brain</span>
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed max-w-xs">
              Continuous study, grounded tutors, and institutional security structures merged in one system.
            </p>
            <p className="text-[10px] text-muted">
              © {new Date().getFullYear()} HyperBrain. All rights reserved.
            </p>
          </div>

          <div>
            <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Product</h5>
            <ul className="space-y-2.5 text-xs text-muted">
              <li><a href="#features" className="hover:text-blue-500 transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-blue-500 transition-colors">Pricing Matrix</a></li>
              <li><a href="#workflow" className="hover:text-blue-500 transition-colors">How it works</a></li>
              <li><a href="#audience" className="hover:text-blue-500 transition-colors">Target Audiences</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Resources</h5>
            <ul className="space-y-2.5 text-xs text-muted">
              <li><a href="#testimonials" className="hover:text-blue-500 transition-colors">Customer Success</a></li>
              <li><span className="cursor-not-allowed opacity-50">Academic Blog</span></li>
              <li><span className="cursor-not-allowed opacity-50">Security Checklist</span></li>
              <li><span className="cursor-not-allowed opacity-50">API Documentation</span></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Compliance</h5>
            <ul className="space-y-2.5 text-xs text-muted">
              <li><span className="cursor-not-allowed opacity-50">Privacy Outline</span></li>
              <li><span className="cursor-not-allowed opacity-50">Terms of Service</span></li>
              <li><span className="cursor-not-allowed opacity-50">FERPA Guidelines</span></li>
              <li><span className="cursor-not-allowed opacity-55">Support Desk</span></li>
            </ul>
          </div>

        </div>
      </footer>

    </div>
  );
}
