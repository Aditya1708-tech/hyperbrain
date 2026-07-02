import React, { useMemo } from 'react';
import { 
  Users, Activity, BookOpen, Cpu, BarChart2, Database, ShieldCheck, ShieldAlert,
  ArrowUpRight, Plus, Bell, RefreshCw, FileText
} from 'lucide-react';
import Card from '../common/Card';

export default function DashboardOverview({
  students,
  activityLogs,
  stats,
  role,
  showToast,
  onNavigateToTab
}) {
  // Mock data for trends to build beautiful SVG charts
  const userGrowthData = [12, 19, 32, 45, 64, 78, 95];
  const aiRequestsData = [85, 120, 95, 140, 210, 185, 240];
  const revenueData = [120, 240, 450, 600, 780, 950, 1200];
  const workspaceData = [3, 8, 12, 19, 25, 30, 42];

  // Helper to generate SVG Path for line/area chart
  const getSvgPath = (data, width, height, max, isArea = false) => {
    if (data.length === 0) return '';
    const points = data.map((val, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - (val / max) * height * 0.8 - height * 0.1;
      return `${x},${y}`;
    });
    
    if (isArea) {
      return `M0,${height} L${points.join(' L')} L${width},${height} Z`;
    }
    return `M${points.join(' L')}`;
  };

  const currentRoleLabel = role || "Super Admin";

  return (
    <div className="space-y-6">
      
      {/* Role Banner */}
      <div className="p-4 bg-blue-600/10 border border-blue-600/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-between text-xs font-bold">
        <span>Authorized Session Role: <span className="underline">{currentRoleLabel}</span></span>
        <span className="text-[10px] uppercase bg-blue-600 text-white px-2 py-0.5 rounded-full">Secure Mode</span>
      </div>

      {/* 1. TOP KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: students.length, change: "+14% vs last week", icon: Users, color: "text-blue-500" },
          { label: "Active Users Today", value: stats.dau, change: "+8% vs yesterday", icon: Activity, color: "text-green-500" },
          { label: "Total Workspaces", value: stats.totalCourses, change: "+12% workspace creation", icon: BookOpen, color: "text-indigo-500" },
          { label: "AI Requests Today", value: stats.aiRequestsToday, change: "Latency avg: 1.1s", icon: Cpu, color: "text-purple-500" },
          { label: "Failed AI Requests", value: stats.failedAiRequests, change: `${stats.apiSuccessRate}% success rate`, icon: ShieldAlert, color: "text-red-500" },
          { label: "Active Subscriptions", value: stats.premiumCount, change: `$10.00 avg per user`, icon: BarChart2, color: "text-emerald-500" },
          { label: "Monthly Revenue", value: `$${stats.mrr}`, change: "+18% growth", icon: BarChart2, color: "text-teal-500" },
          { label: "Storage Usage", value: "24.5 GB", change: "Quota limit: 100 GB", icon: Database, color: "text-slate-500" }
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i} className="p-4 flex flex-col justify-between h-28 bg-card border-border-theme hover:scale-[1.01] transition-transform">
              <div className="flex justify-between items-start">
                <Icon className={`w-5 h-5 ${kpi.color}`} />
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-wider font-mono">{kpi.change}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-muted uppercase tracking-widest block">{kpi.label}</span>
                <h3 className="text-2xl font-black text-primary mt-0.5 leading-none">{kpi.value}</h3>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 2. TREND CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* User Growth & Revenue */}
        <Card className="bg-card border-border-theme p-6 space-y-4">
          <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">User Growth & Revenue Trend</h3>
          <div className="h-48 w-full relative">
            <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="area-users" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Gridlines */}
              <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />
              <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />
              
              {/* Area path */}
              <path d={getSvgPath(userGrowthData, 500, 200, 100, true)} fill="url(#area-users)" />
              {/* Line path */}
              <path d={getSvgPath(userGrowthData, 500, 200, 100, false)} fill="none" stroke="#3B82F6" strokeWidth="3" />
            </svg>
            <div className="absolute bottom-2 left-2 text-[10px] font-bold text-slate-400">7 Days Ago</div>
            <div className="absolute bottom-2 right-2 text-[10px] font-bold text-slate-400">Today</div>
          </div>
          <div className="flex justify-between text-xs text-muted font-bold">
            <span>Student registrations: +95 total</span>
            <span className="text-blue-500 font-extrabold">Active Growth trajectory</span>
          </div>
        </Card>

        {/* AI requests trend */}
        <Card className="bg-card border-border-theme p-6 space-y-4">
          <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">AI Request Trend</h3>
          <div className="h-48 w-full relative">
            <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="area-ai" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A855F7" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#A855F7" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />
              <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4" />
              
              <path d={getSvgPath(aiRequestsData, 500, 200, 300, true)} fill="url(#area-ai)" />
              <path d={getSvgPath(aiRequestsData, 500, 200, 300, false)} fill="none" stroke="#A855F7" strokeWidth="3" />
            </svg>
            <div className="absolute bottom-2 left-2 text-[10px] font-bold text-slate-400 font-sans">7 Days Ago</div>
            <div className="absolute bottom-2 right-2 text-[10px] font-bold text-slate-400 font-sans">Today</div>
          </div>
          <div className="flex justify-between text-xs text-muted font-bold">
            <span>Avg requests/day: 154 calls</span>
            <span className="text-purple-500 font-extrabold">Peak activity: 240 requests</span>
          </div>
        </Card>

      </div>

      {/* 3. RECENT ACTIVITY FEED */}
      <Card className="bg-card border-border-theme p-6 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-border-theme">
          <h3 className="text-xs font-black text-primary uppercase tracking-widest">Real-time Telemetry activity feed</h3>
          <span className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Listening Live</span>
        </div>
        <div className="space-y-4 text-xs font-semibold text-muted max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
          {activityLogs.slice(0, 10).map((log) => (
            <div key={log.id} className="flex justify-between items-center border-b border-border-theme/40 pb-3 hover:bg-bg-secondary/40 transition-colors rounded px-2">
              <div className="flex items-center space-x-3 py-1">
                <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                  log.type.includes('error') || log.type.includes('failed') ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
                }`} />
                <div>
                  <span className="text-primary font-extrabold">{log.userName}</span>
                  <span className="ml-2 font-normal text-muted">
                    {log.type === 'new_student_registered' && `registered email ${log.metadata?.email}`}
                    {log.type === 'course_created' && `mapped Course: "${log.metadata?.courseName}"`}
                    {log.type === 'mock_exam_generated' && `configured exam setup: ${log.metadata?.marks} marks (${log.metadata?.difficulty})`}
                    {log.type === 'mock_exam_submitted' && `scored ${log.metadata?.score}/${log.metadata?.maxScore} in exam evaluation`}
                    {log.type === 'ai_tutor_session_started' && `processed AI prompt for topic: "${log.metadata?.topicName}" (${log.metadata?.latencyMs}ms)`}
                    {log.type === 'subscription_upgraded' && `upgraded subscription plan to Premium Pro`}
                    {log.type === 'payment_completed' && `completed transaction of $${log.metadata?.amount}`}
                    {log.type === 'system_broadcast' && `broadcasted server-wide notification: "${log.metadata?.message}"`}
                    {log.type === 'admin_created' && `created new administrator: ${log.metadata?.name}`}
                  </span>
                </div>
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
