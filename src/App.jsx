import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './services/firebase/firebase';
import { ThemeProvider } from './contexts/ThemeContext';
import { WifiOff, Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import HealthCheck from './pages/HealthCheck';
import { analyticsService } from './services/firebase/firestoreService';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';

// Immediate/Critical core pages
import Landing from './pages/landing/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/student/Dashboard';
import Profile from './pages/student/Profile';
import Exam from './pages/student/Exam';

// Lazy loaded feature areas and charts
const Stats = lazy(() => import('./pages/student/Stats'));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));
const Tutor = lazy(() => import('./pages/student/Tutor'));
const MockExamSetup = lazy(() => import('./pages/student/MockExamSetup'));
const Flashcards = lazy(() => import('./pages/student/Flashcards'));
const StudyPlan = lazy(() => import('./pages/student/StudyPlan'));
const Progress = lazy(() => import('./pages/student/Progress'));
const Preferences = lazy(() => import('./pages/student/Preferences'));
const CourseWorkspace = lazy(() => import('./pages/student/CourseWorkspace'));

// Custom Offline Banner
function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2.5 text-center text-xs font-bold tracking-wide flex items-center justify-center space-x-2 animate-pulse select-none z-[9999] relative border-b border-red-700 shadow-sm">
      <WifiOff className="w-4 h-4 animate-bounce" />
      <span>You're offline. Some features may be unavailable.</span>
    </div>
  );
}

// Global page visits tracking subcomponent
function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    analyticsService.logEvent('page_visit', { path: location.pathname });
  }, [location]);

  return null;
}

// Suspense Loader Component
const LoadingFallback = () => (
  <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center space-y-4">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    <span className="text-[10px] font-black uppercase tracking-widest text-muted">Securing workspace...</span>
  </div>
);

export default function App() {
  useEffect(() => {
    let userRef = null;
    const startTime = Date.now();

    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        if (userRef) {
          updateDoc(userRef, {
            isOnline: false,
            lastActive: serverTimestamp()
          }).catch(err => console.warn("Firestore status update failed:", err));
          userRef = null;
        }
        return;
      }

      userRef = doc(db, 'users', user.uid);
      setDoc(userRef, {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        isOnline: true,
        lastActive: serverTimestamp()
      }, { merge: true }).catch(err => console.warn("Firestore status set failed:", err));
    });

    const handleUnload = () => {
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      analyticsService.logEvent('session_duration', { durationSeconds }).catch(() => {});
      if (userRef) {
        updateDoc(userRef, {
          isOnline: false,
          lastActive: serverTimestamp()
        }).catch(err => console.warn("Firestore status unload update failed:", err));
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      unsub();
      window.removeEventListener('beforeunload', handleUnload);
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      analyticsService.logEvent('session_duration', { durationSeconds }).catch(() => {});
      if (userRef) {
        updateDoc(userRef, {
          isOnline: false,
          lastActive: serverTimestamp()
        }).catch(err => console.warn("Firestore status cleanup update failed:", err));
      }
    };
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <OfflineBanner />
        <PageTracker />
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/health" element={<HealthCheck />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
              <Route path="/exam/:subjectName" element={<ProtectedRoute><Exam /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
              
              {/* New distraction-free routes */}
              <Route path="/tutor" element={<ProtectedRoute><Tutor /></ProtectedRoute>} />
              <Route path="/mock-exam" element={<ProtectedRoute><MockExamSetup /></ProtectedRoute>} />
              <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
              <Route path="/study-plan" element={<ProtectedRoute><StudyPlan /></ProtectedRoute>} />
              <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
              <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
              <Route path="/course/:courseId" element={<ProtectedRoute><CourseWorkspace /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Router>
    </ThemeProvider>
  );
}
