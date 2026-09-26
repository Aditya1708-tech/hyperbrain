import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function FinalCTA({ onStart }) {
  return (
    <section className="max-w-6xl mx-auto my-24 px-6 scroll-reveal-card relative overflow-hidden rounded-3xl border border-border-theme bg-card/45 backdrop-blur-sm select-none">
      
      {/* 3D background workspace visual fading in the background */}
      <div 
        className="absolute -right-32 top-1/2 -translate-y-1/2 w-[350px] h-[240px] bg-bg-secondary/40 border border-border-theme rounded-2xl shadow-xl p-3 opacity-20 dark:opacity-30 pointer-events-none hidden md:block"
        style={{
          transform: 'perspective(800px) rotateX(15deg) rotateY(-25deg) translateZ(0px)',
          transformStyle: 'preserve-3d'
        }}
      >
        <div className="flex items-center space-x-1.5 pb-2 border-b border-border-theme/40">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        </div>
        <div className="mt-3 space-y-2 text-[9px] text-muted">
          <div className="bg-card p-1.5 rounded border border-border-theme/60 truncate">Syllabus Cracked ✓</div>
          <div className="bg-card p-1.5 rounded border border-border-theme/60 truncate">12 Flashcards Generated</div>
          <div className="bg-card p-1.5 rounded border border-border-theme/60 truncate">Grounded Tutor Available</div>
        </div>
      </div>

      <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="max-w-3xl py-16 md:py-20 px-8 md:px-12 text-left relative z-10 space-y-6">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary leading-tight max-w-2xl">
          Turn Your Syllabus Into a Smarter Way to Learn.
        </h2>
        
        <p className="text-muted max-w-lg text-sm leading-relaxed font-medium">
          Upload your textbook now and construct your custom learning roadmap in less than 30 seconds. Join students around the world learning smarter.
        </p>
        
        <div className="pt-4">
          <button
            onClick={onStart}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-md shadow-blue-500/10 flex items-center justify-center space-x-2 focus-ring"
          >
            <span>Start Learning Free</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
