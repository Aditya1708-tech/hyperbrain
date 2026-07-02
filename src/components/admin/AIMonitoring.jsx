import React, { useState, useEffect } from 'react';
import { Cpu, AlertTriangle, Clock, ShieldCheck, Database, RefreshCw, BarChart2 } from 'lucide-react';
import Card from '../common/Card';

export default function AIMonitoring({
  stats,
  showToast
}) {
  const [isLive, setIsLive] = useState(true);
  const [apiLatency, setApiLatency] = useState(1.1);
  const [successRate, setSuccessRate] = useState(stats.apiSuccessRate || 99.1);

  // Live simulation of request fluctuations
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setApiLatency(prev => {
        const change = (Math.random() - 0.5) * 0.15;
        return parseFloat(Math.max(0.6, Math.min(2.5, prev + change)).toFixed(2));
      });
      setSuccessRate(prev => {
        const change = (Math.random() - 0.5) * 0.2;
        return parseFloat(Math.max(95, Math.min(100, prev + change)).toFixed(2));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [isLive]);

  const featuresList = [
    { name: "Study Notes Generation", requests: 120, successRate: 99.2, latency: "1.3s", tokens: "320k" },
    { name: "AI Flashcards Compiler", requests: 84, successRate: 100.0, latency: "0.8s", tokens: "185k" },
    { name: "Interactive Quiz MCQs", requests: 110, successRate: 98.5, latency: "0.9s", tokens: "210k" },
    { name: "Live AI Tutor Chats", requests: 240, successRate: 99.6, latency: "1.1s", tokens: "540k" },
    { name: "Syllabus Summarizer", requests: 35, successRate: 97.1, latency: "2.1s", tokens: "150k" },
    { name: "Mock Exam Papers", requests: 64, successRate: 96.8, latency: "2.4s", tokens: "680k" }
  ];

  // Helper to generate SVG Path for line/area chart
  const getSvgPath = (data, width, height, max, isArea = false) => {
    if (data.length === 0) return '';
    const points = data.map((val, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - (val / max) * height * 0.7 - height * 0.15;
      return `${x},${y}`;
    });
    
    if (isArea) {
      return `M0,${height} L${points.join(' L')} L${width},${height} Z`;
    }
    return `M${points.join(' L')}`;
  };

  // Mock hourly request values
  const requestsPerHour = [15, 24, 45, 62, 58, 84, 110, 95, 120, 145, 185, 210];

  return (
    <div className="space-y-6">
      
      {/* Simulation Banner */}
      <div className="flex justify-between items-center bg-bg-secondary p-4 rounded-2xl border border-border-theme">
        <div>
          <span className="text-xs font-bold text-primary block">Real-time LLM Operations Telemetry</span>
          <span className="text-[10px] text-muted font-semibold block mt-0.5">Monitoring API performance boundary for Groq cloud services</span>
        </div>
        <button
          onClick={() => {
            setIsLive(!isLive);
            showToast(isLive ? "Telemetry live updates paused" : "Telemetry live updates activated");
          }}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
            isLive 
              ? 'bg-green-500/10 text-green-600 border-green-500/20' 
              : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLive ? 'animate-spin' : ''}`} />
          <span>{isLive ? 'Live Streaming' : 'Paused'}</span>
        </button>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total AI Requests", value: stats.totalAiRequests, icon: Cpu, color: "text-blue-500" },
          { label: "Success Rate", value: `${successRate}%`, icon: ShieldCheck, color: "text-green-500" },
          { label: "Failed Requests", value: stats.failedAiRequests, icon: AlertTriangle, color: "text-red-500" },
          { label: "Avg Latency", value: `${apiLatency}s`, icon: Clock, color: "text-yellow-500" },
          { label: "Rate Limit Hits", value: 3, icon: AlertTriangle, color: "text-purple-500" },
          { label: "Token Usage", value: stats.totalTokens, icon: Database, color: "text-slate-500" }
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i} className="p-4 flex flex-col justify-between h-24 bg-card border-border-theme">
              <Icon className={`w-4 h-4 ${kpi.color}`} />
              <div>
                <span className="text-[8px] font-black text-muted uppercase tracking-widest block">{kpi.label}</span>
                <h4 className="text-lg font-black text-primary mt-0.5 leading-none">{kpi.value}</h4>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Trend Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <Card className="lg:col-span-2 bg-card border-border-theme p-6 space-y-4">
          <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Requests per hour</h3>
          <div className="h-44 w-full relative">
            <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="area-requests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />
              <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />
              
              <path d={getSvgPath(requestsPerHour, 500, 200, 250, true)} fill="url(#area-requests)" />
              <path d={getSvgPath(requestsPerHour, 500, 200, 250, false)} fill="none" stroke="#3B82F6" strokeWidth="3" />
            </svg>
            <div className="absolute bottom-2 left-2 text-[10px] font-bold text-slate-400">12 Hours Ago</div>
            <div className="absolute bottom-2 right-2 text-[10px] font-bold text-slate-400">Current Hour</div>
          </div>
        </Card>

        {/* Requests by Feature Ratio (SVG Pie Chart / CSS breakdown) */}
        <Card className="bg-card border-border-theme p-6 space-y-4">
          <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Requests By Feature</h3>
          <div className="space-y-3 pt-2 text-xs font-semibold text-muted">
            {[
              { label: "Study Notes", percentage: 22, color: "bg-blue-500" },
              { label: "AI Tutor Chat", percentage: 44, color: "bg-purple-500" },
              { label: "Interactive Quiz", percentage: 20, color: "bg-green-500" },
              { label: "Mock Exam Papers", percentage: 14, color: "bg-yellow-500" }
            ].map((f, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{f.label}</span>
                  <span className="text-primary">{f.percentage}%</span>
                </div>
                <div className="w-full bg-bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${f.color} rounded-full`} style={{ width: `${f.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* Feature statistics Grid */}
      <Card className="bg-card border-border-theme p-0 overflow-hidden">
        <div className="p-4 border-b border-border-theme">
          <h3 className="text-xs font-black text-primary uppercase tracking-widest">Model Operations Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                <th className="p-4">Feature Layer</th>
                <th className="p-4 text-center">Requests</th>
                <th className="p-4 text-center">Success Rate</th>
                <th className="p-4 text-center">Avg Response Time</th>
                <th className="p-4 text-right">Tokens Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-theme font-semibold text-primary">
              {featuresList.map((f, i) => (
                <tr key={i} className="hover:bg-bg-secondary/40 transition-colors">
                  <td className="p-4 font-bold text-primary">{f.name}</td>
                  <td className="p-4 text-center">{f.requests}</td>
                  <td className="p-4 text-center text-green-500">{f.successRate}%</td>
                  <td className="p-4 text-center font-mono text-slate-500">{f.latency}</td>
                  <td className="p-4 text-right font-mono text-slate-500">{f.tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
