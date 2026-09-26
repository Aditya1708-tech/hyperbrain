import React from 'react';
import { FileText, Layers, Award, MessageSquare, Calendar, BarChart2 } from 'lucide-react';

const FEATURES_LIST = [
  {
    icon: FileText,
    title: "AI Notes",
    desc: "Generate highly detailed, textbook-style academic notes grounded in your specific subject outline. Never get lost in summary booklets again."
  },
  {
    icon: Layers,
    title: "Smart Flashcards",
    desc: "Automatically extract key vocabulary, core concepts, and active recall triggers for each module without manually copy pasting."
  },
  {
    icon: Award,
    title: "Practice Exams",
    desc: "Test your boundaries with mock examinations under secure environments and get detailed marks matching university criteria."
  },
  {
    icon: MessageSquare,
    title: "AI Tutor",
    desc: "Interact with an on-demand Socratic academic counselor trained to query and solve doubts specifically using your textbook syllabus."
  },
  {
    icon: Calendar,
    title: "Study Planner",
    desc: "Build automated, adaptive study roadmaps that calculate chapters and credit coverage to keep you ready for final exam schedules."
  },
  {
    icon: BarChart2,
    title: "Progress Tracking",
    desc: "Monitor coverage percentages across all subjects, track study metrics, and visualize review analytics on your personal dashboard."
  }
];

export default function FeatureSection() {
  const handleMouseMove = (e) => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const card = e.currentTarget;
    const box = card.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2;
    const y = e.clientY - box.top - box.height / 2;
    
    // Smooth tilt values
    const rx = -(y / box.height) * 15;
    const ry = (x / box.width) * 15;
    
    card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px) scale3d(1.03, 1.03, 1.03)`;
  };

  const handleMouseLeave = (e) => {
    const card = e.currentTarget;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1, 1, 1)`;
  };

  return (
    <section id="features" className="py-24 px-6 border-b border-border-theme">
      <div className="max-w-7xl mx-auto text-center space-y-4 mb-16">
        <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400 animate-pulse">Core Features</span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
          Everything You Need to Learn Smarter
        </h2>
        <p className="text-muted text-sm max-w-xl mx-auto font-medium">
          HyperBrain delivers institutional grade security and individual level study systems within a single platform.
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {FEATURES_LIST.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <div 
              key={idx} 
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="scroll-reveal-card bg-card border border-border-theme p-6 rounded-3xl transition-all duration-300 text-left group cursor-default shadow-xs hover:shadow-xl hover:border-blue-500/25"
              style={{ transformStyle: 'preserve-3d', transform: 'perspective(1000px)' }}
            >
              <div 
                className="bg-blue-50 dark:bg-blue-955/60 text-blue-600 dark:text-blue-400 p-3.5 rounded-2xl inline-block mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-xs"
                style={{ transform: 'translateZ(35px)' }}
              >
                <Icon className="w-6 h-6" />
              </div>
              
              <h3 
                className="text-base font-bold text-primary mb-2 transition-all"
                style={{ transform: 'translateZ(25px)' }}
              >
                {feat.title}
              </h3>
              
              <p 
                className="text-muted text-xs leading-relaxed transition-all font-medium"
                style={{ transform: 'translateZ(15px)' }}
              >
                {feat.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
