import { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ThemeContext } from '../../contexts/ThemeContext';

// Import modularized components
import Navbar from '../../components/landing/Navbar';
import Hero3D from '../../components/landing/Hero3D';
import FeatureSection from '../../components/landing/FeatureSection';
import HowItWorks from '../../components/landing/HowItWorks';
import ProductShowcase from '../../components/landing/ProductShowcase';
import AudienceTrust from '../../components/landing/AudienceTrust';
import Pricing from '../../components/landing/Pricing';
import FinalCTA from '../../components/landing/FinalCTA';
import Footer from '../../components/landing/Footer';

export default function LandingScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [subPage, setSubPage] = useState(null);

  // Sync theme with document class list
  useEffect(() => {
    const root = window.document.documentElement;
    const previousTheme = theme === 'dark' ? 'light' : 'dark';
    root.classList.remove(previousTheme);
    root.classList.add(theme);
  }, [theme]);

  const handleStart = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-primary text-primary transition-colors duration-300 font-sans relative overflow-hidden bg-gradient-to-tr from-h-bg via-h-sec/10 to-h-bg animate-gradient-shift">
      
      {/* Floating Low-Opacity Gradient Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tr from-blue-500/5 to-indigo-500/5 blur-[120px] pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tr from-purple-500/5 to-pink-500/5 blur-[120px] pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '10s' }} />

      {/* Modular Navigation Header */}
      <Navbar 
        theme={theme} 
        toggleTheme={toggleTheme} 
        onNavigate={navigate} 
        onSetSubPage={setSubPage}
      />

      {subPage ? (
        /* Overlay support pages */
        <div className="max-w-4xl mx-auto py-16 px-6 space-y-8 animate-fade-in relative z-10 bg-card/65 backdrop-blur-md rounded-3xl border border-border-theme mt-24 mb-12 shadow-2xl">
          <button
            onClick={() => setSubPage(null)}
            className="px-3 py-1.5 border border-border-theme hover:bg-hover-theme text-primary rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 focus-ring"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          
          {subPage === 'blog' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-primary">Academic Intelligence Blog 📚</h2>
              <p className="text-xs text-muted leading-relaxed font-medium">Latest research, optimization updates, and learning sciences guides from HyperBrain.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="bg-bg-secondary border border-border-theme p-6 rounded-3xl space-y-3 hover:border-blue-500/50 transition-all cursor-pointer">
                  <span className="text-[9px] font-black text-blue-600 uppercase">Learning Sciences</span>
                  <h4 className="font-black text-sm text-primary leading-tight">How AI Socratic Tutoring Accelerates Active Recall</h4>
                  <p className="text-[11px] text-muted leading-relaxed">Discover the cognitive research backing HyperBrain's Doubt Solver and Professor modes, and why standard chat answers fail to build real retention.</p>
                  <span className="text-[10px] text-muted block font-semibold">5 mins read • July 2026</span>
                </div>

                <div className="bg-bg-secondary border border-border-theme p-6 rounded-3xl space-y-3 hover:border-blue-500/50 transition-all cursor-pointer">
                  <span className="text-[9px] font-black text-indigo-600 uppercase">Engineering</span>
                  <h4 className="font-black text-sm text-primary leading-tight">Graph Theory in Syllabuses Topological Sorting</h4>
                  <p className="text-[11px] text-muted leading-relaxed">A technical walkthrough of our learning graph traversal techniques, ensuring cyclic dependencies are detected and prevented in milliseconds.</p>
                  <span className="text-[10px] text-muted block font-semibold">8 mins read • June 2026</span>
                </div>
              </div>
            </div>
          )}

          {subPage === 'faq' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-primary">Frequently Asked Questions ❓</h2>
              <div className="space-y-4 pt-4">
                {[
                  { q: "Is my uploaded syllabus outline secure?", a: "Yes, fully isolated under our Level-3 production safety and Firestore row-level collection rule parameters." },
                  { q: "Can I upgrade or downgrade my plan at any time?", a: "Absolutely. Student Pro and Student Pro+ memberships can be toggled directly from your cockpit dashboard settings." },
                  { q: "What model engines power the AI Tutor?", a: "We route calls dynamically across premium Gemini and Groq providers, auditing confidence scores to rotate keys under timeouts." }
                ].map((item, idx) => (
                  <div key={idx} className="bg-bg-secondary border border-border-theme p-5 rounded-2xl space-y-2">
                    <h4 className="font-black text-xs text-primary">{item.q}</h4>
                    <p className="text-xs text-muted leading-relaxed font-medium">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subPage === 'contact' && (
            <div className="space-y-6 max-w-md mx-auto">
              <h2 className="text-xl font-black text-primary text-center">Contact HyperBrain Support 📞</h2>
              <div className="bg-bg-secondary border border-border-theme p-6 rounded-3xl space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted uppercase">Your Email</label>
                  <input type="email" placeholder="student@university.edu" className="w-full px-3.5 py-2.5 rounded-xl border border-border-theme bg-card focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted uppercase">Query / Message</label>
                  <textarea rows={4} placeholder="Describe your query..." className="w-full p-3 rounded-xl border border-border-theme bg-card focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold custom-scrollbar" />
                </div>
                <button onClick={() => alert("Message successfully logged! Support desk will review your inquiry.")} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-center">
                  Submit Ticket
                </button>
              </div>
            </div>
          )}

          {subPage === 'about' && (
            <div className="space-y-6 leading-relaxed">
              <h2 className="text-2xl font-black text-primary">About HyperBrain 🧠</h2>
              <p className="text-xs sm:text-sm text-muted font-medium">
                HyperBrain was founded with a single mission: to replace static, generic tutoring interfaces with a rich, interconnected knowledge engine that understands relationships between concepts.
              </p>
              <p className="text-xs sm:text-sm text-muted font-medium">
                By modeling educational materials as learning graphs and tracking cognitive decay cycles, we enable students to learn faster, retain information longer, and ace evaluations.
              </p>
            </div>
          )}

          {subPage === 'privacy' && (
            <div className="space-y-6 leading-relaxed">
              <h2 className="text-2xl font-black text-primary">Privacy Policy 🛡️</h2>
              <p className="text-xs sm:text-sm text-muted font-medium">
                Your privacy is paramount. HyperBrain stores metadata, notes, and quiz metrics strictly to customize your learning journey.
              </p>
              <p className="text-xs sm:text-sm text-muted font-medium">
                We align with FERPA guidelines for educational data isolation and never share textbook outlines or personal profiles with third parties.
              </p>
            </div>
          )}

          {subPage === 'terms' && (
            <div className="space-y-6 leading-relaxed">
              <h2 className="text-2xl font-black text-primary">Terms of Service 📝</h2>
              <p className="text-xs sm:text-sm text-muted font-medium">
                By accessing HyperBrain, you agree to utilize generated study sheets, flashcards, and tutor answers strictly for personal academic enrichment.
              </p>
              <p className="text-xs sm:text-sm text-muted font-medium">
                We reserve the right to suspend accounts attempting prompt injections, bypasses, or rate limits violations.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <Hero3D onStart={handleStart} onExplore={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} />

          {/* Features Grid */}
          <FeatureSection />

          {/* Chronological How It Works Flow */}
          <HowItWorks />

          {/* Interactive Platform Showcase */}
          <ProductShowcase />

          {/* Audience segments */}
          <AudienceTrust />

          {/* Flat 3D Pricing Matrix */}
          <Pricing onSelectPlan={handleStart} onContactSales={handleStart} />

          {/* Conversion CTA */}
          <FinalCTA onStart={handleStart} />
        </>
      )}

      {/* Footer */}
      <Footer onNavigate={navigate} onSetSubPage={setSubPage} />

    </div>
  );
}
