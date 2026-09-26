import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../services/firebase/firebase';
import { doc, updateDoc, onSnapshot, collection, query, where, deleteDoc, getDocs } from 'firebase/firestore';
import { ThemeContext } from '../../contexts/ThemeContext';
import Sidebar from '../../components/layout/Sidebar';
import { useSidebar } from '../../contexts/SidebarContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { 
  ArrowLeft, Mail, Fingerprint, Loader2, Menu, Sparkles, Check, 
  Volume2, BookOpen, GraduationCap, Building2, 
  Trophy, BarChart3, Sun, Moon, CreditCard, Calendar, BadgePercent,
  CheckCircle2, X, Download, RefreshCw, AlertTriangle, Sliders,
  Pause, Play, FileText, CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const { 
    desktopSidebarOpen, 
    mobileSidebarOpen, 
    setMobileSidebarOpen, 
    toggleDesktopSidebar, 
    toggleMobileSidebar 
  } = useSidebar();
  const { subscription, plan: subPlan, isPro: ctxIsPro, refreshSubscription } = useSubscription();
  const [isPro, setIsPro] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    setIsPro(ctxIsPro);
  }, [ctxIsPro]);
  const [isPurging, setIsPurging] = useState(false);

  const handlePurgeDatabase = async () => {
    if (!user) return;
    const confirmPurge = window.confirm("Are you sure you want to purge all workspaces, subjects, flashcards, study plans, and chat histories? This is a permanent developer operation.");
    if (!confirmPurge) return;

    setIsPurging(true);
    try {
      // 1. Purge workspaces
      const wsRef = collection(db, 'users', user.uid, 'workspaces');
      const wsSnap = await getDocs(wsRef);
      const wsDeletes = wsSnap.docs.map(docSnap => deleteDoc(doc(db, 'users', user.uid, 'workspaces', docSnap.id)));
      await Promise.all(wsDeletes);

      // 2. Purge subjects
      const subRef = collection(db, 'users', user.uid, 'subjects');
      const subSnap = await getDocs(subRef);
      const subDeletes = subSnap.docs.map(docSnap => deleteDoc(doc(db, 'users', user.uid, 'subjects', docSnap.id)));
      await Promise.all(subDeletes);

      // 3. Purge flashcards
      const fcRef = collection(db, 'users', user.uid, 'flashcards');
      const fcSnap = await getDocs(fcRef);
      const fcDeletes = fcSnap.docs.map(docSnap => deleteDoc(doc(db, 'users', user.uid, 'flashcards', docSnap.id)));
      await Promise.all(fcDeletes);

      // 4. Purge studyPlans
      const planRef = collection(db, 'users', user.uid, 'studyPlans');
      const planSnap = await getDocs(planRef);
      const planDeletes = planSnap.docs.map(docSnap => deleteDoc(doc(db, 'users', user.uid, 'studyPlans', docSnap.id)));
      await Promise.all(planDeletes);

      // 5. Purge chats
      const chatRef = collection(db, 'users', user.uid, 'chats');
      const chatSnap = await getDocs(chatRef);
      const chatDeletes = chatSnap.docs.map(docSnap => deleteDoc(doc(db, 'users', user.uid, 'chats', docSnap.id)));
      await Promise.all(chatDeletes);

      // Clear local storage keys
      localStorage.removeItem(`hb_workspaces_${user.uid}`);
      localStorage.removeItem(`courses_${user.uid}`);

      setToastMessage("Database purge complete! Workspaces and subjects deleted.");
      setTimeout(() => setToastMessage(''), 3000);

      window.dispatchEvent(new Event('hb_courses_updated'));
      window.dispatchEvent(new Event('hb_workspace_updated'));

      navigate('/dashboard');
    } catch (err) {
      console.error("Purge failed:", err);
      setToastMessage("Purge failed: " + err.message);
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setIsPurging(false);
    }
  };

  // Billing Portal & Invoices states
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState({
    planId: 'student_pro',
    billingPeriod: 'monthly',
    gateway: 'stripe',
    couponCode: ''
  });
  const [couponValidation, setCouponValidation] = useState(null);
  const [invoiceList, setInvoiceList] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showSimulatedCheckout, setShowSimulatedCheckout] = useState(false);
  const [simulatedCheckoutData, setSimulatedCheckoutData] = useState(null);

  // Sync user invoices in real-time
  useEffect(() => {
    if (!user || !db) return;
    const q = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
                     .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setInvoiceList(docs);
    }, (err) => {
      console.warn("Firestore invoices load failed:", err);
    });
    return () => unsub();
  }, [user]);

  // Personal Information states
  const [displayName, setDisplayName] = useState('');

  // Academic Information states
  const [academicInfo, setAcademicInfo] = useState({
    university: 'State Technological University',
    degree: 'Bachelor of Computer Applications (BCA)',
    semester: '6th Semester',
    gpa: '8.7',
    gradYear: '2027'
  });

  // System Preferences states
  const [preferences, setPreferences] = useState({
    reminders: true,
    emails: false,
    aiSpeed: 1.0
  });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setDisplayName(currentUser.displayName || currentUser.email.split('@')[0].toUpperCase());
        
        // Subscription check
        const storedPro = localStorage.getItem(`isPro_${currentUser.uid}`) === 'true';
        setIsPro(storedPro);

        // Academic info local check
        const storedAcademic = localStorage.getItem(`academic_${currentUser.uid}`);
        if (storedAcademic) {
          setAcademicInfo(JSON.parse(storedAcademic));
        }

        // Preferences local check
        const storedPrefs = localStorage.getItem(`prefs_${currentUser.uid}`);
        if (storedPrefs) {
          setPreferences(JSON.parse(storedPrefs));
        }

        // Stream from Firestore
        if (db) {
          const userRef = doc(db, 'users', currentUser.uid);
          onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.isPro !== undefined) {
                setIsPro(data.isPro);
                localStorage.setItem(`isPro_${currentUser.uid}`, data.isPro ? 'true' : 'false');
              }
              if (data.academicInfo) {
                setAcademicInfo(data.academicInfo);
                localStorage.setItem(`academic_${currentUser.uid}`, JSON.stringify(data.academicInfo));
              }
              if (data.preferences) {
                setPreferences(data.preferences);
                localStorage.setItem(`prefs_${currentUser.uid}`, JSON.stringify(data.preferences));
              }
              if (data.name) {
                setDisplayName(data.name);
              }
            }
          }, (err) => {
            console.error("Firestore user profile sync failed:", err);
          });
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Scroll to preferences if directed from sidebar click
  useEffect(() => {
    if (location.state?.focusSection === 'preferences') {
      setTimeout(() => {
        const el = document.getElementById('preferences-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-blue-600/40');
          setTimeout(() => el.classList.remove('ring-2', 'ring-blue-600/40'), 2500);
        }
      }, 300);
    }
  }, [location.state]);

  const handleSelectSubject = (id) => {
    navigate('/dashboard', { state: { selectedSubjectId: id } });
  };

  const handleSaveAcademicInfo = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    if (db) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { academicInfo });
      } catch (err) {
        console.warn("Firestore academic save failed, falling back to local:", err);
      }
    }
    localStorage.setItem(`academic_${user.uid}`, JSON.stringify(academicInfo));
    setToastMessage("Academic information saved successfully!");
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSavePreferences = async (newPrefs) => {
    if (!user) return;
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);

    if (db) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { preferences: updated });
      } catch (err) {
        console.warn("Firestore preferences save failed, local fallback:", err);
      }
    }
    localStorage.setItem(`prefs_${user.uid}`, JSON.stringify(updated));
    setToastMessage("Preferences updated!");
    setTimeout(() => setToastMessage(''), 2000);
  };

  const handleVerifyCoupon = async () => {
    if (!checkoutState.couponCode.trim()) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/billing-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: checkoutState.couponCode,
          planId: checkoutState.planId,
          billingPeriod: checkoutState.billingPeriod,
          useINR: checkoutState.gateway === 'razorpay'
        })
      });
      const data = await res.json();
      if (data.success && data.valid) {
        setCouponValidation(data);
        setToastMessage("Coupon applied successfully!");
      } else {
        setCouponValidation(null);
        setToastMessage(data.message || "Invalid coupon code");
      }
    } catch (e) {
      setToastMessage("Failed to verify coupon code");
    } finally {
      setCheckoutLoading(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleInitiateCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/billing-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          userName: displayName,
          planId: checkoutState.planId,
          billingPeriod: checkoutState.billingPeriod,
          gateway: checkoutState.gateway,
          couponCode: couponValidation ? checkoutState.couponCode : null
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.isSimulated) {
          // Open Simulated Checkout Modal
          setSimulatedCheckoutData(data);
          setShowSimulatedCheckout(true);
        } else if (data.checkoutUrl) {
          // Redirect to live checkout
          window.location.href = data.checkoutUrl;
        } else if (data.gateway === 'razorpay') {
          // Simulated or Sandbox Razorpay trigger
          setToastMessage("Razorpay gateway active, opening sandbox checkout...");
          setSimulatedCheckoutData(data);
          setShowSimulatedCheckout(true);
        }
      } else {
        setToastMessage(data.message || "Failed to create checkout session");
      }
    } catch (e) {
      setToastMessage("Error establishing secure billing connection");
    } finally {
      setCheckoutLoading(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleSimulatePayment = async (status) => {
    if (!simulatedCheckoutData) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/billing-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isSimulation: true,
          gateway: checkoutState.gateway,
          transactionId: simulatedCheckoutData.transactionId,
          eventId: `evt_sim_${Date.now()}`,
          eventType: status === 'success' ? 'payment.success' : 'payment.failed',
          paymentStatus: status
        })
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(status === 'success' ? "Payment Successful! Premium Activated." : "Payment Failed simulation recorded.");
        setShowSimulatedCheckout(false);
        setBillingModalOpen(false);
      } else {
        setToastMessage(data.message || "Simulation failed to register");
      }
    } catch (e) {
      setToastMessage("Failed to invoke billing webhooks");
    } finally {
      setCheckoutLoading(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !window.confirm("Are you sure you want to cancel your premium subscription? Access will end at the current period end.")) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/billing-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isSimulation: true,
          gateway: subscription.gateway || 'stripe',
          transactionId: subscription.planHistory?.[subscription.planHistory.length - 1]?.transactionId || `txn_cancel_${Date.now()}`,
          eventId: `evt_cancel_${Date.now()}`,
          eventType: 'subscription.cancelled',
          paymentStatus: 'failed' // updates subscription and marks expired/cancelled
        })
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage("Subscription cancelled successfully.");
      } else {
        setToastMessage("Cancellation failed: " + data.message);
      }
    } catch (e) {
      setToastMessage("Failed to request cancel.");
    } finally {
      setCheckoutLoading(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handlePauseResumeSubscription = async (actionType) => {
    if (!subscription) return;
    setCheckoutLoading(true);
    try {
      const nextStatus = actionType === 'pause' ? 'paused' : 'active';
      const res = await fetch('/api/billing-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isSimulation: true,
          gateway: subscription.gateway || 'stripe',
          transactionId: subscription.planHistory?.[subscription.planHistory.length - 1]?.transactionId || `txn_pause_${Date.now()}`,
          eventId: `evt_pause_${Date.now()}`,
          eventType: actionType === 'pause' ? 'subscription.paused' : 'subscription.resumed',
          paymentStatus: 'success'
        })
      });
      
      if (db) {
        const subDoc = doc(db, 'subscriptions', user.uid);
        await updateDoc(subDoc, { 
          status: nextStatus,
          updatedAt: new Date().toISOString()
        }).catch(() => {});
      }
      
      setToastMessage(actionType === 'pause' ? "Subscription paused." : "Subscription resumed.");
    } catch (e) {
      setToastMessage("Action failed.");
    } finally {
      setCheckoutLoading(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!user || !displayName.trim()) return;

    if (db) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { name: displayName.trim() });
      } catch (err) {
        console.warn("Firestore name save failed:", err);
      }
    }
    setToastMessage("Profile name updated!");
    setTimeout(() => setToastMessage(''), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary text-primary flex items-center justify-center transition-colors duration-300">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const email = user?.email || "Not available";
  const userInitial = displayName.charAt(0).toUpperCase() || 'S';
  const displayUid = user?.uid ? (user.uid.length >= 10 ? user.uid.substring(0, 10) : user.uid) : "N/A";

  return (
    <div className="h-screen w-full bg-bg-primary text-primary flex flex-col overflow-hidden transition-colors duration-300">
      
      {/* 1. APP HEADER */}
      <header className="h-16 border-b border-border-theme bg-card flex items-center justify-between px-6 flex-shrink-0 z-10 transition-colors duration-300">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (window.innerWidth >= 1024) {
                toggleDesktopSidebar();
              } else {
                toggleMobileSidebar();
              }
            }}
            className="p-2 hover:bg-bg-secondary rounded-2xl text-primary transition-colors duration-300"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5 text-muted" />
          </button>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 hover:bg-bg-secondary rounded-2xl text-primary transition-colors duration-300"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <h1 className="text-lg font-black text-primary font-sans transition-colors duration-300">
            Student Profile
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-bg-secondary rounded-2xl text-primary transition-colors duration-300"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-muted" /> : <Moon className="w-5 h-5 text-muted" />}
          </button>
        </div>
      </header>

      {/* 2. BODY LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* MOBILE/TABLET SIDEBAR BACKDROP */}
        {mobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9990] transition-opacity lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* LEFT SIDEBAR */}
        <div
          className={`fixed lg:static top-0 left-0 bottom-0 h-full z-[9995] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-card border-r border-border-theme lg:border-none ${
            // Mobile & Tablet styling (<1024px)
            mobileSidebarOpen 
              ? 'w-[280px] translate-x-0 block lg:hidden' 
              : 'w-0 -translate-x-full hidden lg:block'
          } ${
            // Desktop styling (>=1024px)
            desktopSidebarOpen 
              ? 'lg:w-[280px] lg:translate-x-0' 
              : 'lg:w-0 lg:-translate-x-full'
          }`}
        >
          <Sidebar
            selectedSubjectId={null}
            onSelectSubject={handleSelectSubject}
            isCollapsed={false}
          />
        </div>

        {/* MIDDLE CONTENT SCROLLING SPACE */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar bg-bg-primary transition-colors duration-300"
        >
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            
            {/* COLUMN 1 & 2: PERSONAL & ACADEMIC INFO + STATS */}
            <div className="xl:col-span-2 space-y-8">
              
              {/* Profile Card & Personal Info (Compressed Header height by 30-40%) */}
              <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative transition-colors duration-300">
                
                {/* Left side: Avatar, Name, Degree, Semester, Tier badge */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Avatar circle */}
                  <div className="relative flex-shrink-0">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-2xl shadow-md border-2 border-h-card select-none">
                      {userInitial}
                    </div>
                    {isPro && (
                      <span className="absolute -bottom-1 -right-1 h-5 w-5 bg-yellow-400 border border-h-card rounded-full flex items-center justify-center text-[10px] text-black font-extrabold select-none shadow">
                        ★
                      </span>
                    )}
                  </div>

                  {/* Name, Degree, Semester, Tags */}
                  <div className="text-center sm:text-left space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <h2 className="text-xl font-black text-primary tracking-tight leading-tight transition-colors duration-300">
                        {displayName}
                      </h2>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        isPro 
                          ? 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border border-yellow-400/20' 
                          : 'bg-bg-secondary text-muted border border-border-theme'
                      }`}>
                        {isPro ? 'Pro Member' : 'Free Member'}
                      </span>
                    </div>
                    
                    <p className="text-muted text-xs font-semibold transition-colors duration-300">
                      {academicInfo.degree.split('(')[0] || 'Student'} • {academicInfo.semester}
                    </p>

                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
                      <div className="flex items-center space-x-1.5 px-3 py-1 bg-bg-secondary rounded-2xl border border-border-theme text-[10px] font-semibold text-muted transition-colors duration-300">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{email}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 px-3 py-1 bg-bg-secondary rounded-2xl border border-border-theme text-[10px] font-semibold text-muted transition-colors duration-300">
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span className="font-mono">ID: {displayUid}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side: Update Name form repositioned to Top-Right */}
                <div className="sm:absolute sm:top-6 sm:right-6 w-full sm:w-auto mt-2 sm:mt-0">
                  <form onSubmit={handleUpdateName} className="flex gap-2 max-w-sm justify-center sm:justify-end">
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display Name"
                      className="px-3 py-1.5 theme-input rounded-2xl text-xs w-36 font-semibold"
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-2xl text-xs font-bold transition-all active:scale-[0.97]"
                    >
                      Update
                    </button>
                  </form>
                </div>

              </div>

              {/* Academic Info Form */}
              <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-4 transition-colors duration-300">
                <div className="flex items-center space-x-2 border-b border-border-theme pb-2 transition-colors duration-300">
                  <GraduationCap className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-primary uppercase tracking-widest transition-colors duration-300">
                    Academic Background
                  </h3>
                </div>

                <form onSubmit={handleSaveAcademicInfo} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-muted uppercase tracking-wider">
                        University / Institution
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-muted" />
                        <input
                          type="text"
                          required
                          value={academicInfo.university}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, university: e.target.value })}
                          className="pl-9 pr-3 py-2.5 theme-input rounded-2xl text-xs w-full font-semibold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-muted uppercase tracking-wider">
                        Degree / Program
                      </label>
                      <div className="relative">
                        <BookOpen className="absolute left-3.5 top-3 w-4 h-4 text-muted" />
                        <input
                          type="text"
                          required
                          value={academicInfo.degree}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, degree: e.target.value })}
                          className="pl-9 pr-3 py-2.5 theme-input rounded-2xl text-xs w-full font-semibold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-muted uppercase tracking-wider">
                        Current Semester
                      </label>
                      <input
                        type="text"
                        required
                        value={academicInfo.semester}
                        onChange={(e) => setAcademicInfo({ ...academicInfo, semester: e.target.value })}
                        className="px-3 py-2.5 theme-input rounded-2xl text-xs w-full font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-muted uppercase tracking-wider">
                        Target GPA / Performance Goal
                      </label>
                      <input
                        type="text"
                        required
                        value={academicInfo.gpa}
                        onChange={(e) => setAcademicInfo({ ...academicInfo, gpa: e.target.value })}
                        className="px-3 py-2.5 theme-input rounded-2xl text-xs w-full font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-muted uppercase tracking-wider">
                        Expected Graduation Year
                      </label>
                      <input
                        type="text"
                        required
                        value={academicInfo.gradYear}
                        onChange={(e) => setAcademicInfo({ ...academicInfo, gradYear: e.target.value })}
                        className="px-3 py-2.5 theme-input rounded-2xl text-xs w-full font-semibold"
                      />
                    </div>

                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-6 rounded-2xl transition-all shadow-sm active:scale-98"
                    >
                      Save Academic Info
                    </button>
                  </div>
                </form>
              </div>

              {/* Workspace Learning Metrics */}
              <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-6 transition-colors duration-300">
                <div className="flex items-center space-x-2 border-b border-border-theme pb-2 transition-colors duration-300">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-primary uppercase tracking-widest transition-colors duration-300">
                    Workspace Statistics
                  </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-bg-secondary rounded-2xl border border-border-theme transition-colors duration-300">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-1">Study Hours</span>
                    <span className="text-xl font-black text-primary transition-colors duration-300">42.5 hrs</span>
                  </div>
                  <div className="p-4 bg-bg-secondary rounded-2xl border border-border-theme transition-colors duration-300">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-1">Topics Mastered</span>
                    <span className="text-xl font-black text-primary transition-colors duration-300">18 / 24</span>
                  </div>
                  <div className="p-4 bg-bg-secondary rounded-2xl border border-border-theme transition-colors duration-300">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-1">Tests Completed</span>
                    <span className="text-xl font-black text-primary transition-colors duration-300">8 Mock Sets</span>
                  </div>
                  <div className="p-4 bg-bg-secondary rounded-2xl border border-border-theme transition-colors duration-300">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-1">Avg Score</span>
                    <span className="text-xl font-black text-green-500 font-sans">91%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-muted transition-colors duration-300">
                      <span>Syllabus Completion progress</span>
                      <span>75% Complete</span>
                    </div>
                    <div className="w-full bg-bg-secondary border border-border-theme h-2 rounded-full overflow-hidden transition-colors duration-300">
                      <div className="bg-blue-600 h-full" style={{ width: '75%' }} />
                    </div>
                  </div>

                  {/* Goal Met */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-muted transition-colors duration-300">
                      <span>Weekly Syllabus Mastery Goals Met</span>
                      <span>4 / 5 Goals (80%)</span>
                    </div>
                    <div className="w-full bg-bg-secondary border border-border-theme h-2 rounded-full overflow-hidden transition-colors duration-300">
                      <div className="bg-green-600 h-full" style={{ width: '80%' }} />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* COLUMN 3: SUBSCRIPTION, ACHIEVEMENTS, PREFERENCES */}
            <div className="space-y-8">
              
              {/* Subscription Status Card */}
              <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-4 transition-colors duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest transition-colors duration-300">
                    Subscription
                  </h3>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border transition-all ${
                    isPro 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' 
                      : 'bg-bg-secondary text-muted border border-border-theme'
                  }`}>
                    {isPro ? `${subscription?.planId === 'student_pro_plus' ? 'Pro+ Active' : 'Pro Active'}` : 'Free Tier'}
                  </span>
                </div>

                {/* Subscription Details container */}
                <div className="p-4 bg-bg-secondary rounded-2xl border border-border-theme space-y-3 relative overflow-hidden transition-colors duration-300">
                  <div className="absolute right-0 bottom-0 opacity-5 translate-x-2 translate-y-2">
                    <Sparkles className="w-20 h-20 text-primary" />
                  </div>
                  
                  {isPro ? (
                    <>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-black text-primary transition-colors duration-300 capitalize">
                          {subscription?.planId?.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted font-semibold">({subscription?.billingPeriod})</span>
                      </div>
                      <div className="text-[10px] text-muted font-bold">
                        Status: <span className={`uppercase font-black ${subscription?.status === 'active' || subscription?.status === 'trialing' ? 'text-green-500' : 'text-red-500'}`}>{subscription?.status}</span>
                      </div>
                      {subscription?.expiresAt && (
                        <div className="text-[10px] text-muted font-semibold">
                          Renews/Expires: {new Date(subscription.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                      {subscription?.status === 'past_due' && (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-[9px] text-red-500 font-bold flex items-center space-x-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Payment Failed! Grace Period active.</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-black text-primary transition-colors duration-300">Free Basic</span>
                      </div>
                      <ul className="text-[10px] text-muted font-semibold space-y-1 list-disc list-inside">
                        <li>Basic AI tutor answers</li>
                        <li>2 workspaces / 3 monthly notes</li>
                        <li>Limited exam generations</li>
                      </ul>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setBillingModalOpen(true)}
                  className="w-full py-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-2xl active:scale-[0.98] transition-all shadow-sm border border-transparent flex items-center justify-center space-x-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isPro ? 'Manage Subscriptions & Invoices' : 'Upgrade to HyperBrain Pro'}</span>
                </button>
              </div>

              {/* Gamified Achievements Grid (Compact circular badges) */}
              <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-4 transition-colors duration-300">
                <div className="flex items-center space-x-2 border-b border-border-theme pb-2 transition-colors duration-300">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest transition-colors duration-300">
                    Achievements
                  </h3>
                </div>

                <div className="flex flex-wrap gap-3.5 justify-center py-2">
                  
                  {/* Badge 1 - Unlocked */}
                  <div className="group relative cursor-help flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-bg-secondary border border-border-theme flex items-center justify-center text-xl shadow-sm hover:scale-105 hover:border-yellow-500/30 transition-all duration-300">
                      🌟
                    </div>
                    <span className="text-[9px] font-bold text-primary mt-1">Pioneer</span>
                    <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 bg-card text-primary text-[9px] p-2.5 rounded-2xl shadow-xl -top-16 left-1/2 -translate-x-1/2 w-36 z-20 border border-border-theme font-medium">
                      <p className="font-bold text-xs text-blue-600 dark:text-blue-400 mb-0.5">Syllabus Pioneer</p>
                      <p className="text-[10px] text-muted">1st syllabus parsed. Unlocked!</p>
                    </div>
                  </div>

                  {/* Badge 2 - Unlocked */}
                  <div className="group relative cursor-help flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-bg-secondary border border-border-theme flex items-center justify-center text-xl shadow-sm hover:scale-105 hover:border-orange-500/30 transition-all duration-300">
                      🔥
                    </div>
                    <span className="text-[9px] font-bold text-primary mt-1">Streak</span>
                    <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 bg-card text-primary text-[9px] p-2.5 rounded-2xl shadow-xl -top-16 left-1/2 -translate-x-1/2 w-36 z-20 border border-border-theme font-medium">
                      <p className="font-bold text-xs text-orange-500 mb-0.5">Streak Master</p>
                      <p className="text-[10px] text-muted">5-day streak hit. Unlocked!</p>
                    </div>
                  </div>

                  {/* Badge 3 - Unlocked */}
                  <div className="group relative cursor-help flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-bg-secondary border border-border-theme flex items-center justify-center text-xl shadow-sm hover:scale-105 hover:border-purple-500/30 transition-all duration-300">
                      🎓
                    </div>
                    <span className="text-[9px] font-bold text-primary mt-1">Exam Ace</span>
                    <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 bg-card text-primary text-[9px] p-2.5 rounded-2xl shadow-xl -top-16 left-1/2 -translate-x-1/2 w-36 z-20 border border-border-theme font-medium">
                      <p className="font-bold text-xs text-purple-600 mb-0.5">Exam Ace</p>
                      <p className="text-[10px] text-muted">Scored &gt;90% on quiz. Unlocked!</p>
                    </div>
                  </div>

                  {/* Badge 4 - Locked */}
                  <div className="group relative cursor-help flex flex-col items-center opacity-60">
                    <div className="h-12 w-12 rounded-full bg-bg-secondary/45 border border-dashed border-border-theme flex items-center justify-center text-xl shadow-sm hover:scale-105 transition-all duration-300 grayscale">
                      🤖
                    </div>
                    <span className="text-[9px] font-bold text-muted mt-1">AI Buddy</span>
                    <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 bg-card text-primary text-[9px] p-2.5 rounded-2xl shadow-xl -top-16 left-1/2 -translate-x-1/2 w-36 z-20 border border-border-theme font-medium">
                      <p className="font-bold text-xs text-muted mb-0.5">AI Buddy (Locked)</p>
                      <p className="text-[10px] text-muted">Ask the AI tutor 50 questions (34/50).</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Preferences Settings Card */}
              <div 
                id="preferences-section"
                className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-4 transition-all duration-300"
              >
                <div className="flex items-center space-x-2 border-b border-border-theme pb-2 transition-colors duration-300">
                  <Volume2 className="w-5 h-5 text-muted transition-colors duration-300" />
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest transition-colors duration-300">
                    Preferences & Settings
                  </h3>
                </div>

                <div className="space-y-4 font-sans text-xs">
                  {/* Theme preference */}
                  <div className="flex items-center justify-between py-1">
                    <div className="space-y-0.5">
                      <p className="font-bold text-primary transition-colors duration-300">Workspace Color Theme</p>
                      <p className="text-[10px] text-muted transition-colors duration-300">Sync interface theme with environment preference</p>
                    </div>
                    
                    <button
                      onClick={toggleTheme}
                      className="px-3.5 py-1.5 bg-bg-secondary hover:bg-card border border-border-theme text-[10px] font-black uppercase tracking-wider rounded-2xl transition-colors duration-300 text-primary"
                    >
                      {theme} mode
                    </button>
                  </div>

                  <hr className="border-border-theme" />

                  {/* Study reminders toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div className="space-y-0.5">
                      <p className="font-bold text-primary transition-colors duration-300">Study Reminders</p>
                      <p className="text-[10px] text-muted transition-colors duration-300">Get reminders to maintain your daily study streak</p>
                    </div>
                    
                    <button
                      onClick={() => handleSavePreferences({ reminders: !preferences.reminders })}
                      className={`h-6 w-11 rounded-full p-0.5 transition-colors duration-300 focus-ring ${
                        preferences.reminders ? 'bg-blue-600' : 'bg-bg-secondary border border-border-theme'
                      }`}
                    >
                      <div className={`h-5 w-5 rounded-full bg-white transition-transform ${
                        preferences.reminders ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <hr className="border-border-theme" />

                  {/* Email report toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div className="space-y-0.5">
                      <p className="font-bold text-primary transition-colors duration-300">Email Digest Reports</p>
                      <p className="text-[10px] text-muted transition-colors duration-300">Receive weekly summaries of mock exam performance</p>
                    </div>
                    
                    <button
                      onClick={() => handleSavePreferences({ emails: !preferences.emails })}
                      className={`h-6 w-11 rounded-full p-0.5 transition-colors duration-300 focus-ring ${
                        preferences.emails ? 'bg-blue-600' : 'bg-bg-secondary border border-border-theme'
                      }`}
                    >
                      <div className={`h-5 w-5 rounded-full bg-white transition-transform ${
                        preferences.emails ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <hr className="border-border-theme" />

                  {/* AI Tutor voice speed */}
                  <div className="space-y-2 py-1">
                    <div className="flex justify-between items-center">
                      <div className="space-y-0.5">
                        <p className="font-bold text-primary transition-colors duration-300">AI Speech Speed</p>
                        <p className="text-[10px] text-muted transition-colors duration-300">Modify audio voice pacing for tutor answers</p>
                      </div>
                      <span className="text-[10px] font-black text-blue-600 bg-bg-secondary border border-border-theme px-2 py-0.5 rounded-full transition-colors duration-300">
                        {preferences.aiSpeed.toFixed(1)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.8"
                      max="1.8"
                      step="0.1"
                      value={preferences.aiSpeed}
                      onChange={(e) => handleSavePreferences({ aiSpeed: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-bg-secondary rounded-full appearance-none cursor-pointer accent-blue-600 border border-border-theme transition-colors duration-300"
                    />
                  </div>

                </div>
              </div>

              {/* Danger Zone Card */}
              <div className="bg-card p-6 rounded-2xl border border-red-500/20 shadow-sm space-y-4 transition-all duration-300">
                <div className="flex items-center space-x-2 border-b border-border-theme pb-2 transition-colors duration-300">
                  <AlertTriangle className="w-5 h-5 text-red-500 transition-colors duration-300" />
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest transition-colors duration-300">
                    Danger Zone
                  </h3>
                </div>

                <div className="space-y-4 font-sans text-xs">
                  <div className="flex items-center justify-between py-1">
                    <div className="space-y-0.5">
                      <p className="font-bold text-red-500 transition-colors duration-300">Purge Study Workspaces</p>
                      <p className="text-[10px] text-muted transition-colors duration-300">Permanently delete all study workspaces, subjects, flashcards, plans, and chat records from your cloud profile.</p>
                    </div>
                    
                    <button
                      onClick={handlePurgeDatabase}
                      disabled={isPurging}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98] transform flex items-center space-x-1.5"
                    >
                      {isPurging ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Purging...</span>
                        </>
                      ) : (
                        <span>Purge Profile</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </motion.div>

      </div>

      {/* Billing & Subscriptions Portal Modal */}
      {billingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in text-slate-800 dark:text-slate-100">
          <div className="bg-card border border-border-theme w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-theme flex items-center justify-between bg-bg-secondary transition-colors duration-300">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                <h2 className="text-sm font-black text-primary uppercase tracking-widest">HyperBrain Billing Portal</h2>
              </div>
              <button 
                onClick={() => setBillingModalOpen(false)}
                className="p-1 rounded-xl hover:bg-card border border-transparent hover:border-border-theme text-muted hover:text-primary transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* CURRENT SUBSCRIPTION SECTION */}
              <div className="bg-bg-secondary p-5 rounded-2xl border border-border-theme space-y-4 transition-colors duration-300">
                <h3 className="font-black text-primary uppercase tracking-wider">Your Active Subscription Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Plan Name</span>
                    <span className="text-sm font-black text-primary transition-colors duration-300 capitalize">
                      {isPro ? subscription?.planId?.replace('_', ' ') : 'Free Basic Tier'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Billing Interval</span>
                    <span className="text-sm font-black text-primary transition-colors duration-300 capitalize text-center">
                      {isPro ? subscription?.billingPeriod : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Expiration Date</span>
                    <span className="text-sm font-black text-primary transition-colors duration-300">
                      {isPro && subscription?.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                </div>

                {isPro && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {subscription?.status === 'active' && (
                      <button
                        onClick={() => handlePauseResumeSubscription('pause')}
                        className="px-3.5 py-1.5 bg-yellow-600/10 border border-yellow-600/30 text-yellow-600 hover:bg-yellow-600/20 text-[10px] font-bold rounded-xl flex items-center space-x-1.5 transition-all"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause Membership</span>
                      </button>
                    )}
                    {subscription?.status === 'paused' && (
                      <button
                        onClick={() => handlePauseResumeSubscription('resume')}
                        className="px-3.5 py-1.5 bg-green-600/10 border border-green-600/30 text-green-600 hover:bg-green-600/20 text-[10px] font-bold rounded-xl flex items-center space-x-1.5 transition-all"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume Membership</span>
                      </button>
                    )}
                    {subscription?.status !== 'cancelled' ? (
                      <button
                        onClick={handleCancelSubscription}
                        className="px-3.5 py-1.5 bg-red-600/10 border border-red-600/30 text-red-600 hover:bg-red-600/20 text-[10px] font-bold rounded-xl flex items-center space-x-1.5 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel Subscription</span>
                      </button>
                    ) : (
                      <div className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl">
                        Subscription is cancelled (Access ends at term end)
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* UPGRADE / PLAN RENEWAL SELECTOR */}
              {(!isPro || subscription?.status === 'cancelled') && (
                <div className="border border-border-theme p-5 rounded-2xl space-y-5">
                  <h3 className="font-black text-primary uppercase tracking-wider">Choose Premium Plan & Billing Cycle</h3>
                  
                  {/* Tiers Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'student_pro', name: 'Student Pro', desc: 'Accelerated study flow', features: ['100 AI Requests/mo', '20 notes creations', '150 active flashcards', '10 Course Workspaces'] },
                      { id: 'student_pro_plus', name: 'Student Pro+', desc: 'Ultimate learning capabilities', features: ['500 AI Requests/mo', '100 notes creations', '1000 active flashcards', '50 Course Workspaces'] }
                    ].map(p => (
                      <div 
                        key={p.id}
                        onClick={() => setCheckoutState(prev => ({ ...prev, planId: p.id }))}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          checkoutState.planId === p.id 
                            ? 'border-blue-600 bg-blue-500/5' 
                            : 'border-border-theme hover:bg-bg-secondary/40'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-black text-primary text-xs uppercase tracking-wider">{p.name}</h4>
                          {checkoutState.planId === p.id && <CheckCircle className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-[10px] text-muted mb-3">{p.desc}</p>
                        <ul className="space-y-1">
                          {p.features.map((f, i) => (
                            <li key={i} className="text-[9px] text-muted flex items-center space-x-1">
                              <span className="text-green-500 font-bold">✓</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Cycles selector */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Billing Frequency</span>
                    <div className="flex space-x-2 bg-bg-secondary p-1 rounded-xl border border-border-theme">
                      {['monthly', 'quarterly', 'annual'].map(cycle => (
                        <button
                          key={cycle}
                          onClick={() => setCheckoutState(prev => ({ ...prev, billingPeriod: cycle }))}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize ${
                            checkoutState.billingPeriod === cycle 
                              ? 'bg-card border border-border-theme text-primary shadow-xs' 
                              : 'text-muted hover:text-primary'
                          }`}
                        >
                          {cycle}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Method selector */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Payment Gateway</span>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'stripe', name: 'Stripe Payment (Global/USD)' },
                        { id: 'razorpay', name: 'Razorpay Payment (India/INR)' }
                      ].map(gateway => (
                        <div
                          key={gateway.id}
                          onClick={() => setCheckoutState(prev => ({ ...prev, gateway: gateway.id }))}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center space-x-2.5 ${
                            checkoutState.gateway === gateway.id 
                              ? 'border-blue-600 bg-blue-500/5 font-bold' 
                              : 'border-border-theme hover:bg-bg-secondary/40 text-muted'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>{gateway.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coupon verification */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Promo Codes / Coupons</span>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="ENTER COUPON CODE"
                        value={checkoutState.couponCode}
                        onChange={(e) => setCheckoutState(prev => ({ ...prev, couponCode: e.target.value.toUpperCase() }))}
                        className="bg-bg-secondary border border-border-theme rounded-xl px-3 py-2 flex-1 text-[10px] font-semibold text-primary uppercase focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <button
                        onClick={handleVerifyCoupon}
                        disabled={checkoutLoading || !checkoutState.couponCode.trim()}
                        className="px-4 py-2 bg-bg-secondary hover:bg-card border border-border-theme rounded-xl text-[10px] font-bold text-primary active:scale-95 transition-all disabled:opacity-50"
                      >
                        Apply Code
                      </button>
                    </div>
                    {couponValidation && (
                      <p className="text-[10px] text-green-500 font-bold">
                        Coupon Applied! Discount: {couponValidation.currency} {couponValidation.discountAmount}
                      </p>
                    )}
                  </div>

                  {/* Order Summary & Pay */}
                  <div className="p-4 bg-bg-secondary border border-border-theme rounded-xl space-y-2 transition-colors duration-300">
                    <div className="flex justify-between font-bold">
                      <span>Base Plan Price:</span>
                      <span>
                        {checkoutState.gateway === 'razorpay' ? '₹' : '$'}
                        {couponValidation ? couponValidation.baseAmount : (checkoutState.gateway === 'razorpay' ? (checkoutState.planId === 'student_pro_plus' ? (checkoutState.billingPeriod === 'annual' ? 7999 : checkoutState.billingPeriod === 'quarterly' ? 2499 : 999) : (checkoutState.billingPeriod === 'annual' ? 3999 : checkoutState.billingPeriod === 'quarterly' ? 1299 : 499)) : (checkoutState.planId === 'student_pro_plus' ? (checkoutState.billingPeriod === 'annual' ? 149.99 : checkoutState.billingPeriod === 'quarterly' ? 49.99 : 19.99) : (checkoutState.billingPeriod === 'annual' ? 79.99 : checkoutState.billingPeriod === 'quarterly' ? 24.99 : 9.99)))}
                      </span>
                    </div>
                    {couponValidation && (
                      <div className="flex justify-between font-bold text-green-500">
                        <span>Discount Coupon:</span>
                        <span>-{couponValidation.currency} {couponValidation.discountAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-muted">
                      <span>GST (18% added):</span>
                      <span>
                        {checkoutState.gateway === 'razorpay' ? '₹' : '$'}
                        {couponValidation ? couponValidation.taxAmount : (Math.round((couponValidation ? couponValidation.taxableAmount : (checkoutState.gateway === 'razorpay' ? (checkoutState.planId === 'student_pro_plus' ? (checkoutState.billingPeriod === 'annual' ? 7999 : checkoutState.billingPeriod === 'quarterly' ? 2499 : 999) : (checkoutState.billingPeriod === 'annual' ? 3999 : checkoutState.billingPeriod === 'quarterly' ? 1299 : 499)) : (checkoutState.planId === 'student_pro_plus' ? (checkoutState.billingPeriod === 'annual' ? 149.99 : checkoutState.billingPeriod === 'quarterly' ? 49.99 : 19.99) : (checkoutState.billingPeriod === 'annual' ? 79.99 : checkoutState.billingPeriod === 'quarterly' ? 24.99 : 9.99)))) * 0.18 * 100) / 100)}
                      </span>
                    </div>
                    <hr className="border-border-theme my-2" />
                    <div className="flex justify-between font-black text-sm text-primary transition-colors">
                      <span>Total Amount:</span>
                      <span>
                        {checkoutState.gateway === 'razorpay' ? '₹' : '$'}
                        {couponValidation ? couponValidation.finalAmount : (Math.round((checkoutState.gateway === 'razorpay' ? (checkoutState.planId === 'student_pro_plus' ? (checkoutState.billingPeriod === 'annual' ? 7999 : checkoutState.billingPeriod === 'quarterly' ? 2499 : 999) : (checkoutState.billingPeriod === 'annual' ? 3999 : checkoutState.billingPeriod === 'quarterly' ? 1299 : 499)) : (checkoutState.planId === 'student_pro_plus' ? (checkoutState.billingPeriod === 'annual' ? 149.99 : checkoutState.billingPeriod === 'quarterly' ? 49.99 : 19.99) : (checkoutState.billingPeriod === 'annual' ? 79.99 : checkoutState.billingPeriod === 'quarterly' ? 24.99 : 9.99))) * 1.18 * 100) / 100)}
                      </span>
                    </div>

                    <button
                      onClick={handleInitiateCheckout}
                      disabled={checkoutLoading}
                      className="w-full mt-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold rounded-xl active:scale-95 shadow-md flex items-center justify-center space-x-2 transition-all"
                    >
                      {checkoutLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Establishing Gateway...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Secure Checkout with {checkoutState.gateway.toUpperCase()}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* INVOICE & BILLING HISTORY LIST */}
              <div className="space-y-3">
                <h3 className="font-black text-primary uppercase tracking-wider">Invoice History & Downloads</h3>
                {invoiceList.length === 0 ? (
                  <div className="p-6 bg-bg-secondary rounded-2xl text-center border border-border-theme transition-colors">
                    <FileText className="w-8 h-8 text-muted mx-auto mb-2 opacity-40" />
                    <p className="text-muted font-bold">No transactions found</p>
                  </div>
                ) : (
                  <div className="border border-border-theme rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-bg-secondary text-muted font-black border-b border-border-theme uppercase">
                          <th className="p-3">Invoice ID</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Plan (Cycle)</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-theme font-semibold text-primary">
                        {invoiceList.map(invoice => (
                          <tr key={invoice.id} className="hover:bg-bg-secondary/40 transition-colors">
                            <td className="p-3 font-mono font-bold">{invoice.id.substring(0, 16)}...</td>
                            <td className="p-3">{new Date(invoice.createdAt || Date.now()).toLocaleDateString()}</td>
                            <td className="p-3 capitalize">{invoice.planId?.replace('_', ' ')} ({invoice.billingPeriod})</td>
                            <td className="p-3 font-bold">{invoice.currency === 'INR' ? '₹' : '$'}{invoice.finalAmount}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                invoice.status === 'paid' ? 'bg-green-600/10 text-green-500' :
                                invoice.status === 'refunded' ? 'bg-amber-600/10 text-amber-500' :
                                'bg-red-600/10 text-red-500'
                              }`}>
                                {invoice.status}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <a
                                href={`/api/billing-invoice?txn_id=${invoice.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-bg-secondary hover:bg-card border border-border-theme rounded-lg text-primary transition-all active:scale-95"
                              >
                                <Download className="w-3 h-3 text-blue-500" />
                                <span>PDF</span>
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Simulated Gateway Dialog Overlay */}
      {showSimulatedCheckout && simulatedCheckoutData && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-slate-100">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-indigo-500 animate-pulse" />
                <span className="font-black text-xs uppercase tracking-widest text-slate-300">Simulated Payment Gateway</span>
              </div>
              <button 
                onClick={() => setShowSimulatedCheckout(false)}
                className="text-slate-400 hover:text-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Merchant:</span>
                  <span className="text-slate-200">HyperBrain Premium Services</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Transaction ID:</span>
                  <span className="text-slate-200 font-mono text-[10px]">{simulatedCheckoutData.transactionId}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Amount Due:</span>
                  <span className="text-indigo-400 font-bold text-sm">
                    {checkoutState.gateway === 'razorpay' ? '₹' : '$'}
                    {couponValidation ? couponValidation.finalAmount : (Math.round((checkoutState.gateway === 'razorpay' ? (checkoutState.planId === 'student_pro_plus' ? (checkoutState.billingPeriod === 'annual' ? 7999 : checkoutState.billingPeriod === 'quarterly' ? 2499 : 999) : (checkoutState.billingPeriod === 'annual' ? 3999 : checkoutState.billingPeriod === 'quarterly' ? 1299 : 499)) : (checkoutState.planId === 'student_pro_plus' ? (checkoutState.billingPeriod === 'annual' ? 149.99 : checkoutState.billingPeriod === 'quarterly' ? 49.99 : 19.99) : (checkoutState.billingPeriod === 'annual' ? 79.99 : checkoutState.billingPeriod === 'quarterly' ? 24.99 : 9.99))) * 1.18 * 100) / 100)}
                  </span>
                </div>
              </div>

              {/* Fake credit card details */}
              <div className="bg-gradient-to-tr from-slate-800 to-indigo-950 p-5 rounded-2xl border border-slate-700 shadow-lg text-white font-mono space-y-5">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Developer Card Simulator</span>
                  <span className="text-xs font-black">VISA</span>
                </div>
                <div className="text-md font-bold tracking-widest text-center py-1">
                  4111 &nbsp; 2222 &nbsp; 3333 &nbsp; 4444
                </div>
                <div className="flex justify-between text-[9px] uppercase tracking-wider opacity-75">
                  <div>
                    <span className="block text-[7px] opacity-60">Card Holder</span>
                    <span>{displayName.toUpperCase() || 'DEVELOPER'}</span>
                  </div>
                  <div>
                    <span className="block text-[7px] opacity-60">Expiry</span>
                    <span>12 / 29</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl text-[10px] text-indigo-400 font-semibold flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-indigo-500 mt-0.5" />
                <span>You are in developer simulation sandbox. Test subscription upgrades or failed payments to evaluate grace period actions.</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleSimulatePayment('failed')}
                className="py-2.5 bg-red-900 hover:bg-red-800 text-red-100 font-bold rounded-xl active:scale-95 transition-all text-xs"
              >
                Simulate Payment Failure
              </button>
              <button
                onClick={() => handleSimulatePayment('success')}
                className="py-2.5 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl active:scale-95 transition-all text-xs"
              >
                Simulate Success
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-card border border-border-theme text-primary text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 animate-fade-in transition-colors duration-300">
          <Check className="w-4 h-4 text-green-500" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
