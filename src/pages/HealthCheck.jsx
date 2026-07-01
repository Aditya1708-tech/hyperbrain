import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Activity, ArrowLeft } from 'lucide-react';
import aiService, { generateAI } from '../services/aiService';
import { db } from '../services/firebase/firebase';
import { AI_CONFIG } from '../config/aiConfig';

export default function HealthCheck() {
  const [results, setResults] = useState({
    groqKeyExists: { status: 'checking', message: '' },
    groqKeyFormat: { status: 'checking', message: '' },
    groqConnection: { status: 'checking', message: '' },
    firebaseConnected: { status: 'checking', message: '' },
    apiRoutesConfigured: { status: 'checking', message: '' },
    modelAvailable: { status: 'checking', message: '' }
  });
  const [loading, setLoading] = useState(true);

  const runDiagnostics = async () => {
    setLoading(true);
    const newResults = { ...results };

    // 1. Groq Key Exists
    const apiKey = AI_CONFIG.apiKey;
    if (apiKey) {
      newResults.groqKeyExists = { status: 'pass', message: 'VITE_GROQ_API_KEY is defined in configurations.' };
    } else {
      newResults.groqKeyExists = { status: 'fail', message: 'VITE_GROQ_API_KEY is missing.' };
    }

    // 2. Groq Key Format Valid
    if (apiKey) {
      if (apiKey.startsWith('gsk_')) {
        newResults.groqKeyFormat = { status: 'pass', message: 'API key starts with valid Groq signature (gsk_).' };
      } else {
        newResults.groqKeyFormat = { status: 'fail', message: 'API key format invalid. Expected prefix "gsk_", found: ' + apiKey.substring(0, 4) };
      }
    } else {
      newResults.groqKeyFormat = { status: 'fail', message: 'Cannot validate format. Key is missing.' };
    }

    // 3. AI Model Available
    if (AI_CONFIG.model === 'llama-3.3-70b-versatile') {
      newResults.modelAvailable = { status: 'pass', message: `Configured to use target model: ${AI_CONFIG.model}.` };
    } else {
      newResults.modelAvailable = { status: 'fail', message: `Model name misconfigured: found ${AI_CONFIG.model}, expected llama-3.3-70b-versatile.` };
    }

    // 4. Firebase Connected
    if (db) {
      newResults.firebaseConnected = { status: 'pass', message: 'Firestore Database client loaded successfully.' };
    } else {
      newResults.firebaseConnected = { status: 'fail', message: 'Firestore Database client not initialized.' };
    }

    // 5. API Routes Exist
    try {
      const res = await fetch('/api/generate-notes', { method: 'POST', body: '{}' }).catch(() => null);
      if (res && res.status !== 404) {
        newResults.apiRoutesConfigured = { status: 'pass', message: `Serverless API route reachable (Status: ${res.status}).` };
      } else {
        newResults.apiRoutesConfigured = { status: 'warning', message: 'API routes returned 404 (Expected in local dev; direct browser Groq calls active).' };
      }
    } catch (e) {
      newResults.apiRoutesConfigured = { status: 'warning', message: 'API routes unreachable locally. Browser fallback mode enabled.' };
    }

    // 6. Groq Connection Works
    if (apiKey) {
      try {
        const text = await generateAI("Hello, confirm connection.");
        if (text) {
          newResults.groqConnection = { status: 'pass', message: 'Successfully generated content from Groq API.' };
        } else {
          newResults.groqConnection = { status: 'fail', message: 'Groq returned empty connection check.' };
        }
      } catch (e) {
        newResults.groqConnection = { status: 'fail', message: 'Groq connection failed: ' + e.message };
      }
    } else {
      newResults.groqConnection = { status: 'fail', message: 'Skipped connection test because API Key is missing.' };
    }

    setResults(newResults);
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const overallPass = Object.values(results).every(r => r.status === 'pass' || r.status === 'warning');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-100">AI Infrastructure Audit</h1>
              <p className="text-xs text-slate-400 font-semibold">Diagnostic page for system services</p>
            </div>
          </div>
          <button 
            onClick={runDiagnostics} 
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center space-x-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-bold">Re-run</span>
          </button>
        </div>

        {/* Status Badge */}
        <div className={`p-4 rounded-2xl flex items-center space-x-4 border ${
          loading 
            ? 'bg-slate-800/40 border-slate-700/50' 
            : overallPass 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <div className="text-2xl">
            {loading ? '⏳' : overallPass ? '✅' : '❌'}
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider">
              {loading ? 'Scanning Services...' : overallPass ? 'System Health: PASS' : 'System Health: FAIL'}
            </div>
            <div className="text-[10px] opacity-80 font-semibold mt-0.5">
              {loading 
                ? 'Running automated tests on keys, Firebase status, and API routes...' 
                : overallPass 
                  ? 'All core systems are operational. HyperBrain is ready.' 
                  : 'Critical failures detected. Review the checklist below to repair configuration.'}
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-3.5">
          {Object.entries(results).map(([key, value]) => {
            const isPass = value.status === 'pass';
            const isWarning = value.status === 'warning';
            const isChecking = value.status === 'checking';
            
            return (
              <div key={key} className="flex items-start justify-between p-4 bg-slate-950/40 border border-slate-800/50 rounded-2xl">
                <div className="space-y-1 pr-4">
                  <h3 className="text-xs font-black text-slate-200 capitalize tracking-wider">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    {value.message || 'Running check...'}
                  </p>
                </div>
                
                <div className="flex-shrink-0 pt-0.5">
                  {isChecking ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 animate-pulse">Checking</span>
                  ) : isPass ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PASS</span>
                  ) : isWarning ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">WARN</span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">FAIL</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-800">
          <a href="/dashboard" className="text-[10px] font-bold text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go to Dashboard</span>
          </a>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            HyperBrain Diagnostics v1.0
          </span>
        </div>

      </div>
    </div>
  );
}
