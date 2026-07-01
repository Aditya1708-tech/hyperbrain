import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../services/firebase/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { ThemeContext } from '../../contexts/ThemeContext';
import Sidebar from '../../components/layout/Sidebar';
import { 
  ArrowLeft, Mail, Fingerprint, Loader2, Menu, Sparkles, Check, 
  Volume2, BookOpen, GraduationCap, Building2, 
  Trophy, BarChart3, Sun, Moon 
} from 'lucide-react';

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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

  const handleTogglePro = async () => {
    if (!user) return;
    const nextProState = !isPro;
    setIsPro(nextProState);
    
    if (db) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { isPro: nextProState });
      } catch (err) {
        console.warn("Firestore Pro toggle failed, local fallback:", err);
      }
    }
    localStorage.setItem(`isPro_${user.uid}`, nextProState ? 'true' : 'false');
    setToastMessage(nextProState ? "Upgraded to HyperBrain Pro!" : "Downgraded subscription tier.");
    setTimeout(() => setToastMessage(''), 3000);
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
    <div className="h-screen w-screen bg-bg-primary text-primary flex flex-col overflow-hidden transition-colors duration-300">
      
      {/* 1. APP HEADER */}
      <header className="h-16 border-b border-border-theme bg-card flex items-center justify-between px-6 flex-shrink-0 z-10 transition-colors duration-300">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
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
        
        {/* LEFT SIDEBAR */}
        <div
          className={`transition-all duration-250 overflow-hidden flex-shrink-0 h-full ${
            isSidebarOpen ? 'w-[280px]' : 'w-0 sm:w-[84px]'
          }`}
        >
          <Sidebar
            selectedSubjectId={null}
            onSelectSubject={handleSelectSubject}
            isCollapsed={!isSidebarOpen}
          />
        </div>

        {/* MIDDLE CONTENT SCROLLING SPACE */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar bg-bg-primary transition-colors duration-300">
          
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
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all ${
                    isPro 
                      ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400' 
                      : 'bg-bg-secondary text-muted border border-border-theme'
                  }`}>
                    {isPro ? 'Pro Active' : 'Free Tier'}
                  </span>
                </div>

                {/* Subcription Details container */}
                <div className="p-4 bg-bg-secondary rounded-2xl border border-border-theme space-y-3 relative overflow-hidden transition-colors duration-300">
                  <div className="absolute right-0 bottom-0 opacity-5 translate-x-2 translate-y-2">
                    <Sparkles className="w-20 h-20 text-primary" />
                  </div>
                  
                  {isPro ? (
                    <>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-black text-primary transition-colors duration-300">$79.99</span>
                        <span className="text-xs text-muted font-semibold transition-colors duration-300">/year</span>
                      </div>
                      <div className="text-xs font-bold text-primary">Pro Plan</div>
                      <ul className="text-[10px] text-muted font-semibold space-y-1 list-disc list-inside">
                        <li>Unlimited AI tutor mapping</li>
                        <li>Unlimited active courses</li>
                        <li>Unlimited mock exams</li>
                      </ul>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-black text-primary transition-colors duration-300">Free Plan</span>
                      </div>
                      <ul className="text-[10px] text-muted font-semibold space-y-1 list-disc list-inside">
                        <li>Basic AI tutor</li>
                        <li>2 active courses</li>
                        <li>Limited mock exams</li>
                      </ul>
                    </>
                  )}
                </div>

                <button
                  onClick={handleTogglePro}
                  className={`w-full py-2.5 text-center text-xs font-bold rounded-2xl active:scale-[0.98] transition-all shadow-sm border ${
                    isPro 
                      ? 'bg-card hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/10 dark:hover:text-red-400 border-border-theme text-primary' 
                      : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-transparent'
                  }`}
                >
                  {isPro ? 'Cancel Pro Membership' : 'Upgrade to Pro Account'}
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

            </div>

          </div>

        </div>

      </div>

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
