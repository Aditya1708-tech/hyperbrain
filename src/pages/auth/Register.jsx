import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../../services/firebase/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { BrainCircuit, User, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import hyperBrainLogo from '../../assets/logos/logo.png';
import { analyticsService } from '../../services/firebase/firestoreService';
import { notificationService } from '../../services/firebase/firestoreService';

export default function RegistrationScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });
      
      // Save user profile directly to Firestore database
      if (db) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          name,
          email,
          role: 'Student',
          status: 'active',
          isPro: false,
          createdAt: serverTimestamp()
        }, { merge: true });
      }

      // Telemetry log registration
      await analyticsService.logRegistration(email);
      await notificationService.notifyAdmin('New Signup', `${name} registered Basic student account.`, 'registration', '🟢');

      // Trigger Vercel welcome email API
      try {
        await fetch('/api/sendWelcomeEmail', {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: user.uid,
            userEmail: email,
            userName: name
          })
        });
      } catch (emailErr) {
        console.warn("Welcome email trigger failed, handled gracefully:", emailErr);
      }

      setSuccessMsg('Registration successful! Redirecting...');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-primary flex flex-col transition-colors duration-300">
      
      {/* 1. NAVIGATION BAR */}
      <nav className="bg-card border-b border-border-theme sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo brand */}
          <div className="flex items-center space-x-2.5 cursor-pointer pl-1 hover:opacity-95 transition-opacity" onClick={() => navigate('/')}>
            <BrainCircuit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight leading-none">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Hyper</span>
                <span className="text-primary">Brain</span>
              </span>
              <span className="hidden sm:inline text-[9px] font-black uppercase tracking-wider text-muted mt-0.5 leading-none transition-colors duration-300">
                AI-Powered Academic Intelligence
              </span>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => navigate('/login')}
            className="flex items-center text-sm font-semibold text-muted hover:text-primary transition-colors duration-300 focus-ring"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6 bg-bg-primary transition-colors duration-300">
        <div className="w-full max-w-[400px] bg-card p-8 rounded-2xl border border-border-theme shadow-sm transition-colors duration-300">
          <div className="flex flex-col items-center mb-8 select-none">
            <img
              src={hyperBrainLogo}
              alt="HyperBrain Logo"
              className="h-20 w-auto object-contain hover:scale-[1.02] transition-transform duration-300 mb-2"
            />
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-lg text-sm font-medium">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider transition-colors duration-300">
                Full Name
              </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center">
                    <User className="w-5 h-5 text-muted" />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 bg-bg-secondary dark:bg-slate-950/40 border border-border-theme rounded-2xl focus-ring text-primary placeholder-h-secondary text-sm transition-colors duration-300"
                  />
                </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider transition-colors duration-300">
                Email Address
              </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center">
                    <Mail className="w-5 h-5 text-muted" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full pl-10 pr-4 py-3 bg-bg-secondary dark:bg-slate-950/40 border border-border-theme rounded-2xl focus-ring text-primary placeholder-h-secondary text-sm transition-colors duration-300"
                  />
                </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider transition-colors duration-300">
                Password
              </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center">
                    <Lock className="w-5 h-5 text-muted" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-10 pr-4 py-3 bg-bg-secondary dark:bg-slate-950/40 border border-border-theme rounded-2xl focus-ring text-primary placeholder-h-secondary text-sm transition-colors duration-300"
                  />
                </div>
            </div>

            {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3 rounded-2xl transition-all shadow-sm flex items-center justify-center space-x-2 text-sm focus-ring"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Register</span>
                )}
              </button>
          </form>
        </div>
      </main>
    </div>
  );
}
