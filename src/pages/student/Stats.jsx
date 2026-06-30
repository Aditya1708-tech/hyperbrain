import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import { ArrowLeft, BookOpen, Layers, Award, Loader2, BarChart2 } from 'lucide-react';

export default function StatsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    coursesCount: 0,
    topicsCount: 0,
    uid: "N/A"
  });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
        return;
      }

      const truncatedUid = user.uid.length >= 10 ? user.uid.substring(0, 10) : user.uid;

      if (db) {
        const subjectsRef = collection(db, 'users', user.uid, 'subjects');
        const unsubFirestore = onSnapshot(subjectsRef, (snapshot) => {
          let tCount = 0;
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.topics && Array.isArray(data.topics)) {
              tCount += data.topics.length;
            }
          });
          setStats({
            coursesCount: snapshot.docs.length,
            topicsCount: tCount,
            uid: truncatedUid
          });
          setLoading(false);
        }, (err) => {
          console.warn("Firestore stats error, fallback local storage", err);
          const local = JSON.parse(localStorage.getItem(`courses_${user.uid}`) || '[]');
          let tCount = 0;
          local.forEach(c => {
            if (c.topics && Array.isArray(c.topics)) tCount += c.topics.length;
          });
          setStats({
            coursesCount: local.length,
            topicsCount: tCount,
            uid: truncatedUid
          });
          setLoading(false);
        });

        return () => unsubFirestore();
      } else {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary text-primary flex items-center justify-center transition-colors duration-300">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-primary flex flex-col transition-colors duration-300">
      
      {/* Header */}
      <header className="h-16 bg-card border-b border-border-theme flex items-center px-6 transition-colors duration-300">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-1.5 hover:bg-bg-secondary rounded-lg text-muted mr-4 transition-colors duration-300"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-black text-primary transition-colors duration-300">
          Performance Analytics
        </h1>
      </header>

      {/* Main Stats Grid */}
      <main className="flex-1 p-6 md:p-8 max-w-4xl mx-auto w-full space-y-8 bg-bg-primary transition-colors duration-300">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stat 1 */}
          <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm flex flex-col justify-between h-36 hover:shadow-md transition-all duration-300 text-primary">
            <div className="flex justify-between items-start">
              <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">+12% this month</span>
            </div>
            <div>
              <p className="text-muted text-[10px] font-bold uppercase tracking-widest transition-colors duration-305">Courses Enrolled</p>
              <h3 className="text-2xl font-bold text-primary mt-1 transition-colors duration-300">{stats.coursesCount}</h3>
            </div>
          </div>
          {/* Stat 2 */}
          <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm flex flex-col justify-between h-36 hover:shadow-md transition-all duration-300 text-primary">
            <div className="flex justify-between items-start">
              <Layers className="h-6 w-6 text-green-600 dark:text-green-400" />
              <span className="text-[10px] font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">Optimal</span>
            </div>
            <div>
              <p className="text-muted text-[10px] font-bold uppercase tracking-widest transition-colors duration-305">Learning Modules</p>
              <h3 className="text-2xl font-bold text-primary mt-1 transition-colors duration-300">{stats.topicsCount}</h3>
            </div>
          </div>
          {/* Stat 3 */}
          <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm flex flex-col justify-between h-36 hover:shadow-md transition-all duration-300 text-primary">
            <div className="flex justify-between items-start">
              <Award className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded-full">Active</span>
            </div>
            <div>
              <p className="text-muted text-[10px] font-bold uppercase tracking-widest transition-colors duration-305">Global Standing</p>
              <h3 className="text-2xl font-bold text-primary mt-1 transition-colors duration-300">Top 10%</h3>
            </div>
          </div>
        </div>

        {/* Progress section */}
        <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-4 transition-colors duration-300 text-primary">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted transition-colors duration-300">Syllabus Completion Progress</h4>
          <div className="w-full bg-bg-secondary border border-border-theme h-2 rounded-full overflow-hidden transition-colors duration-300">
            <div className="bg-blue-600 h-full w-[72%] rounded-full" />
          </div>
          <div className="flex justify-between text-xs font-semibold text-muted transition-colors duration-300">
            <span>72% of curriculum study materials fully generated</span>
            <span>Target: 100%</span>
          </div>
        </div>

        {/* Timeline activity list */}
        <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm space-y-5 transition-colors duration-300 text-primary">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted transition-colors duration-300">Recent Exam History</h4>
          <div className="space-y-4 text-xs font-semibold text-muted transition-colors duration-300">
            <div className="flex justify-between items-center pb-3 border-b border-border-theme">
              <span className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                <span className="text-primary">Web Development Set A Exam</span>
              </span>
              <span className="text-primary font-bold">Grade: 92/100</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border-theme">
              <span className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                <span className="text-primary">Operating Systems Set B Exam</span>
              </span>
              <span className="text-primary font-bold">Grade: 85/100</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
                <span className="text-primary">Data Structures Set C Exam</span>
              </span>
              <span className="text-muted font-bold">Pending Review</span>
            </div>
          </div>
        </div>

        {/* User reference row */}
        <div className="bg-card p-6 rounded-2xl border border-border-theme shadow-sm transition-colors duration-300 text-primary">
          <div className="flex items-center space-x-3 text-muted transition-colors duration-300">
            <BarChart2 className="h-5 w-5 text-muted" />
            <span className="text-xs font-bold uppercase tracking-wider">Student Session ID:</span>
            <span className="text-xs font-bold text-primary font-mono">{stats.uid}</span>
          </div>
        </div>

      </main>
    </div>
  );
}
