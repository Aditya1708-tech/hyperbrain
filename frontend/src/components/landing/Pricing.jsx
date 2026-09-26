import React from 'react';
import { Check } from 'lucide-react';

export default function Pricing({ onSelectPlan, onContactSales }) {
  return (
    <section id="pricing" className="py-24 px-6 bg-bg-secondary/40 border-b border-border-theme">
      <div className="max-w-7xl mx-auto text-center space-y-4 mb-16">
        <span className="text-xs uppercase font-extrabold tracking-widest text-blue-600 dark:text-blue-400">Pricing Plans</span>
        <h2 className="text-3xl font-extrabold tracking-tight text-primary">
          Choose The Plan That Matches Your Ambition
        </h2>
        <p className="text-muted text-sm max-w-md mx-auto font-medium">
          Unlock institutional grade security and personalized Socratic tutor options.
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        
        {/* Plan 1 */}
        <div className="scroll-reveal-card bg-card border border-border-theme rounded-3xl p-8 flex flex-col justify-between text-left shadow-sm hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/20 transition-all duration-300">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Free</span>
            <div className="flex items-baseline space-x-1 mt-4">
              <span className="text-4xl font-extrabold text-primary">$0</span>
              <span className="text-xs text-slate-400 font-medium">/forever</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">Perfect for checking out platform capability</p>
            
            <ul className="space-y-3 mt-8">
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Limited AI exams</span>
              </li>
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Basic study flashcards</span>
              </li>
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Community support access</span>
              </li>
            </ul>
          </div>
          <button 
            onClick={() => onSelectPlan('Free')}
            className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-primary font-semibold py-3 rounded-2xl text-xs transition-all mt-8 focus-ring"
          >
            Start Free
          </button>
        </div>

        {/* Plan 2: RECOMMENDED TIER */}
        <div className="scroll-reveal-card bg-card border-2 border-blue-500 dark:border-blue-600 rounded-3xl p-8 flex flex-col justify-between text-left shadow-md relative hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300">
          <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-blue-650 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full z-10 animate-pulse">
            Recommended
          </div>
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-blue-650 dark:text-blue-400">Pro</span>
            <div className="flex items-baseline space-x-1 mt-4">
              <span className="text-4xl font-extrabold text-primary">$9.99</span>
              <span className="text-xs text-slate-400 font-medium">/month</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">Complete suite for individual academic excellence</p>
            
            <ul className="space-y-3 mt-8">
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Unlimited AI exams</span>
              </li>
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Grounded AI Tutor access</span>
              </li>
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Performance analytics</span>
              </li>
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Advanced active recall tools</span>
              </li>
            </ul>
          </div>
          <button 
            onClick={() => onSelectPlan('Pro')}
            className="w-full bg-blue-650 hover:bg-blue-700 text-white font-semibold py-3 rounded-2xl text-xs transition-all mt-8 shadow-sm focus-ring"
          >
            Upgrade to Pro
          </button>
        </div>

        {/* Plan 3 */}
        <div className="scroll-reveal-card bg-card border border-border-theme rounded-3xl p-8 flex flex-col justify-between text-left shadow-sm hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/20 transition-all duration-300">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Semester Saver</span>
            <div className="flex items-baseline space-x-1 mt-4">
              <span className="text-4xl font-extrabold text-primary">$39.99</span>
              <span className="text-xs text-slate-400 font-medium">/6 months</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">Optimized duration to save through final exam sessions</p>
            
            <ul className="space-y-3 mt-8">
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Everything in Pro plan</span>
              </li>
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Semester optimized priorities</span>
              </li>
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Dedicated priority servers</span>
              </li>
            </ul>
          </div>
          <button 
            onClick={() => onSelectPlan('Semester')}
            className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-primary font-semibold py-3 rounded-2xl text-xs transition-all mt-8 focus-ring"
          >
            Save with Semester Plan
          </button>
        </div>

        {/* Plan 4 */}
        <div className="scroll-reveal-card bg-card border border-border-theme rounded-3xl p-8 flex flex-col justify-between text-left shadow-sm hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/20 transition-all duration-300">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Institution</span>
            <div className="flex items-baseline space-x-1 mt-4">
              <span className="text-4xl font-extrabold text-primary">Custom</span>
              <span className="text-xs text-slate-400 font-medium">/details</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">Complete compliance metrics for departments</p>
            
            <ul className="space-y-3 mt-8">
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Administrative dashboard panel</span>
              </li>
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Secure exam lockdown controls</span>
              </li>
              <li className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Multi-user registry licensing</span>
              </li>
            </ul>
          </div>
          <button 
            onClick={onContactSales}
            className="w-full bg-slate-900 hover:bg-slate-950 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold py-3 rounded-2xl text-xs transition-all mt-8 focus-ring"
          >
            Contact Sales
          </button>
        </div>

      </div>
    </section>
  );
}
