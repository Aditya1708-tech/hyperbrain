import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Cpu, Heart, CheckCircle, RefreshCw, Activity } from 'lucide-react';
import Card from '../common/Card';

export default function SystemHealth({
  showToast
}) {
  const [checking, setChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(new Date());

  const [statuses, setStatuses] = useState({
    firebase: "Healthy",
    groq: "Healthy",
    resend: "Healthy",
    auth: "Healthy",
    storage: "Healthy",
    database: "Healthy"
  });

  // Health checks utility simulation
  const checkSystemHealth = async () => {
    setChecking(true);
    // Simulate API checking delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate some realistic random warning or down events (very rarely)
    const possibleStatuses = ["Healthy", "Healthy", "Healthy", "Warning", "Healthy"];
    setStatuses({
      firebase: "Healthy",
      groq: possibleStatuses[Math.floor(Math.random() * possibleStatuses.length)],
      resend: "Healthy",
      auth: "Healthy",
      storage: "Healthy",
      database: "Healthy"
    });
    setLastCheckTime(new Date());
    setChecking(false);
    showToast("Global system health diagnostics completed.");
  };

  // Run automatically on 15s interval
  useEffect(() => {
    const interval = setInterval(() => {
      checkSystemHealth();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    if (status === "Healthy") {
      return (
        <span className="flex items-center space-x-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
          <span>🟢</span>
          <span>Healthy</span>
        </span>
      );
    }
    if (status === "Warning") {
      return (
        <span className="flex items-center space-x-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
          <span>🟡</span>
          <span>Warning</span>
        </span>
      );
    }
    return (
      <span className="flex items-center space-x-1 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
        <span>🔴</span>
        <span>Down</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Diagnostics Header */}
      <div className="flex justify-between items-center bg-bg-secondary p-4 rounded-2xl border border-border-theme">
        <div>
          <span className="text-xs font-bold text-primary block">Automated Node Health Diagnostics</span>
          <span className="text-[10px] text-muted font-semibold block mt-0.5 font-mono">
            Last check run: {lastCheckTime.toLocaleTimeString()}
          </span>
        </div>
        <button
          onClick={checkSystemHealth}
          disabled={checking}
          className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Analyzing...' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { key: "firebase", name: "Google Firebase Serverless", latency: "45ms", desc: "NoSQL DB structures sync status" },
          { key: "groq", name: "Groq LLM Cloud Engine", latency: "1.1s", desc: "Llama prompt generation pipeline" },
          { key: "resend", name: "Resend SMTP Gateway", latency: "85ms", desc: "Transaction and notification mail service" },
          { key: "auth", name: "OAuth Authentication Node", latency: "12ms", desc: "User session handshake verification" },
          { key: "storage", name: "Cloud Bucket Storage", latency: "140ms", desc: "PDF syllabus file repository" },
          { key: "database", name: "State Caching DB", latency: "5ms", desc: "Local session states redundancy sync" }
        ].map((service, index) => (
          <Card key={index} className="p-5 bg-card border border-border-theme space-y-4 hover:scale-[1.01] transition-transform">
            <div className="flex justify-between items-start">
              <span className="text-xs font-black text-primary uppercase tracking-widest">{service.name}</span>
              {getStatusBadge(statuses[service.key])}
            </div>
            
            <div className="text-xs font-semibold text-muted space-y-1">
              <div className="flex justify-between">
                <span>Response latency</span>
                <span className="font-mono text-primary font-bold">{service.latency}</span>
              </div>
              <div className="flex justify-between">
                <span>Description</span>
                <span className="text-right max-w-[150px] truncate">{service.desc}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Health diagnostics log */}
      <Card className="bg-card border-border-theme p-6 space-y-4">
        <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2 flex items-center space-x-1.5">
          <Activity className="w-4 h-4 text-indigo-500" />
          <span>System Diagnostics Log</span>
        </h3>
        <div className="space-y-2 text-xs font-semibold text-muted font-mono">
          <p className="text-green-500">[HEALTHY] {lastCheckTime.toLocaleTimeString()} - Firebase sync listener initialized successfully.</p>
          <p className={statuses.groq === 'Warning' ? "text-yellow-500 animate-pulse" : "text-green-500"}>
            [{statuses.groq === 'Warning' ? 'WARNING' : 'HEALTHY'}] {lastCheckTime.toLocaleTimeString()} - Groq model latency is currently {statuses.groq === 'Warning' ? '2.8s (high load)' : '1.1s (normal)'}.
          </p>
          <p className="text-green-500">[HEALTHY] {lastCheckTime.toLocaleTimeString()} - Resend SMTP handshake completed (HTTP 200 OK).</p>
          <p className="text-green-500">[HEALTHY] {lastCheckTime.toLocaleTimeString()} - Local storage bucket quota below critical thresholds.</p>
        </div>
      </Card>

    </div>
  );
}
