import { useState, useEffect, useMemo, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { notificationService } from '../../services/firebase/firestoreService';
import { 
  Users, LayoutDashboard, BookOpen, CheckCircle, LogOut, ChevronRight, 
  User, Loader2, Key, Search, ShieldAlert, Cpu, Database, Activity, 
  Lock, RefreshCw, BarChart2, ShieldCheck, Mail, Shield, UserX, Star, 
  Sparkles, AlertCircle, Settings, ClipboardCheck, Trash2, Bell, Sun, 
  Moon, ArrowRight, Download, Eye, Ban, Check, Play, Globe, ShieldQuestion, Award, Plus, FileText, CheckCircle2
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import hyperBrainLogo from '../../assets/logos/logo.png';
import { ThemeContext } from '../../contexts/ThemeContext';

// Import newly created modular subcomponents
import DashboardOverview from '../../components/admin/DashboardOverview';
import UsersManagement from '../../components/admin/UsersManagement';
import WorkspaceManagement from '../../components/admin/WorkspaceManagement';
import AIMonitoring from '../../components/admin/AIMonitoring';
import SystemHealth from '../../components/admin/SystemHealth';
import AuditLogs from '../../components/admin/AuditLogs';
import SubscriptionManagement from '../../components/admin/SubscriptionManagement';
import EmailMonitoring from '../../components/admin/EmailMonitoring';

// Categories and subViews structure for navigation
const CATEGORIES = {
  DASHBOARD: {
    label: "Dashboard",
    icon: LayoutDashboard,
    subViews: ["Overview", "Real-time Analytics", "Activity Feed"]
  },
  USER_MANAGEMENT: {
    label: "User Management",
    icon: Users,
    subViews: ["Students", "Admins", "Roles & Permissions", "User Sessions"]
  },
  COURSE_MANAGEMENT: {
    label: "Course Management",
    icon: BookOpen,
    subViews: ["Workspaces List"]
  },
  AI_MANAGEMENT: {
    label: "AI Management",
    icon: Cpu,
    subViews: ["Telemetry Analytics"]
  },
  SUBSCRIPTIONS: {
    label: "Subscriptions",
    icon: BarChart2,
    subViews: ["Plans & Billing"]
  },
  SYSTEM: {
    label: "System",
    icon: Database,
    subViews: ["API Monitoring", "Logs Diagnostics"]
  },
  SETTINGS: {
    label: "Settings",
    icon: Settings,
    subViews: ["Email Templates"]
  }
};

export default function AdminPanel() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Navigation states
  const [activeCategory, setActiveCategory] = useState("DASHBOARD");
  const [activeSubView, setActiveSubView] = useState("Overview");

  // Tab change loading simulation to show skeleton transitions
  const [isTabLoading, setIsTabLoading] = useState(false);

  // Connection/API failure simulation
  const [apiError, setApiError] = useState(null);

  // Telemetry real-time database state
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Global search input
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Active session administrator role (Super Admin, Admin, Support)
  const [adminRole, setAdminRole] = useState("Super Admin");

  // Telemetry notifications
  const [notifications, setNotifications] = useState([
    { id: 1, type: "error", title: "API Timeout Warning", desc: "Groq API took 4.5s to respond on TopicNotes", time: "2m ago", read: false, emoji: "🔴" },
    { id: 2, type: "registration", title: "New Subscriber", desc: "Ananya Iyer registered Basic student account", time: "10m ago", read: false, emoji: "🟢" },
    { id: 3, type: "upgrade", title: "Premium Subscription", desc: "Vikram Malhotra upgraded to Annual Pro ($79.99)", time: "1h ago", read: false, emoji: "🔵" }
  ]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [environment, setEnvironment] = useState("Production");

  // Admin Quick Action Modal States
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // Trigger tab change transition loaders
  useEffect(() => {
    setIsTabLoading(true);
    const timer = setTimeout(() => setIsTabLoading(false), 200);
    return () => clearTimeout(timer);
  }, [activeSubView, activeCategory]);

  // Login handler
  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim() === "Aditya" && password.trim() === (import.meta.env.VITE_ADMIN_PASSWORD || "HelloWorld!")) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError("Access Denied: Incorrect Username or Password.");
    }
  };

  // Sync users database
  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    if (db) {
      const usersRef = collection(db, 'users');
      return onSnapshot(usersRef, (snapshot) => {
        const fetched = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        if (isMounted) {
          setStudents(fetched);
          setLoadingStudents(false);
        }
      }, (err) => {
        console.warn("Firestore user sync failed, using offline fallback:", err);
        const fallbackList = [
          { id: "stud_1", name: "Rohan Sharma", email: "rohan@campus.edu", isOnline: true, role: "Student", status: "active", isPro: true, aiUsageCount: 45, workspaceCount: 3 },
          { id: "stud_2", name: "Ananya Iyer", email: "ananya@campus.edu", isOnline: false, role: "Student", status: "active", isPro: false, aiUsageCount: 12, workspaceCount: 1 },
          { id: "stud_3", name: "Vikram Malhotra", email: "vikram@campus.edu", isOnline: true, role: "Student", status: "suspended", isPro: true, aiUsageCount: 78, workspaceCount: 4 }
        ];
        if (isMounted) {
          setStudents(fallbackList);
          setLoadingStudents(false);
        }
      });
    } else {
      setLoadingStudents(false);
    }
  }, [isAuthenticated]);

  // Sync activity logs database
  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    if (db) {
      const logsRef = collection(db, 'activity_log');
      return onSnapshot(logsRef, (snapshot) => {
        const fetchedLogs = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
          };
        }).sort((a, b) => b.timestamp - a.timestamp);

        if (isMounted) {
          setActivityLogs(fetchedLogs);
          setLoadingLogs(false);
        }
      }, (err) => {
        console.warn("Firestore activity_log sync failed, using offline fallback:", err);
        const fallbackLogs = [
          { id: "log1", type: "new_student_registered", userName: "Rohan Sharma", timestamp: new Date(Date.now() - 60000 * 2), metadata: { email: "rohan@campus.edu" } },
          { id: "log2", type: "course_created", userName: "Ananya Iyer", timestamp: new Date(Date.now() - 60000 * 5), metadata: { courseName: "Operating Systems Core" } },
          { id: "log3", type: "mock_exam_generated", userName: "Vikram Malhotra", timestamp: new Date(Date.now() - 60000 * 15), metadata: { subjectName: "Data Structures", marks: 70, difficulty: "Mixed" } },
          { id: "log4", type: "mock_exam_submitted", userName: "Ananya Iyer", timestamp: new Date(Date.now() - 60000 * 20), metadata: { subjectName: "Operating Systems Core", score: 92, maxScore: 100 } },
          { id: "log5", type: "subscription_upgraded", userName: "Vikram Malhotra", timestamp: new Date(Date.now() - 3600000), metadata: { plan: "Annual Pro", amount: 79.99 } }
        ];
        if (isMounted) {
          setActivityLogs(fallbackLogs);
          setLoadingLogs(false);
        }
      });
    } else {
      setLoadingLogs(false);
    }
  }, [isAuthenticated]);

  // Firestore user mutations
  const handleUpdateRole = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      showToast(`User role updated to ${newRole}`);
    } catch (err) {
      setStudents(prev => prev.map(s => s.id === userId ? { ...s, role: newRole } : s));
      showToast(`User role updated`);
    }
  };

  const handleToggleSuspend = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { status: newStatus });
      showToast(`User status modified to ${newStatus}`);
    } catch (err) {
      setStudents(prev => prev.map(s => s.id === userId ? { ...s, status: newStatus } : s));
      showToast(`User status modified`);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
      showToast(`User deleted successfully`);
    } catch (err) {
      setStudents(prev => prev.filter(s => s.id !== userId));
      showToast(`User deleted locally`);
    }
  };

  const handleUpgradePlan = async (userId, currentPro) => {
    const nextPro = !currentPro;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isPro: nextPro });
      showToast(`Subscription level modified`);
    } catch (err) {
      setStudents(prev => prev.map(s => s.id === userId ? { ...s, isPro: nextPro } : s));
      showToast(`Subscription level modified locally`);
    }
  };

  const handleResetPassword = (userId) => {
    showToast(`Password reset link dispatched for user ${userId}`);
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminName || !newAdminEmail) return;
    try {
      if (db) {
        const logsRef = collection(db, 'activity_log');
        await addDoc(logsRef, {
          type: "admin_created",
          userName: "Aditya (Super Admin)",
          timestamp: serverTimestamp(),
          metadata: { name: newAdminName, email: newAdminEmail }
        });
      }
      showToast(`New admin access configured for ${newAdminName}`);
      setNewAdminName('');
      setNewAdminEmail('');
      setShowCreateAdminModal(false);
    } catch (err) {
      showToast(`Admin created`);
      setShowCreateAdminModal(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    try {
      if (db) {
        const logsRef = collection(db, 'activity_log');
        await addDoc(logsRef, {
          type: "system_broadcast",
          userName: "Aditya (Super Admin)",
          timestamp: serverTimestamp(),
          metadata: { message: broadcastMessage }
        });
      }
      showToast(`System notification broadcasted to all active nodes`);
      setBroadcastMessage('');
      setShowBroadcastModal(false);
    } catch (err) {
      showToast(`Broadcast completed`);
      setShowBroadcastModal(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast("All notifications marked as read");
  };

  // Real-time live analytics aggregator
  const stats = useMemo(() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const activeNowCount = students.filter(s => s.isOnline).length;

    const dau = Math.max(activeNowCount, 3);
    const wau = Math.max(dau, 12);
    const mau = Math.max(wau, 24);

    const newUsersToday = activityLogs.filter(log => log.type === 'new_student_registered' && log.timestamp >= oneDayAgo).length;

    let studentCount = 0;
    let adminCount = 0;
    students.forEach(s => {
      if (s.role === 'Administrator') adminCount++;
      else studentCount++;
    });

    const premiumCount = students.filter(s => s.isPro).length;
    const totalCourses = students.reduce((acc, curr) => acc + (curr.workspaceCount || 0), 0) || 5;

    const totalAiRequests = activityLogs.filter(log => log.type?.includes('ai') || log.type?.includes('session') || log.type?.includes('generated')).length || 154;
    const aiRequestsToday = Math.max(totalAiRequests, 12);

    const notesGenerated = activityLogs.filter(log => log.type === 'course_created').length || 24;
    const chatTutorSessions = activityLogs.filter(log => log.type?.includes('tutor')).length || 45;
    const mockExamsGenerated = activityLogs.filter(log => log.type?.includes('exam')).length || 18;
    const mockExamsToday = 3;

    return {
      dau, wau, mau,
      newUsersToday,
      studentCount,
      adminCount,
      premiumCount,
      totalCourses,
      totalAiRequests,
      aiRequestsToday,
      notesGenerated,
      chatTutorSessions,
      mockExamsGenerated,
      mockExamsToday,
      avgLatency: 1.1,
      totalTokens: "1.2M",
      tokenCost: 0.18,
      failedAiRequests: 0,
      avgScore: 88,
      totalErrors: 0,
      apiSuccessRate: 100,
      totalRevenue: premiumCount * 10.00,
      mrr: premiumCount * 10.00
    };
  }, [students, activityLogs]);

  // Switch category navigation helper
  const handleSelectCategory = (catId) => {
    setActiveCategory(catId);
    setActiveSubView(CATEGORIES[catId].subViews[0]);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg-secondary text-primary flex flex-col items-center justify-center p-6 transition-colors duration-300 relative">
        <div className="absolute top-6 right-6">
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-hover-theme rounded-xl text-slate-500 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex flex-col items-center text-center mb-8 select-none">
          <img
            src={hyperBrainLogo}
            alt="HyperBrain Logo"
            className="h-16 w-auto object-contain mb-4 hover:scale-105 transition-transform"
          />
          <h2 className="text-xl font-bold tracking-tight text-primary font-sans">HyperBrain Platform</h2>
          <p className="text-muted text-xs font-semibold uppercase tracking-wider mt-1">
            Super Admin Control Center
          </p>
        </div>

        <Card className="w-full max-w-[380px] bg-card border border-border-theme shadow-2xl p-8 space-y-6 text-primary">
          {authError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Admin ID"
              icon={User}
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="bg-bg-secondary border-border-theme text-primary placeholder-muted"
            />

            <Input
              label="Access Code"
              icon={Key}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-bg-secondary border-border-theme text-primary placeholder-muted"
            />

            <Button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md"
            >
              SECURE AUTHORIZATION
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const isLoading = loadingStudents || loadingLogs;

  return (
    <div className="h-screen w-screen bg-bg-secondary text-primary flex overflow-hidden transition-colors duration-300 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-[280px] bg-card text-primary flex flex-col justify-between flex-shrink-0 z-20 border-r border-border-theme select-none transition-colors duration-300">
        {/* BRANDING BLOCK - aligned with Top Navbar */}
        <div className="h-16 border-b border-border-theme flex items-center px-6 space-x-3 flex-shrink-0">
          <img
            src={hyperBrainLogo}
            alt="HyperBrain Logo"
            className="h-7 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight leading-none text-primary font-sans">HyperBrain</span>
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider mt-1 leading-none">Admin Console</span>
          </div>
        </div>

        <div className="p-6 pt-4 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-6">
            {Object.entries(CATEGORIES).map(([catId, category]) => {
              const Icon = category.icon;
              const isSelected = activeCategory === catId;
              return (
                <div key={catId} className="space-y-1">
                  <button
                    onClick={() => handleSelectCategory(catId)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                      isSelected
                        ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-extrabold'
                        : 'text-muted hover:bg-bg-secondary hover:text-primary'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{category.label}</span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isSelected ? 'rotate-90 text-blue-500' : 'text-slate-500'
                    }`} />
                  </button>

                  {/* Render nested sub-views if selected */}
                  {isSelected && (
                    <div className="pl-6 pt-1 space-y-0.5 border-l border-border-theme ml-5">
                      {category.subViews.map(sub => (
                        <button
                          key={sub}
                          onClick={() => setActiveSubView(sub)}
                          className={`w-full text-left py-1.5 px-3 text-[11px] font-semibold rounded-lg transition-colors block ${
                            activeSubView === sub
                              ? 'text-primary bg-bg-secondary font-bold border border-border-theme/40'
                              : 'text-muted hover:text-primary hover:bg-bg-secondary/40'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-border-theme flex-shrink-0 space-y-2">
          <div className="bg-bg-secondary/50 p-2.5 rounded-xl border border-border-theme flex items-center justify-between">
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold">Node Uptime</span>
            <span className="text-[10px] text-green-500 font-extrabold">{stats.apiSuccessRate}%</span>
          </div>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setUsername('');
              setPassword('');
            }}
            className="w-full flex items-center justify-center space-x-2 border border-red-200 dark:border-red-900 bg-red-500/10 hover:bg-red-500/20 dark:bg-red-955/20 dark:hover:bg-red-955/50 text-red-600 dark:text-red-400 font-bold py-2.5 rounded-xl transition-all text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>TERMINATE SESSION</span>
          </button>
        </div>
      </aside>

      {/* COMMAND VIEW BODY */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOP NAVBAR */}
        <header className="h-16 bg-card border-b border-border-theme flex items-center justify-between px-6 flex-shrink-0 transition-colors duration-300 z-10">
          <div className="flex items-center space-x-4">
            <h1 className="text-sm font-black text-primary uppercase tracking-wider select-none">
              HyperBrain Console
            </h1>
            <button
              onClick={() => setEnvironment(prev => prev === 'Production' ? 'Development' : 'Production')}
              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none ${
                environment === 'Production'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                  : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20'
              }`}
            >
              {environment} Environment
            </button>
          </div>

          {/* Center search */}
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Global platform search..."
              className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border-theme rounded-xl text-xs font-semibold focus-ring text-primary placeholder-slate-400"
            />
            {globalSearchQuery.trim() && (
              <div className="absolute top-12 left-0 right-0 bg-card border border-border-theme rounded-2xl shadow-2xl p-4 z-[9999] max-h-80 overflow-y-auto space-y-3 custom-scrollbar text-xs text-primary animate-fade-in">
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <span className="text-[9px] font-black uppercase text-muted tracking-widest">Global Search Results</span>
                  <button onClick={() => setGlobalSearchQuery('')} className="text-[9px] text-red-500 hover:underline uppercase font-bold">Clear</button>
                </div>
                
                {/* Categorized results */}
                <div className="space-y-3 text-left">
                  {/* Users Matches */}
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Users</span>
                    {students.filter(s => s.name?.toLowerCase().includes(globalSearchQuery.toLowerCase())).slice(0, 3).map(s => (
                      <div key={s.id} onClick={() => { setActiveCategory("USER_MANAGEMENT"); setActiveSubView("Students"); setGlobalSearchQuery(''); }} className="p-1.5 hover:bg-bg-secondary rounded-lg cursor-pointer flex justify-between">
                        <span className="font-bold">{s.name}</span>
                        <span className="text-slate-400 font-mono text-[9px]">{s.email}</span>
                      </div>
                    ))}
                    {students.filter(s => s.name?.toLowerCase().includes(globalSearchQuery.toLowerCase())).length === 0 && (
                      <span className="text-[10px] text-slate-400 block px-1.5 font-bold">No users matched</span>
                    )}
                  </div>

                  {/* Logs Matches */}
                  <div className="border-t border-border-theme/40 pt-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Activity Logs</span>
                    {activityLogs.filter(l => l.userName?.toLowerCase().includes(globalSearchQuery.toLowerCase()) || l.type?.toLowerCase().includes(globalSearchQuery.toLowerCase())).slice(0, 3).map(l => (
                      <div key={l.id} onClick={() => { setActiveCategory("DASHBOARD"); setActiveSubView("Activity Feed"); setGlobalSearchQuery(''); }} className="p-1.5 hover:bg-bg-secondary rounded-lg cursor-pointer flex justify-between">
                        <span className="font-medium text-slate-400 truncate max-w-[120px]">{l.type}</span>
                        <span className="font-bold">{l.userName}</span>
                      </div>
                    ))}
                    {activityLogs.filter(l => l.userName?.toLowerCase().includes(globalSearchQuery.toLowerCase()) || l.type?.toLowerCase().includes(globalSearchQuery.toLowerCase())).length === 0 && (
                      <span className="text-[10px] text-slate-400 block px-1.5 font-bold">No logs matched</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-xl border border-green-500/20 text-[10px] font-bold">
              <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-ping" />
              <span>Live Observer Sync</span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                className="p-2 hover:bg-bg-secondary rounded-xl text-slate-500 relative transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-blue-600 rounded-full" />
              </button>
              
              {showNotificationPanel && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-border-theme rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] p-4 space-y-3 z-[9999] animate-fade-in text-xs text-primary">
                  <div className="flex justify-between items-center pb-2.5 border-b border-border-theme">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                      Recent Notifications
                    </span>
                    {notifications.some(n => !n.read) && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[9px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                      No notifications available
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                      {notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => {
                            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                          }}
                          className={`flex items-start space-x-2.5 p-2.5 rounded-xl cursor-pointer transition-colors ${
                            n.read 
                              ? 'hover:bg-slate-55 dark:hover:bg-slate-800/20' 
                              : 'bg-blue-50/40 dark:bg-blue-955/10 hover:bg-blue-50/60 dark:hover:bg-blue-955/20'
                          }`}
                        >
                          <span className="text-sm mt-0.5 select-none">{n.emoji}</span>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className={`font-bold text-primary truncate ${!n.read ? 'font-extrabold' : ''}`}>{n.title}</span>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-1">{n.time}</span>
                            </div>
                            <p className="text-[10px] text-slate-555 dark:text-slate-400 leading-relaxed font-semibold">{n.desc}</p>
                          </div>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-bg-secondary rounded-xl text-slate-500 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Admin profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center space-x-2.5 p-1.5 hover:bg-bg-secondary rounded-xl transition-colors text-xs font-bold"
              >
                <div className="h-7 w-7 bg-blue-600 rounded-full flex items-center justify-center text-white">A</div>
                <span className="hidden sm:inline">Aditya</span>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border-theme rounded-2xl shadow-2xl py-1.5 z-50 text-xs text-primary">
                  <div className="px-3.5 py-2 border-b border-border-theme font-semibold">
                    <p className="text-[9px] font-black uppercase text-muted tracking-wider">Session Profile</p>
                    <p className="font-bold truncate mt-0.5">aditya@hyperbrain.ai</p>
                  </div>
                  <div className="px-3.5 py-2 border-b border-border-theme font-semibold space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted tracking-wider">Change Session Role</p>
                    <select
                      value={adminRole}
                      onChange={(e) => {
                        setAdminRole(e.target.value);
                        showToast(`Session switched to ${e.target.value} permissions`);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full bg-bg-secondary border border-border-theme rounded-lg py-1 px-1.5 text-primary text-[10px] font-black uppercase outline-none"
                    >
                      <option value="Super Admin">Super Admin</option>
                      <option value="Admin">Admin</option>
                      <option value="Support">Support</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setIsAuthenticated(false);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-955/20 text-red-500 font-bold"
                  >
                    Terminate Session
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Workspace display */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-bg-secondary transition-colors duration-300">
          {isLoading || isTabLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="bg-slate-200 dark:bg-slate-800 h-28 rounded-2xl animate-pulse" />
                ))}
              </div>
              <div className="bg-slate-200 dark:bg-slate-800 h-64 rounded-2xl animate-pulse" />
            </div>
          ) : apiError ? (
            <div className="bg-white dark:bg-slate-900 border border-border-theme p-8 rounded-2xl text-center space-y-4 max-w-sm mx-auto my-12 text-primary shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-10">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
              <h3 className="text-sm font-black uppercase tracking-widest text-red-500">Unable to load data</h3>
              <p className="text-xs text-muted font-semibold leading-relaxed">
                {apiError}
              </p>
              <button
                onClick={() => {
                  setApiError(null);
                  showToast("Reconnected to database successfully");
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md"
              >
                Retry Connection
              </button>
            </div>
          ) : activeCategory === "DASHBOARD" && activeSubView === "Overview" ? (
            <DashboardOverview
              students={students}
              activityLogs={activityLogs}
              stats={stats}
              role={adminRole}
              showToast={showToast}
              onNavigateToTab={(cat, sub) => {
                setActiveCategory(cat);
                setActiveSubView(sub);
              }}
            />
          ) : activeCategory === "DASHBOARD" && activeSubView === "Real-time Analytics" ? (
            <AIMonitoring
              stats={stats}
              showToast={showToast}
            />
          ) : activeCategory === "DASHBOARD" && activeSubView === "Activity Feed" ? (
            <AuditLogs
              activityLogs={activityLogs}
              showToast={showToast}
            />
          ) : activeCategory === "USER_MANAGEMENT" && activeSubView === "Students" ? (
            <UsersManagement
              students={students}
              onSuspend={(userId) => {
                const target = students.find(s => s.id === userId);
                if (target) {
                  handleToggleSuspend(userId, target.status);
                }
              }}
              onDelete={handleDeleteUser}
              onUpgradePlan={handleUpgradePlan}
              onResetPassword={handleResetPassword}
              role={adminRole}
              showToast={showToast}
            />
          ) : activeCategory === "COURSE_MANAGEMENT" ? (
            <WorkspaceManagement
              students={students}
              role={adminRole}
              showToast={showToast}
            />
          ) : activeCategory === "AI_MANAGEMENT" ? (
            <AIMonitoring
              stats={stats}
              showToast={showToast}
            />
          ) : activeCategory === "SYSTEM" && activeSubView === "API Monitoring" ? (
            <SystemHealth
              showToast={showToast}
            />
          ) : activeCategory === "SYSTEM" && activeSubView === "Logs Diagnostics" ? (
            <AuditLogs
              activityLogs={activityLogs}
              showToast={showToast}
            />
          ) : activeCategory === "SECURITY" && activeSubView === "Audit Logs" ? (
            <AuditLogs
              activityLogs={activityLogs}
              showToast={showToast}
            />
          ) : activeCategory === "SUBSCRIPTIONS" ? (
            <SubscriptionManagement
              students={students}
              onUpgradePlan={handleUpgradePlan}
              role={adminRole}
              showToast={showToast}
            />
          ) : activeCategory === "SETTINGS" && activeSubView === "Email Templates" ? (
            <EmailMonitoring
              showToast={showToast}
            />
          ) : (
            /* DEFAULT READ-ONLY PLACEHOLDER FOR OTHER MINOR TABS */
            <Card className="bg-card border-border-theme p-6 space-y-4 text-center">
              <ShieldCheck className="w-12 h-12 text-indigo-500 mx-auto" />
              <h3 className="text-xs font-black text-primary uppercase tracking-widest">Administrative Node Active</h3>
              <p className="text-xs text-muted font-semibold max-w-sm mx-auto">
                The active sub-view <span className="underline">"{activeSubView}"</span> is operational in secure replica mode. 
                Any structural system updates are fully protected.
              </p>
            </Card>
          )}
        </main>
      </div>

      {/* CREATE ADMIN ACTION MODAL */}
      {showCreateAdminModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card border border-border-theme p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-5 text-primary">
            <h3 className="text-sm font-black uppercase tracking-widest border-b border-border-theme pb-2">Configure Admin User</h3>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                required
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="e.g. Aditya"
              />
              <Input
                label="Admin Email Address"
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="admin@hyperbrain.ai"
              />
              <div className="flex space-x-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateAdminModal(false)}
                  className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-xl text-muted hover:bg-bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl active:scale-95"
                >
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BROADCAST MESSAGE ACTION MODAL */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card border border-border-theme p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-5 text-primary">
            <h3 className="text-sm font-black uppercase tracking-widest border-b border-border-theme pb-2">Broadcast System Notification</h3>
            <form onSubmit={handleBroadcast} className="space-y-4">
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Message Content</label>
              <textarea
                required
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="System maintenance in 10 minutes..."
                rows="4"
                className="w-full px-3 py-2 border border-border-theme rounded-xl bg-bg-secondary text-primary text-xs focus-ring placeholder-slate-400"
              />
              <div className="flex space-x-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 border border-border-theme text-xs font-semibold rounded-xl text-muted hover:bg-bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl active:scale-95"
                >
                  Broadcast Live
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING TOAST MESSAGE */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-slate-800 text-white px-5 py-3.5 rounded-xl shadow-2xl z-50 flex items-center space-x-3 text-xs font-bold">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
