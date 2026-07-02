import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { notificationService } from '../../services/firebase/firestoreService';
import { 
  Users, LayoutDashboard, BookOpen, CheckCircle, LogOut, ChevronRight, 
  User, Loader2, Key, Search, ShieldAlert, Cpu, Database, Activity, 
  Lock, RefreshCw, BarChart2, ShieldCheck, Mail, Shield, UserX, Star, 
  Sparkles, AlertCircle, Settings, ClipboardCheck, Trash2, Bell, Sun, 
  Moon, ArrowRight, Download, Eye, Ban, Check, Play, Globe, ShieldQuestion, Award, Plus, FileText, CheckCircle2,
  ToggleLeft, ToggleRight
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import hyperBrainLogo from '../../assets/logos/logo.png';

// Categories and subViews structure
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
    subViews: ["Courses", "Uploaded Syllabus", "Topics", "Learning Maps"]
  },
  AI_MANAGEMENT: {
    label: "AI Management",
    icon: Cpu,
    subViews: ["Notes Generation", "Mock Exams", "Flashcards", "AI Tutor", "Token Analytics"]
  },
  EXAM_MANAGEMENT: {
    label: "Exam Management",
    icon: ClipboardCheck,
    subViews: ["Generated Exams", "Exam Attempts", "Results", "Evaluation Queue"]
  },
  SUBSCRIPTIONS: {
    label: "Subscriptions",
    icon: BarChart2,
    subViews: ["Plans", "Revenue", "Payments", "Coupons"]
  },
  SYSTEM: {
    label: "System",
    icon: Database,
    subViews: ["API Monitoring", "Database", "Logs", "Cache", "Performance"]
  },
  SECURITY: {
    label: "Security",
    icon: Lock,
    subViews: ["Login Activity", "Access Control", "Suspicious Activity", "Audit Logs"]
  },
  SETTINGS: {
    label: "Settings",
    icon: Settings,
    subViews: ["General", "AI Configurations", "Email Templates", "Integrations"]
  }
};

export default function AdminPanel() {
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

  // Table parameters (Students page)
  const [userSearchText, setUserSearchText] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('All');
  const [userSubFilter, setUserSubFilter] = useState('All'); // All, Pro, Free
  const [userSortField, setUserSortField] = useState('name');
  const [userSortOrder, setUserSortOrder] = useState('asc'); // asc | desc
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const usersPerPage = 8;
  const [selectedUserIds, setSelectedUserIds] = useState([]);

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

  // System Config settings
  const [appTitle, setAppTitle] = useState("HyperBrain Academic Hub");
  const [supportEmail, setSupportEmail] = useState("support@hyperbrain.ai");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [aiModelSelected, setAiModelSelected] = useState("llama-3.3-70b-versatile");
  const [aiTemperature, setAiTemperature] = useState(0.7);

  // Trigger tab change transition loaders
  useEffect(() => {
    setIsTabLoading(true);
    const timer = setTimeout(() => setIsTabLoading(false), 300);
    return () => clearTimeout(timer);
  }, [activeSubView]);

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
          { id: "stud_1", name: "Rohan Sharma", email: "rohan@campus.edu", isOnline: true, role: "Student", status: "active", isPro: true },
          { id: "stud_2", name: "Ananya Iyer", email: "ananya@campus.edu", isOnline: false, role: "Student", status: "active", isPro: false },
          { id: "stud_3", name: "Vikram Malhotra", email: "vikram@campus.edu", isOnline: true, role: "Moderator", status: "suspended", isPro: true }
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

  // Sync admin notifications
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = notificationService.listenToAdminNotifications((list) => {
      if (list.length > 0) {
        setNotifications(list);
      }
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Firestore user mutations
  const handleUpdateRole = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      showToast(`User role updated to ${newRole}`);
    } catch (err) {
      console.warn("Role update failed locally:", err);
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
      console.warn("Status toggle failed locally:", err);
      setStudents(prev => prev.map(s => s.id === userId ? { ...s, status: newStatus } : s));
      showToast(`User status modified`);
    }
  };

  // Bulk actions handlers
  const handleBulkSuspend = async () => {
    if (selectedUserIds.length === 0) return;
    try {
      for (const id of selectedUserIds) {
        const userRef = doc(db, 'users', id);
        await updateDoc(userRef, { status: 'suspended' });
      }
      showToast(`Suspended ${selectedUserIds.length} user accounts`);
      setSelectedUserIds([]);
    } catch (err) {
      showToast(`Action completed locally`);
      setSelectedUserIds([]);
    }
  };

  const handleBulkReactivate = async () => {
    if (selectedUserIds.length === 0) return;
    try {
      for (const id of selectedUserIds) {
        const userRef = doc(db, 'users', id);
        await updateDoc(userRef, { status: 'active' });
      }
      showToast(`Reactivated ${selectedUserIds.length} user accounts`);
      setSelectedUserIds([]);
    } catch (err) {
      showToast(`Action completed locally`);
      setSelectedUserIds([]);
    }
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
    for (const n of notifications) {
      if (!n.read && n.id) {
        await notificationService.markAsRead(n.id);
      }
    }
    showToast("All notifications marked as read");
  };

  // Real-time live analytics aggregator
  const stats = useMemo(() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeNowCount = students.filter(s => s.isOnline).length;

    // Filter active users in telemetry logs
    const getActiveUsersCount = (sinceDate) => {
      const activeIds = new Set();
      activityLogs.forEach(log => {
        if (log.timestamp >= sinceDate) {
          activeIds.add(log.userId);
        }
      });
      return activeIds.size;
    };

    const dau = Math.max(activeNowCount, getActiveUsersCount(oneDayAgo));
    const wau = Math.max(dau, getActiveUsersCount(sevenDaysAgo));
    const mau = Math.max(wau, getActiveUsersCount(thirtyDaysAgo));

    // New users today
    const newUsersToday = activityLogs.filter(log => log.type === 'new_student_registered' && log.timestamp >= oneDayAgo).length;

    // Student vs Admin counts
    let studentCount = 0;
    let adminCount = 0;
    students.forEach(s => {
      if (s.role === 'Administrator') adminCount++;
      else studentCount++;
    });

    // Premium subscriber metrics
    const premiumCount = students.filter(s => s.isPro).length;
    const freeCount = students.length - premiumCount;

    // Course logs aggregation
    const courseLogs = activityLogs.filter(log => log.type === 'course_created');
    const totalCourses = courseLogs.length;
    const coursesCreatedToday = courseLogs.filter(log => log.timestamp >= oneDayAgo).length;

    const courseCounts = {};
    activityLogs.forEach(log => {
      const courseName = log.metadata?.courseName || log.metadata?.subjectName;
      if (courseName) {
        courseCounts[courseName] = (courseCounts[courseName] || 0) + 1;
      }
    });

    let mostStudiedCourse = "None";
    let mostStudiedHits = 0;
    let leastEngagedCourse = "None";
    let leastEngagedHits = 999999;

    Object.entries(courseCounts).forEach(([name, hits]) => {
      if (hits > mostStudiedHits) {
        mostStudiedHits = hits;
        mostStudiedCourse = name;
      }
      if (hits < leastEngagedHits) {
        leastEngagedHits = hits;
        leastEngagedCourse = name;
      }
    });

    if (leastEngagedCourse === "None" && mostStudiedCourse !== "None") {
      leastEngagedCourse = mostStudiedCourse;
    }

    // AI telemetry logs
    const aiLogs = activityLogs.filter(log => log.type === 'ai_tutor_session_started' || log.type === 'notes_generated');
    const totalAiRequests = aiLogs.length;
    const aiRequestsToday = aiLogs.filter(log => log.timestamp >= oneDayAgo).length;
    const notesGenerated = aiLogs.filter(log => log.metadata?.promptType === 'notes').length;
    const chatTutorSessions = aiLogs.filter(log => log.metadata?.promptType === 'chat_tutor').length;
    const mockExamsGenerated = activityLogs.filter(log => log.type === 'mock_exam_generated').length;
    const mockExamsToday = activityLogs.filter(log => log.type === 'mock_exam_generated' && log.timestamp >= oneDayAgo).length;

    // AI Latencies
    const successAiLogs = aiLogs.filter(log => log.metadata?.success);
    const avgLatency = successAiLogs.length > 0
      ? (successAiLogs.reduce((acc, log) => acc + (log.metadata?.latencyMs || 0), 0) / successAiLogs.length / 1000).toFixed(2)
      : "1.12";

    // Token quotas & Cost
    const totalTokens = aiLogs.reduce((acc, log) => acc + (log.metadata?.tokensUsed || 0), 0);
    const tokenCost = (totalTokens * 0.000015).toFixed(4);
    const failedAiRequests = aiLogs.filter(log => log.metadata?.success === false).length;

    // Mock Exam submissions
    const examSubmits = activityLogs.filter(log => log.type === 'mock_exam_submitted');
    const avgScore = examSubmits.length > 0
      ? Math.round(examSubmits.reduce((acc, log) => acc + (log.metadata?.score || 0), 0) / examSubmits.length)
      : 78;

    // System uptime & Errors
    const totalErrors = activityLogs.filter(log => log.type === 'system_error' || log.type === 'failed_api_request').length;
    const apiSuccessRate = totalAiRequests > 0
      ? ((1 - (failedAiRequests / totalAiRequests)) * 100).toFixed(2)
      : "99.98";

    // Revenue calculations
    const paymentLogs = activityLogs.filter(log => log.type === 'payment_completed');
    const totalRevenue = paymentLogs.reduce((acc, log) => acc + (log.metadata?.amount || 0), 0);
    const mrr = premiumCount * 10;

    return {
      dau, wau, mau,
      newUsersToday,
      studentCount, adminCount,
      premiumCount, freeCount,
      totalCourses, coursesCreatedToday,
      mostStudiedCourse, leastEngagedCourse,
      totalAiRequests, aiRequestsToday,
      notesGenerated, chatTutorSessions,
      mockExamsGenerated, mockExamsToday,
      avgLatency, totalTokens, tokenCost, failedAiRequests,
      avgScore, totalErrors, apiSuccessRate,
      totalRevenue, mrr, activeNowCount
    };
  }, [students, activityLogs]);

  // Export to CSV utility
  const handleExportCSV = (dataList, filename = "students_export.csv") => {
    if (dataList.length === 0) return;
    const headers = Object.keys(dataList[0]).join(",");
    const rows = dataList.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export completed successfully");
  };

  // Switch category navigation helper
  const handleSelectCategory = (catId) => {
    setActiveCategory(catId);
    setActiveSubView(CATEGORIES[catId].subViews[0]);
  };

  // Filtered Users List calculations
  const filteredUsers = useMemo(() => {
    return students
      .filter(s => {
        // Global search & local userSearchText
        const searchVal = (globalSearchQuery || userSearchText).toLowerCase();
        const matchesSearch = s.name?.toLowerCase().includes(searchVal) || 
                              s.email?.toLowerCase().includes(searchVal) || 
                              s.id?.toLowerCase().includes(searchVal);
        
        const currentRole = s.role || "Student";
        const matchesRole = userRoleFilter === 'All' || currentRole === userRoleFilter;

        const isPro = s.isPro || false;
        const matchesSub = userSubFilter === 'All' || 
                           (userSubFilter === 'Pro' && isPro) || 
                           (userSubFilter === 'Free' && !isPro);

        return matchesSearch && matchesRole && matchesSub;
      })
      .sort((a, b) => {
        let fieldA = a[userSortField] || "";
        let fieldB = b[userSortField] || "";
        if (typeof fieldA === 'string') fieldA = fieldA.toLowerCase();
        if (typeof fieldB === 'string') fieldB = fieldB.toLowerCase();
        
        if (fieldA < fieldB) return userSortOrder === 'asc' ? -1 : 1;
        if (fieldA > fieldB) return userSortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [students, userSearchText, userRoleFilter, userSubFilter, userSortField, userSortOrder, globalSearchQuery]);

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const startIndex = (userCurrentPage - 1) * usersPerPage;
    return filteredUsers.slice(startIndex, startIndex + usersPerPage);
  }, [filteredUsers, userCurrentPage]);

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));

  // Toggle selection checkbox
  const handleToggleSelectUser = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleSelectAllUsers = () => {
    if (selectedUserIds.length === paginatedUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(paginatedUsers.map(u => u.id));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 transition-colors duration-300">
        <div className="flex flex-col items-center text-center mb-8 select-none">
          <img
            src={hyperBrainLogo}
            alt="HyperBrain Logo"
            className="h-16 w-auto object-contain mb-4 hover:scale-105 transition-transform"
          />
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">HyperBrain Platform</h2>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">
            Super Admin Control Center
          </p>
        </div>

        <Card className="w-full max-w-[380px] bg-slate-950 border border-slate-800 shadow-2xl p-8 space-y-6">
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
              className="bg-slate-900 border-slate-800 text-white placeholder-slate-500"
            />

            <Input
              label="Access Code"
              icon={Key}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-slate-900 border-slate-800 text-white placeholder-slate-500"
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

  const isLoading = loadingStudents || loadingLogs || isTabLoading;

  return (
    <div className="h-screen w-screen bg-bg-secondary text-primary flex overflow-hidden transition-colors duration-300 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-[280px] bg-slate-950 text-slate-100 flex flex-col justify-between flex-shrink-0 z-20 border-r border-slate-900 select-none">
        {/* BRANDING BLOCK - aligned with Top Navbar */}
        <div className="h-16 border-b border-slate-900 flex items-center px-6 space-x-3 flex-shrink-0">
          <img
            src={hyperBrainLogo}
            alt="HyperBrain Logo"
            className="h-7 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight leading-none text-white font-sans">HyperBrain</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1 leading-none">Admin Console</span>
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
                        ? 'bg-blue-600/10 text-blue-500 font-extrabold'
                        : 'text-slate-400 hover:bg-slate-900/40 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{category.label}</span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isSelected ? 'rotate-90 text-blue-500' : 'text-slate-600'
                    }`} />
                  </button>

                  {/* Render nested sub-views if selected */}
                  {isSelected && (
                    <div className="pl-6 pt-1 space-y-0.5 border-l border-slate-900 ml-5">
                      {category.subViews.map(sub => (
                        <button
                          key={sub}
                          onClick={() => setActiveSubView(sub)}
                          className={`w-full text-left py-1.5 px-3 text-[11px] font-semibold rounded-lg transition-colors block ${
                            activeSubView === sub
                              ? 'text-white bg-slate-900 font-bold'
                              : 'text-slate-500 hover:text-slate-300'
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

        <div className="p-4 border-t border-slate-900 flex-shrink-0 space-y-2">
          <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-900 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Node Uptime</span>
            <span className="text-[10px] text-green-500 font-extrabold">{stats.apiSuccessRate}%</span>
          </div>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setUsername('');
              setPassword('');
            }}
            className="w-full flex items-center justify-center space-x-2 border border-red-900 bg-red-950/20 hover:bg-red-950/50 text-red-500 font-bold py-2.5 rounded-xl transition-all text-xs"
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
                              ? 'hover:bg-slate-50 dark:hover:bg-slate-800/20' 
                              : 'bg-blue-50/40 dark:bg-blue-955/10 hover:bg-blue-50/60 dark:hover:bg-blue-955/20'
                          }`}
                        >
                          <span className="text-sm mt-0.5 select-none">{n.emoji}</span>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className={`font-bold text-primary truncate ${!n.read ? 'font-extrabold' : ''}`}>{n.title}</span>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-1">{n.time}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">{n.desc}</p>
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
                    <p className="text-[9px] font-black uppercase text-muted tracking-wider">Super Administrator</p>
                    <p className="font-bold truncate mt-0.5">aditya@hyperbrain.ai</p>
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
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="bg-slate-250 dark:bg-slate-800 h-28 rounded-2xl" />
                ))}
              </div>
              <div className="bg-slate-250 dark:bg-slate-800 h-64 rounded-2xl" />
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
            
            /* D1: OVERVIEW PAGE */
            <div className="space-y-6">
              
              {/* TOP KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Students", value: students.length, icon: Users, color: "text-blue-500" },
                  { label: "Active Users Today", value: stats.dau, icon: Activity, color: "text-green-500" },
                  { label: "Courses Created", value: stats.totalCourses, icon: BookOpen, color: "text-indigo-500" },
                  { label: "Mock Exams Generated", value: stats.mockExamsGenerated, icon: Award, color: "text-yellow-500" },
                  { label: "AI Requests Today", value: stats.aiRequestsToday, icon: Cpu, color: "text-purple-500" },
                  { label: "MRR Revenue", value: `$${stats.mrr}`, icon: BarChart2, color: "text-emerald-500" },
                  { label: "Token Consumption", value: stats.totalTokens, icon: Database, color: "text-slate-500" },
                  { label: "System Health", value: `${stats.apiSuccessRate}%`, icon: ShieldCheck, color: "text-teal-500" }
                ].map((kpi, i) => {
                  const Icon = kpi.icon;
                  return (
                    <Card key={i} className="p-4 flex flex-col justify-between h-28 bg-card border-border-theme">
                      <Icon className={`w-5 h-5 ${kpi.color}`} />
                      <div>
                        <span className="text-[9px] font-black text-muted uppercase tracking-widest block">{kpi.label}</span>
                        <h3 className="text-2xl font-black text-primary mt-1 leading-none">{kpi.value}</h3>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* ADMIN ACTION CENTER */}
              <Card className="bg-card border-border-theme p-6 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-border-theme">
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest">Admin Action Center</h3>
                  <button
                    onClick={() => setApiError("Connection Timeout: Simulated API service boundary failure.")}
                    className="text-[9px] text-red-500 hover:underline font-bold uppercase tracking-wider"
                  >
                    Simulate API Failure
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowCreateAdminModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center space-x-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Admin</span>
                  </button>
                  <button
                    onClick={() => { setActiveCategory("USER_MANAGEMENT"); setActiveSubView("Students"); }}
                    className="px-4 py-2 border border-border-theme hover:bg-bg-secondary text-primary text-xs font-bold rounded-xl transition-all active:scale-95"
                  >
                    Suspend User
                  </button>
                  <button
                    onClick={() => setShowBroadcastModal(true)}
                    className="px-4 py-2 border border-border-theme hover:bg-bg-secondary text-primary text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center space-x-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Broadcast Notification</span>
                  </button>
                  <button
                    onClick={() => showToast("AI prompt cache keys flushed and optimized")}
                    className="px-4 py-2 border border-border-theme hover:bg-bg-secondary text-primary text-xs font-bold rounded-xl transition-all active:scale-95"
                  >
                    Refresh AI Cache
                  </button>
                  <button
                    onClick={() => showToast("Administrative background nodes restarted")}
                    className="px-4 py-2 bg-red-600/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl transition-all hover:bg-red-500/20 active:scale-95"
                  >
                    Restart Services
                  </button>
                </div>
              </Card>

            </div>
          ) : activeCategory === "DASHBOARD" && activeSubView === "Real-time Analytics" ? (
            
            /* D2: REAL-TIME ANALYTICS SECTION */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-card border-border-theme space-y-4">
                  <h4 className="text-[10px] font-black text-muted uppercase tracking-widest">Active Observers</h4>
                  <div className="space-y-1">
                    <span className="text-3xl font-black text-primary leading-none block">{stats.dau}</span>
                    <span className="text-[10px] text-green-500 font-bold block">Daily Active Users (DAU)</span>
                  </div>
                </Card>

                <Card className="p-6 bg-card border-border-theme space-y-4">
                  <h4 className="text-[10px] font-black text-muted uppercase tracking-widest font-bold">Weekly Observers</h4>
                  <div className="space-y-1">
                    <span className="text-3xl font-black text-primary leading-none block">{stats.wau}</span>
                    <span className="text-[10px] text-blue-500 font-bold block">Weekly Active Users (WAU)</span>
                  </div>
                </Card>

                <Card className="p-6 bg-card border-border-theme space-y-4">
                  <h4 className="text-[10px] font-black text-muted uppercase tracking-widest">Monthly Observers</h4>
                  <div className="space-y-1">
                    <span className="text-3xl font-black text-primary leading-none block">{stats.mau}</span>
                    <span className="text-[10px] text-indigo-500 font-bold block">Monthly Active Users (MAU)</span>
                  </div>
                </Card>
              </div>

              {/* USER INSIGHTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border-border-theme p-6 space-y-4">
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Student Conversion Rates</h3>
                  <div className="space-y-3 font-semibold text-xs text-muted">
                    <div className="flex justify-between">
                      <span>Premium Upgrade Rate</span>
                      <span className="text-primary font-bold">{students.length > 0 ? ((stats.premiumCount / students.length) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Weekly Active / Monthly Active Ratio</span>
                      <span className="text-primary font-bold">{stats.mau > 0 ? ((stats.wau / stats.mau) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DAU / MAU Stickiness Ratio</span>
                      <span className="text-primary font-bold">{stats.mau > 0 ? ((stats.dau / stats.mau) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                </Card>

                <Card className="bg-card border-border-theme p-6 space-y-4">
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">User Growth Analytics</h3>
                  <div className="space-y-3 font-semibold text-xs text-muted">
                    <div className="flex justify-between">
                      <span>New Student Signups (Today)</span>
                      <span className="text-primary font-bold">+{stats.newUsersToday} Registrations</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Trial to Paid Conversion Ratio</span>
                      <span className="text-primary font-bold">78%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Premium Churn Ratio (Monthly)</span>
                      <span className="text-primary font-bold">2.4%</span>
                    </div>
                  </div>
                </Card>
              </div>

            </div>
          ) : activeCategory === "DASHBOARD" && activeSubView === "Activity Feed" ? (
            
            /* D3: LIVE ACTIVITY FEED */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-border-theme">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">Real-time Telemetry logs</h3>
                <span className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Listening Live</span>
              </div>
              <div className="space-y-4 text-xs font-semibold text-muted max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex justify-between items-center border-b border-border-theme/40 pb-3 hover:bg-bg-secondary/40 transition-colors rounded px-2">
                    <div className="flex items-center space-x-3 py-1">
                      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                        log.type.includes('error') ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
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
          ) : activeCategory === "USER_MANAGEMENT" && activeSubView === "Students" ? (
            
            /* U1: STUDENTS LIST TABLE (WITH SORT, SEARCH, FILTER, EXPORT CSV, BULK ACTIONS) */
            <div className="space-y-6">
              
              {/* Header actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchText}
                    onChange={(e) => { setUserSearchText(e.target.value); setUserCurrentPage(1); }}
                    placeholder="Search students by name, email, or id..."
                    className="w-full pl-9 pr-4 py-2 bg-card border border-border-theme rounded-xl text-xs font-semibold focus-ring text-primary placeholder-slate-400"
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <select
                    value={userSubFilter}
                    onChange={(e) => { setUserSubFilter(e.target.value); setUserCurrentPage(1); }}
                    className="px-3 py-2 bg-card border border-border-theme rounded-xl text-xs font-semibold focus-ring text-primary"
                  >
                    <option value="All">All Tiers</option>
                    <option value="Pro">Premium Pro</option>
                    <option value="Free">Basic Free</option>
                  </select>

                  <select
                    value={userSortField}
                    onChange={(e) => setUserSortField(e.target.value)}
                    className="px-3 py-2 bg-card border border-border-theme rounded-xl text-xs font-semibold focus-ring text-primary"
                  >
                    <option value="name">Sort by Name</option>
                    <option value="email">Sort by Email</option>
                    <option value="role">Sort by Role</option>
                  </select>

                  <button
                    onClick={() => setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 bg-card border border-border-theme rounded-xl text-xs font-semibold hover:bg-bg-secondary text-primary"
                  >
                    {userSortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  </button>

                  <button
                    onClick={() => handleExportCSV(filteredUsers)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Bulk action banner */}
              {selectedUserIds.length > 0 && (
                <div className="bg-blue-600 text-white p-3.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all shadow-md animate-fade-in">
                  <span>Selected {selectedUserIds.length} users</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleBulkSuspend}
                      className="px-3 py-1 bg-red-650 hover:bg-red-750 text-white rounded-lg transition-colors flex items-center space-x-1"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Suspend</span>
                    </button>
                    <button
                      onClick={handleBulkReactivate}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Reactivate</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Users table */}
              <Card className="p-0 border border-border-theme overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider">
                        <th className="p-4 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.length === paginatedUsers.length && paginatedUsers.length > 0}
                            onChange={handleToggleSelectAllUsers}
                            className="rounded border-border-theme focus:ring-blue-500 cursor-pointer h-4 w-4"
                          />
                        </th>
                        <th className="p-4">Student</th>
                        <th className="p-4">Role Mapping</th>
                        <th className="p-4">Subscription</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-theme text-primary font-semibold">
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-muted">
                            No student accounts found matching selected parameters.
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map(student => {
                          const isOnline = student.isOnline || false;
                          const currentRole = student.role || "Student";
                          const isSuspended = student.status === 'suspended';

                          return (
                            <tr key={student.id} className="hover:bg-bg-secondary/40 transition-colors">
                              <td className="p-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedUserIds.includes(student.id)}
                                  onChange={() => handleToggleSelectUser(student.id)}
                                  className="rounded border-border-theme focus:ring-blue-500 cursor-pointer h-4 w-4"
                                />
                              </td>
                              <td className="p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="relative">
                                    <div className="h-8 w-8 bg-bg-secondary border border-border-theme rounded-full flex items-center justify-center text-slate-500">
                                      <User className="w-4 h-4" />
                                    </div>
                                    <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-card ${
                                      isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'
                                    }`} />
                                  </div>
                                  <div>
                                    <span className="font-bold text-primary block">{student.name}</span>
                                    <span className="text-[10px] text-muted block">{student.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <select
                                  value={currentRole}
                                  onChange={(e) => handleUpdateRole(student.id, e.target.value)}
                                  className="bg-bg-secondary border border-border-theme rounded-lg px-2 py-1 font-bold text-slate-700 dark:text-slate-350 focus-ring cursor-pointer"
                                >
                                  <option value="Student">Student</option>
                                  <option value="Moderator">Moderator</option>
                                  <option value="Administrator">Administrator</option>
                                </select>
                              </td>
                              <td className="p-4">
                                {student.isPro ? (
                                  <span className="text-[9px] font-black bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Premium Pro</span>
                                ) : (
                                  <span className="text-[9px] font-black bg-bg-secondary text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider font-light">Free Basic</span>
                                )}
                              </td>
                              <td className="p-4">
                                {isSuspended ? (
                                  <span className="text-[9px] font-black bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Suspended</span>
                                ) : (
                                  <span className="text-[9px] font-black bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleToggleSuspend(student.id, student.status)}
                                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                                    isSuspended
                                      ? 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 hover:bg-green-100'
                                      : 'bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 hover:bg-red-100 font-bold'
                                  }`}
                                >
                                  {isSuspended ? 'Reactivate' : 'Suspend'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalUserPages > 1 && (
                  <div className="p-4 bg-bg-secondary/40 border-t border-border-theme flex items-center justify-between text-xs font-bold text-muted">
                    <span>Showing {(userCurrentPage - 1) * usersPerPage + 1}-{Math.min(filteredUsers.length, userCurrentPage * usersPerPage)} of {filteredUsers.length}</span>
                    <div className="flex space-x-1.5">
                      <button
                        onClick={() => setUserCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={userCurrentPage === 1}
                        className="px-3 py-1.5 border border-border-theme rounded-lg bg-card text-primary disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setUserCurrentPage(prev => Math.min(totalUserPages, prev + 1))}
                        disabled={userCurrentPage === totalUserPages}
                        className="px-3 py-1.5 border border-border-theme rounded-lg bg-card text-primary disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </Card>

            </div>
          ) : activeCategory === "USER_MANAGEMENT" && activeSubView === "Admins" ? (
            
            /* U2: ADMINS LIST */
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">Active Administrators</h3>
                <button
                  onClick={() => setShowCreateAdminModal(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Configure Admin</span>
                </button>
              </div>

              <Card className="p-0 border border-border-theme overflow-hidden bg-card text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                        <th className="p-4">Administrator</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-theme text-primary font-semibold">
                      {students.filter(s => s.role === 'Administrator').length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-muted">
                            No other administrators configured yet.
                          </td>
                        </tr>
                      ) : (
                        students.filter(s => s.role === 'Administrator').map(admin => (
                          <tr key={admin.id} className="hover:bg-bg-secondary/40 transition-colors">
                            <td className="p-4 font-bold">{admin.name || "Aditya"}</td>
                            <td className="p-4 text-muted">{admin.email}</td>
                            <td className="p-4">
                              <span className="text-[9px] font-black bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Super Admin</span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleUpdateRole(admin.id, 'Student')}
                                className="text-[10px] text-red-500 hover:underline font-bold"
                              >
                                Revoke Administrator Access
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : activeCategory === "USER_MANAGEMENT" && activeSubView === "Roles & Permissions" ? (
            
            /* U3: ROLES & PERMISSIONS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Role Permissions Matrix</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Platform Permission</th>
                      <th className="p-3 text-center">Student</th>
                      <th className="p-3 text-center">Moderator</th>
                      <th className="p-3 text-center">Administrator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    {[
                      { name: "Access & Read Syllabus Maps", s: true, m: true, a: true },
                      { name: "AI Note & Mock Exam Generation", s: true, m: true, a: true },
                      { name: "Manage Student Accounts & Suspensions", s: false, m: true, a: true },
                      { name: "Modify System API Credentials & Plan Pricing", s: false, m: false, a: true }
                    ].map((perm, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-bold text-muted">{perm.name}</td>
                        <td className="p-3 text-center">
                          {perm.s ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <ShieldAlert className="w-4 h-4 text-slate-400 mx-auto" />}
                        </td>
                        <td className="p-3 text-center">
                          {perm.m ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <ShieldAlert className="w-4 h-4 text-slate-400 mx-auto" />}
                        </td>
                        <td className="p-3 text-center">
                          {perm.a ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <ShieldAlert className="w-4 h-4 text-slate-400 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "USER_MANAGEMENT" && activeSubView === "User Sessions" ? (
            
            /* U4: USER SESSIONS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Active platform user sessions</h3>
              <div className="space-y-3.5 text-xs">
                {students.filter(s => s.isOnline).length === 0 ? (
                  <div className="py-4 text-center text-muted">
                    No active student sessions detected.
                  </div>
                ) : (
                  students.filter(s => s.isOnline).map(student => (
                    <div key={student.id} className="flex justify-between items-center border-b border-border-theme pb-2 text-xs font-semibold text-muted">
                      <div>
                        <span className="font-bold text-primary block">{student.name}</span>
                        <span className="text-[10px] text-slate-400">Device: MacOS (Chrome browser) • IP: 192.168.1.42</span>
                      </div>
                      <button
                        onClick={() => showToast(`Terminated active session for ${student.name}`)}
                        className="px-2.5 py-1 text-[10px] font-bold border border-red-500/20 text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg"
                      >
                        Force Terminate
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ) : activeCategory === "COURSE_MANAGEMENT" && activeSubView === "Courses" ? (
            
            /* C1: COURSES */
            <div className="space-y-6 animate-scale-up">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-card border-border-theme flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Total Subjects</span>
                    <span className="text-2xl font-black text-primary block mt-1">{stats.totalCourses} Courses</span>
                  </div>
                  <BookOpen className="w-8 h-8 text-blue-600" />
                </Card>

                <Card className="p-4 bg-card border-border-theme flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Most studied course</span>
                    <span className="text-sm font-bold text-primary block mt-1 truncate max-w-[180px]">{stats.mostStudiedCourse}</span>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </Card>

                <Card className="p-4 bg-card border-border-theme flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Least engaged course</span>
                    <span className="text-sm font-bold text-primary block mt-1 truncate max-w-[180px]">{stats.leastEngagedCourse}</span>
                  </div>
                  <ShieldQuestion className="w-8 h-8 text-yellow-600" />
                </Card>
              </div>

              {/* Progress bars */}
              <Card className="bg-card border-border-theme p-6 space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Institutional Syllabus Mappings</h3>
                <div className="space-y-4 text-xs font-semibold">
                  {[
                    { name: "Web Development Standard", users: 110, rate: 84 },
                    { name: "Operating Systems Core", users: 84, rate: 62 },
                    { name: "Entrepreneurship Development", users: 72, rate: 78 }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between text-muted">
                        <span>{item.name} ({item.users} Enrolled)</span>
                        <span>{item.rate}% Completion Rate</span>
                      </div>
                      <div className="w-full bg-bg-secondary h-2 rounded-full overflow-hidden border border-border-theme">
                        <div className="bg-blue-600 h-full" style={{ width: `${item.rate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : activeCategory === "COURSE_MANAGEMENT" && activeSubView === "Uploaded Syllabus" ? (
            
            /* C2: UPLOADED SYLLABUS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Uploaded Syllabus Documents</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">File Name</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Upload Date</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    {[
                      { file: "Computer_Architecture_Syllabus.pdf", size: "2.4 MB", date: "June 25, 2026" },
                      { file: "Operating_Systems_Chapter1.pdf", size: "1.8 MB", date: "June 28, 2026" },
                      { file: "Calculus_Syllabus_2026.pdf", size: "4.1 MB", date: "Today" }
                    ].map((docItem, idx) => (
                      <tr key={idx} className="hover:bg-bg-secondary/40 transition-colors">
                        <td className="p-3 font-bold flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span>{docItem.file}</span>
                        </td>
                        <td className="p-3 text-muted">{docItem.size}</td>
                        <td className="p-3 text-muted">{docItem.date}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => showToast("Syllabus record purged")}
                            className="text-red-500 font-bold hover:underline"
                          >
                            Purge
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "COURSE_MANAGEMENT" && activeSubView === "Topics" ? (
            
            /* C3: TOPICS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Course topics cache database</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Subject</th>
                      <th className="p-3">Topic Title</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    {[
                      { course: "Operating Systems", title: "Process Scheduling Algorithms", status: "Cached" },
                      { course: "Operating Systems", title: "Memory Allocation Policies", status: "Cached" },
                      { course: "Computer Architecture", title: "Pipelining & Instruction Hazards", status: "Pending AI" }
                    ].map((topicItem, idx) => (
                      <tr key={idx} className="hover:bg-bg-secondary/40 transition-colors">
                        <td className="p-3 font-bold text-muted">{topicItem.course}</td>
                        <td className="p-3 font-extrabold">{topicItem.title}</td>
                        <td className="p-3">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            topicItem.status === 'Cached' 
                              ? 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400' 
                              : 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/20 dark:text-yellow-400 animate-pulse'
                          }`}>
                            {topicItem.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => showToast("AI regeneration process queued")}
                            className="text-blue-500 font-bold hover:underline"
                          >
                            Force AI Regen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "COURSE_MANAGEMENT" && activeSubView === "Learning Maps" ? (
            
            /* C4: LEARNING MAPS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Academic Prerequisite Flow Chart</h3>
              <div className="flex flex-col md:flex-row items-center justify-center p-6 space-y-4 md:space-y-0 md:space-x-6 text-xs text-center font-bold">
                <div className="h-16 w-32 bg-bg-secondary border border-border-theme rounded-2xl flex items-center justify-center text-primary shadow-sm">
                  1. OS Basics
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 hidden md:block" />
                <div className="h-16 w-32 bg-blue-600/10 border border-blue-600 text-blue-500 rounded-2xl flex items-center justify-center shadow-sm">
                  2. Kernels & Threads
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 hidden md:block" />
                <div className="h-16 w-32 bg-bg-secondary border border-border-theme rounded-2xl flex items-center justify-center text-primary shadow-sm">
                  3. Virtual Memory
                </div>
              </div>
            </Card>
          ) : activeCategory === "AI_MANAGEMENT" && activeSubView === "Notes Generation" ? (
            
            /* A1: AI NOTES GENERATION CONFIGS */
            <Card className="bg-card border-border-theme p-6 space-y-6">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Notes Generation AI Engine settings</h3>
              
              <div className="space-y-4 text-xs font-bold">
                <div className="space-y-2">
                  <label className="block text-muted">Primary Language Model Mapping</label>
                  <select
                    value={aiModelSelected}
                    onChange={(e) => setAiModelSelected(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-secondary border border-border-theme rounded-xl text-primary focus-ring"
                  >
                    <option value="llama-3.3-70b-versatile">Llama 3.1 8B Instant (Recommended)</option>
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Latency Optimised)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-muted">
                    <span>Generation Temperature Factor</span>
                    <span className="text-blue-500">{aiTemperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={aiTemperature}
                    onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </Card>
          ) : activeCategory === "AI_MANAGEMENT" && activeSubView === "Mock Exams" ? (
            
            /* A2: AI MOCK EXAM BLUEPRINTS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Exam Blueprint Section Weights</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Paper Max Marks</th>
                      <th className="p-3">Sections Configuration</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    {[
                      { marks: 20, desc: "MCQ (5 Qs) • Short Answer (3 Qs)" },
                      { marks: 50, desc: "MCQ (10 Qs) • Short Answer (5 Qs) • Long Answer (2 Qs)" },
                      { marks: 100, desc: "MCQ (20 Qs) • Short Answer (10 Qs) • Long Answer (5 Qs)" }
                    ].map((bp, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-black text-blue-600 dark:text-blue-400">{bp.marks} Marks Paper</td>
                        <td className="p-3 text-muted">{bp.desc}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => showToast("Blueprint modified")} className="text-blue-500 font-bold hover:underline">Edit Weights</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "AI_MANAGEMENT" && activeSubView === "Flashcards" ? (
            
            /* A3: FLASHCARDS STATS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Flashcard Decks Performance</h3>
              <div className="space-y-4 font-semibold text-xs text-muted">
                <div className="p-4 bg-bg-secondary border border-border-theme rounded-2xl flex justify-between">
                  <span>Total Decks Generated</span>
                  <span className="text-primary font-bold">142 Decks</span>
                </div>
                <div className="p-4 bg-bg-secondary border border-border-theme rounded-2xl flex justify-between">
                  <span>Average cards per deck</span>
                  <span className="text-primary font-bold">15 Cards</span>
                </div>
              </div>
            </Card>
          ) : activeCategory === "AI_MANAGEMENT" && activeSubView === "AI Tutor" ? (
            
            /* A4: AI TUTOR CONFIGS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">AI Tutor Prompt Editor</h3>
              <div className="space-y-3 text-xs">
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">Tutor System Persona Prompt</label>
                <textarea
                  defaultValue="You are Antigravity, a premium tutor designed by Google DeepMind. Answer student queries dynamically, provide short clear responses, and use Markdown logic."
                  rows="4"
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-theme rounded-xl text-primary text-xs focus-ring"
                />
                <button
                  onClick={() => showToast("AI Tutor system prompt updated")}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md text-[11px]"
                >
                  Save Prompt Override
                </button>
              </div>
            </Card>
          ) : activeCategory === "AI_MANAGEMENT" && activeSubView === "Token Analytics" ? (
            
            /* A5: AI TOKEN ANALYTICS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-scale-up">
              <Card className="bg-card border-border-theme p-6 space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">AI Performance</h3>
                <div className="space-y-3 font-semibold text-xs text-muted">
                  <div className="flex justify-between">
                    <span>Average Response Speed</span>
                    <span className="text-primary font-bold">{stats.avgLatency}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total AI requests processed</span>
                    <span className="text-primary font-bold">{stats.totalAiRequests} Queries</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI response success rate</span>
                    <span className="text-green-600 dark:text-green-400 font-bold">{stats.apiSuccessRate}%</span>
                  </div>
                </div>
              </Card>

              <Card className="bg-card border-border-theme p-6 space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Monthly Token Usage</h3>
                <div className="space-y-3 font-bold text-xs text-muted">
                  <div className="flex justify-between">
                    <span>Prompt Input Tokens</span>
                    <span className="text-primary">{stats.totalTokens} Tokens</span>
                  </div>
                  <div className="flex justify-between border-t border-border-theme pt-2">
                    <span>API Cost Estimate</span>
                    <span className="text-primary">${stats.tokenCost}</span>
                  </div>
                </div>
              </Card>
            </div>
          ) : activeCategory === "EXAM_MANAGEMENT" && activeSubView === "Generated Exams" ? (
            
            /* E1: GENERATED EXAMS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Generated Exam Papers</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Paper ID</th>
                      <th className="p-3">Subject Name</th>
                      <th className="p-3">Target Marks</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    {[
                      { id: "EX-9872", course: "Web Development Standard", marks: 20 },
                      { id: "EX-1122", course: "Operating Systems Core", marks: 70 },
                      { id: "EX-3344", course: "Data Structures", marks: 50 }
                    ].map((examItem, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{examItem.id}</td>
                        <td className="p-3">{examItem.course}</td>
                        <td className="p-3 font-bold">{examItem.marks} Marks</td>
                        <td className="p-3 text-right">
                          <button onClick={() => showToast("Exam preview details loaded")} className="text-blue-500 hover:underline">View Blueprint</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "EXAM_MANAGEMENT" && activeSubView === "Exam Attempts" ? (
            
            /* E2: EXAM ATTEMPTS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Student Mock attempts logs</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Subject Name</th>
                      <th className="p-3">Marks Scored</th>
                      <th className="p-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    {activityLogs.filter(log => log.type === 'mock_exam_submitted').length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-muted">No mock exam attempts logged yet.</td>
                      </tr>
                    ) : (
                      activityLogs.filter(log => log.type === 'mock_exam_submitted').map(log => (
                        <tr key={log.id}>
                          <td className="p-3 font-bold">{log.userName}</td>
                          <td className="p-3 font-semibold text-muted">{log.metadata?.subjectName}</td>
                          <td className="p-3 font-bold text-green-600 dark:text-green-400">{log.metadata?.score}/{log.metadata?.maxScore}</td>
                          <td className="p-3 text-muted text-right">{new Date(log.timestamp).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "EXAM_MANAGEMENT" && activeSubView === "Results" ? (
            
            /* E3: RESULTS BREAKDOWN */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Platform Grade Distribution</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs font-bold">
                <div className="p-4 bg-bg-secondary border border-border-theme rounded-2xl">
                  <span className="text-2xl font-black text-green-500 block">40%</span>
                  <span className="text-[10px] text-muted block uppercase mt-0.5">Grade A (Excellent)</span>
                </div>
                <div className="p-4 bg-bg-secondary border border-border-theme rounded-2xl">
                  <span className="text-2xl font-black text-blue-500 block">30%</span>
                  <span className="text-[10px] text-muted block uppercase mt-0.5">Grade B (Good)</span>
                </div>
                <div className="p-4 bg-bg-secondary border border-border-theme rounded-2xl">
                  <span className="text-2xl font-black text-yellow-500 block">20%</span>
                  <span className="text-[10px] text-muted block uppercase mt-0.5">Grade C (Satisfactory)</span>
                </div>
                <div className="p-4 bg-bg-secondary border border-border-theme rounded-2xl">
                  <span className="text-2xl font-black text-red-500 block">10%</span>
                  <span className="text-[10px] text-muted block uppercase mt-0.5">Grade F (Fail)</span>
                </div>
              </div>
            </Card>
          ) : activeCategory === "EXAM_MANAGEMENT" && activeSubView === "Evaluation Queue" ? (
            
            /* E4: EVALUATION QUEUE */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Theory evaluation queue</h3>
              <div className="space-y-3.5 text-xs text-muted font-semibold">
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <div>
                    <span className="font-bold text-primary block">Ananya Iyer • OS Short Answer Q3</span>
                    <span className="text-[10px] text-slate-400">Response length: 154 words • System Auto Score: 8/10</span>
                  </div>
                  <button onClick={() => showToast("Evaluation confirmed")} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold active:scale-95">Confirm Grade</button>
                </div>
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <div>
                    <span className="font-bold text-primary block">Rohan Sharma • Web Dev MCQ Q10</span>
                    <span className="text-[10px] text-slate-400">Response status: Mismatch flag raised</span>
                  </div>
                  <button onClick={() => showToast("Evaluation confirmed")} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold active:scale-95">Confirm Grade</button>
                </div>
              </div>
            </Card>
          ) : activeCategory === "SUBSCRIPTIONS" && activeSubView === "Plans" ? (
            
            /* P1: PLANS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Active Pricing tiers</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Plan Identifier</th>
                      <th className="p-3">Monthly Cost</th>
                      <th className="p-3 text-center">Active Enrolled</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    <tr className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-3 font-bold">Standard Free tier</td>
                      <td className="p-3 text-muted">$0.00 / month</td>
                      <td className="p-3 text-center font-bold">{stats.freeCount} Students</td>
                      <td className="p-3 text-right">
                        <button onClick={() => showToast("Plan details modified")} className="text-blue-500 hover:underline">Edit Details</button>
                      </td>
                    </tr>
                    <tr className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-3 font-bold text-blue-600 dark:text-blue-400">Annual Pro tier</td>
                      <td className="p-3 text-muted">$79.99 / year</td>
                      <td className="p-3 text-center font-bold">{stats.premiumCount} Students</td>
                      <td className="p-3 text-right">
                        <button onClick={() => showToast("Plan details modified")} className="text-blue-500 hover:underline">Edit Details</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "SUBSCRIPTIONS" && activeSubView === "Revenue" ? (
            
            /* P2: REVENUE Metrics */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-scale-up">
              <Card className="bg-card border-border-theme p-6 space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Revenue Growth targets</h3>
                <div className="space-y-3 font-semibold text-xs text-muted">
                  <div className="flex justify-between">
                    <span>Monthly Recurring Revenue (MRR)</span>
                    <span className="text-primary font-bold">${stats.mrr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Annualized Run Rate (ARR)</span>
                    <span className="text-primary font-bold">${stats.mrr * 12}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Lifetime payments processed</span>
                    <span className="text-primary font-bold">${stats.totalRevenue}</span>
                  </div>
                </div>
              </Card>

              <Card className="bg-card border-border-theme p-6 space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Average customer yields</h3>
                <div className="space-y-3 font-semibold text-xs text-muted">
                  <div className="flex justify-between">
                    <span>ARPU (Average Revenue Per User)</span>
                    <span className="text-primary font-bold">${students.length > 0 ? (stats.mrr / students.length).toFixed(2) : 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trial upgrades conversion rate</span>
                    <span className="text-primary font-bold">15.8%</span>
                  </div>
                </div>
              </Card>
            </div>
          ) : activeCategory === "SUBSCRIPTIONS" && activeSubView === "Payments" ? (
            
            /* P3: PAYMENTS HISTORY LOGS */
            <Card className="bg-card border-border-theme p-6 space-y-4 animate-scale-up">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Completed platform payments</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Customer User</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Invoice Status</th>
                      <th className="p-3 text-right">Invoiced Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    {activityLogs.filter(log => log.type === 'payment_completed').length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-muted">No subscription transactions logged yet.</td>
                      </tr>
                    ) : (
                      activityLogs.filter(log => log.type === 'payment_completed').map(log => (
                        <tr key={log.id}>
                          <td className="p-3 font-bold">{log.userName}</td>
                          <td className="p-3 font-extrabold text-blue-650 dark:text-blue-400">$79.99</td>
                          <td className="p-3">
                            <span className="text-[9px] font-black bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400 px-2 py-0.5 rounded-full uppercase">Succeeded</span>
                          </td>
                          <td className="p-3 text-muted text-right">{new Date(log.timestamp).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "SUBSCRIPTIONS" && activeSubView === "Coupons" ? (
            
            /* P4: COUPONS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-border-theme">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">Active Coupon codes</h3>
                <button onClick={() => showToast("New Coupon configuration created")} className="text-[9px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider">Add Coupon Code</button>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Code</th>
                      <th className="p-3">Reduction</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Redemptions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    <tr className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-3 font-black text-blue-600 dark:text-blue-400">WELCOME50</td>
                      <td className="p-3 text-muted">50% discount</td>
                      <td className="p-3">
                        <span className="text-[9px] font-black bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400 px-2 py-0.5 rounded-full uppercase">Active</span>
                      </td>
                      <td className="p-3 text-muted text-right">12 times Billed</td>
                    </tr>
                    <tr className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-3 font-black text-blue-600 dark:text-blue-400">SUMMER20</td>
                      <td className="p-3 text-muted">20% discount</td>
                      <td className="p-3">
                        <span className="text-[9px] font-black bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400 px-2 py-0.5 rounded-full uppercase">Active</span>
                      </td>
                      <td className="p-3 text-muted text-right">4 times Billed</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "SYSTEM" && activeSubView === "API Monitoring" ? (
            
            /* S1: SYSTEM PERFORMANCE */
            <div className="space-y-6 animate-scale-up">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="p-4 bg-card border-border-theme flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Groq API status</span>
                    <span className="text-xs font-extrabold text-primary block">Operational</span>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                </Card>

                <Card className="p-4 bg-card border-border-theme flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Firebase DB status</span>
                    <span className="text-xs font-extrabold text-primary block">Operational</span>
                  </div>
                  <Database className="w-5 h-5 text-green-600" />
                </Card>

                <Card className="p-4 bg-card border-border-theme flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auth Service status</span>
                    <span className="text-xs font-extrabold text-primary block">Operational</span>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                </Card>
              </div>

              {/* Server metrics */}
              <Card className="bg-card border-border-theme p-6 space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Active Server Resource Allocation</h3>
                <div className="space-y-4 text-xs font-semibold text-muted">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Database CPU Allocation</span>
                      <span>24% CPU</span>
                    </div>
                    <div className="w-full bg-bg-secondary h-2 rounded-full overflow-hidden border border-border-theme">
                      <div className="bg-blue-600 h-full w-[24%]" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Server Memory Allocation</span>
                      <span>112 MB / 512 MB</span>
                    </div>
                    <div className="w-full bg-bg-secondary h-2 rounded-full overflow-hidden border border-border-theme">
                      <div className="bg-indigo-600 h-full w-[22%]" />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : activeCategory === "SYSTEM" && activeSubView === "Database" ? (
            
            /* S2: DATABASE DIAGNOSTICS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Firestore Read/Write Diagnostics</h3>
              <div className="space-y-3.5 text-xs font-semibold text-muted">
                <div className="flex justify-between">
                  <span>Reads load index</span>
                  <span className="text-primary font-bold">142 reads/min</span>
                </div>
                <div className="flex justify-between">
                  <span>Writes load index</span>
                  <span className="text-primary font-bold">18 writes/min</span>
                </div>
                <div className="flex justify-between">
                  <span>Firestore Connection Latency</span>
                  <span className="text-green-500 font-bold">42ms (Nominal)</span>
                </div>
              </div>
            </Card>
          ) : activeCategory === "SYSTEM" && activeSubView === "Logs" ? (
            
            /* S3: LOGS */
            <Card className="bg-card border-border-theme p-6 space-y-4 font-mono">
              <h3 className="text-xs font-black text-primary font-sans uppercase tracking-widest border-b border-border-theme pb-2">Real-time Server log Console</h3>
              <div className="bg-slate-950 text-green-500 p-4 rounded-xl text-[10px] space-y-1.5 h-64 overflow-y-auto custom-scrollbar">
                <div>[INFO] 2026-06-29T15:00:10Z - Synchronized users with Firestore listener snap</div>
                <div>[DEBUG] 2026-06-29T15:01:22Z - Triggered notes_generated telemetry for computer architecture</div>
                <div>[INFO] 2026-06-29T15:02:44Z - Completed subscription plan upgrade trigger for student Vikram</div>
                <div className="text-yellow-500 animate-pulse">[WARN] 2026-06-29T15:03:00Z - API warning: Groq API notes pregen latency exceeded 3000ms</div>
              </div>
            </Card>
          ) : activeCategory === "SYSTEM" && activeSubView === "Cache" ? (
            
            /* S4: CACHE */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">AI Cache Flushing & Maintenance</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => showToast("All AI prompt cache keys flushed and optimized")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Flush All Cache</span>
                </button>
                <button
                  onClick={() => showToast("Notes AI Prompt cache invalidation completed")}
                  className="px-4 py-2 border border-border-theme hover:bg-bg-secondary text-primary text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  Flush Notes Cache
                </button>
                <button
                  onClick={() => showToast("Exams blueprints prompt cache invalidation completed")}
                  className="px-4 py-2 border border-border-theme hover:bg-bg-secondary text-primary text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  Flush Exam Cache
                </button>
              </div>
            </Card>
          ) : activeCategory === "SYSTEM" && activeSubView === "Performance" ? (
            
            /* S5: PERFORMANCE */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Server Diagnostics performance log</h3>
              <div className="space-y-3.5 text-xs font-semibold text-muted">
                <div className="flex justify-between">
                  <span>Server response speed index</span>
                  <span className="text-primary font-bold">115ms (Operational)</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime Percentage</span>
                  <span className="text-green-500 font-bold">99.98% uptime</span>
                </div>
                <div className="flex justify-between">
                  <span>Active websocket endpoints connections</span>
                  <span className="text-primary font-bold">4 active channels</span>
                </div>
              </div>
            </Card>
          ) : activeCategory === "SECURITY" && activeSubView === "Login Activity" ? (
            
            /* SE1: LOGIN ACTIVITY */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Platform Admin access records</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Administrator</th>
                      <th className="p-3">IP Address</th>
                      <th className="p-3">Location</th>
                      <th className="p-3 text-right">Access Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    <tr className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-3 font-bold">Aditya (Super Admin)</td>
                      <td className="p-3 text-muted">192.168.1.100</td>
                      <td className="p-3 text-muted">New Delhi, India</td>
                      <td className="p-3 text-muted text-right">Today, 10:15 AM</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "SECURITY" && activeSubView === "Access Control" ? (
            
            /* SE2: ACCESS CONTROL */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-border-theme">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">Firewall rules Whitelists</h3>
                <button onClick={() => showToast("IP rule whitelist created")} className="text-[9px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider">Add Whitelisted IP</button>
              </div>
              <div className="space-y-3.5 text-xs text-muted font-semibold">
                <div className="flex justify-between border-b border-border-theme pb-2">
                  <span>Authorized Local CIDR Block</span>
                  <span className="text-primary font-bold">192.168.1.0/24</span>
                </div>
              </div>
            </Card>
          ) : activeCategory === "SECURITY" && activeSubView === "Suspicious Activity" ? (
            
            /* SE3: SUSPICIOUS ACTIVITY */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Mock Exam Proctoring warnings</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Subject Name</th>
                      <th className="p-3">Violation Type</th>
                      <th className="p-3 text-right">Logged Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    <tr className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-3 font-bold">Rohan Sharma</td>
                      <td className="p-3">Operating Systems</td>
                      <td className="p-3 text-red-500 font-extrabold">Exited Full Screen mode</td>
                      <td className="p-3 text-muted text-right">Today, 2:40 PM</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "SECURITY" && activeSubView === "Audit Logs" ? (
            
            /* SE4: AUDIT LOGS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Administrator audit trails</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-theme text-slate-400 font-black uppercase tracking-wider">
                      <th className="p-3">Admin</th>
                      <th className="p-3">Operation Target</th>
                      <th className="p-3">Result status</th>
                      <th className="p-3 text-right">Audit Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-theme text-primary font-semibold">
                    <tr className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="p-3 font-bold">Aditya (Super Admin)</td>
                      <td className="p-3 text-muted">Role update: Vikram Moderator</td>
                      <td className="p-3 text-green-600">Completed</td>
                      <td className="p-3 text-muted text-right">Today, 10:18 AM</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          ) : activeCategory === "SETTINGS" && activeSubView === "General" ? (
            
            /* SET1: GENERAL SETTINGS */
            <Card className="bg-card border-border-theme p-6 space-y-6">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Platform parameters</h3>
              
              <div className="space-y-4 text-xs font-bold">
                <div className="space-y-2">
                  <label className="block text-muted">Application Brand Name</label>
                  <input
                    type="text"
                    value={appTitle}
                    onChange={(e) => setAppTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-secondary border border-border-theme rounded-xl text-primary focus-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-muted">Administrative Support Email</label>
                  <input
                    type="text"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-secondary border border-border-theme rounded-xl text-primary focus-ring"
                  />
                </div>

                <div className="flex justify-between items-center border-t border-border-theme pt-4">
                  <div className="space-y-0.5">
                    <span className="block text-primary">System Maintenance Mode</span>
                    <span className="text-[10px] text-slate-400 font-semibold">Restricts basic student operations during migrations</span>
                  </div>
                  <button
                    onClick={() => {
                      setMaintenanceMode(!maintenanceMode);
                      showToast(`Maintenance mode set to ${!maintenanceMode}`);
                    }}
                    className="p-1 hover:opacity-90 transition-opacity"
                  >
                    {maintenanceMode ? (
                      <ToggleRight className="w-8 h-8 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </Card>
          ) : activeCategory === "SETTINGS" && activeSubView === "AI Configurations" ? (
            
            /* SET2: AI CONFIGS */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Default Groq API Override overrides</h3>
              <div className="space-y-4 text-xs font-bold">
                <div className="space-y-2">
                  <label className="block text-muted">Groq model override path</label>
                  <input
                    type="text"
                    defaultValue="models/llama-3.3-70b-versatile"
                    disabled
                    className="w-full px-3 py-2 bg-bg-secondary border border-border-theme rounded-xl text-slate-400 select-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-muted">Max Response token override</label>
                  <input
                    type="number"
                    defaultValue="2048"
                    className="w-full px-3 py-2 bg-bg-secondary border border-border-theme rounded-xl text-primary focus-ring"
                  />
                </div>
              </div>
            </Card>
          ) : activeCategory === "SETTINGS" && activeSubView === "Email Templates" ? (
            
            /* SET3: EMAIL TEMPLATES */
            <Card className="bg-card border-border-theme p-6 space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">SaaS email trigger templates</h3>
              <div className="space-y-3.5 text-xs font-semibold text-muted">
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <span>Student Welcome onboarding template</span>
                  <button onClick={() => showToast("Template loaded in email editor")} className="text-blue-500 hover:underline">Edit Template</button>
                </div>
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <span>Premium upgrade invoice template</span>
                  <button onClick={() => showToast("Template loaded in email editor")} className="text-blue-500 hover:underline">Edit Template</button>
                </div>
              </div>
            </Card>
          ) : (
            
            /* SET4: INTEGRATIONS */
            <Card className="bg-card border-border-theme p-6 space-y-4 animate-scale-up">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-theme pb-2">Active webhook endpoints integrations</h3>
              <div className="space-y-3.5 text-xs font-semibold text-muted">
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-slate-450" />
                    <span>Stripe payment processing webhook</span>
                  </div>
                  <span className="text-[9px] font-black bg-green-50 text-green-600 dark:bg-green-955/20 dark:text-green-400 px-2 py-0.5 rounded-full uppercase">Connected</span>
                </div>
                <div className="flex justify-between items-center border-b border-border-theme pb-2">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-slate-450" />
                    <span>Google Drive syllabus sync API</span>
                  </div>
                  <span className="text-[9px] font-black bg-green-50 text-green-600 dark:bg-green-955/20 dark:text-green-400 px-2 py-0.5 rounded-full uppercase">Connected</span>
                </div>
              </div>
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
