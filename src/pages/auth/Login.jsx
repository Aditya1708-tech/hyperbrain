import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/firebase';
import { BrainCircuit, Mail, Lock, Loader2 } from 'lucide-react';
import hyperBrainLogo from '../../assets/logos/logo.png';

export default function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      navigate('/dashboard');
    } catch (e) {
      console.error(e);
      if (e.code === 'auth/user-not-found') {
        setInfoMsg("Account not found. Redirecting to Register...");
        setTimeout(() => {
          navigate('/register', { state: { email, password } });
        }, 1500);
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setErrorMsg("Incorrect Password.");
      } else {
        setErrorMsg(`Login Failed: ${e.message || e.code}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg("Please enter your email first!");
      return;
    }
    setErrorMsg('');
    setInfoMsg('');

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMsg("Reset link sent! Check your email.");
    } catch (e) {
      console.error(e);
      setErrorMsg(`Error: ${e.message}`);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCred = await signInWithPopup(auth, provider);
      if (userCred.user) {
        const user = userCred.user;
        const userDocRef = doc(db, 'users', user.uid);
        
        let userDoc = null;
        try {
          userDoc = await getDoc(userDocRef);
        } catch (readErr) {
          console.error("Firestore read error:", readErr);
          throw new Error("Could not verify user registration. Please check your connection.");
        }

        if (!userDoc || !userDoc.exists()) {
          try {
            await setDoc(userDocRef, {
              email: user.email,
              displayName: user.displayName || user.email.split('@')[0],
              photoURL: user.photoURL,
              role: "student",
              createdAt: serverTimestamp()
            });
          } catch (writeErr) {
            console.error("Firestore registration write error:", writeErr);
            throw new Error("Could not complete user registration in database. Please check Firestore security rules.");
          }
        }

        navigate('/dashboard');
      }
    } catch (e) {
      console.error("Authentication Error:", e);
      setErrorMsg(`Authentication failed: ${e.message || e.toString()}`);
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
            onClick={() => navigate('/')}
            className="text-sm font-semibold text-muted hover:text-primary transition-colors duration-300 focus-ring"
          >
            Back to Home
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-bg-primary transition-colors duration-300">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8 select-none">
          <img
            src={hyperBrainLogo}
            alt="HyperBrain Logo"
            className="h-20 w-auto object-contain hover:scale-[1.02] transition-transform duration-300 mb-2"
          />
          <p className="text-muted text-sm tracking-wider uppercase font-semibold mt-1.5 transition-colors duration-300">
            AI-Powered Academic Intelligence
          </p>
        </div>

        {/* Form Card */}
        <div className="w-full max-w-[360px] bg-card p-6 rounded-2xl border border-border-theme shadow-sm transition-colors duration-300">
        
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3 bg-blue-600/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl text-sm font-semibold">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <Mail className="w-5 h-5 text-muted" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full pl-10 pr-4 py-3 bg-bg-secondary dark:bg-slate-950/40 border border-border-theme rounded-2xl focus-ring text-primary placeholder-h-secondary text-sm transition-colors duration-300"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <Lock className="w-5 h-5 text-muted" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-4 py-3 bg-bg-secondary dark:bg-slate-950/40 border border-border-theme rounded-2xl focus-ring text-primary placeholder-h-secondary text-sm transition-colors duration-300"
              />
            </div>
          </div>

          {/* Forgot Password */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs font-bold text-muted hover:underline hover:text-primary transition-colors duration-300"
            >
              Forgot Password?
            </button>
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
                <span>Logging in...</span>
              </>
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-5">
          <div className="flex-1 border-t border-border-theme"></div>
          <span className="px-3 text-xs text-muted font-bold">OR</span>
          <div className="flex-1 border-t border-border-theme"></div>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full h-[50px] border border-border-theme rounded-2xl flex items-center justify-center gap-3 bg-card hover:bg-bg-secondary transition-colors duration-300 font-semibold text-primary cursor-pointer"
        >
          {/* Modern inline Google icon */}
          <svg className="w-5 h-5 min-w-[20px] min-h-[20px]" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Registration redirect */}
        <div className="text-center mt-6 text-xs text-muted transition-colors duration-300">
          New here?{' '}
          <button
            onClick={() => navigate('/register')}
            className="font-bold text-primary underline transition-colors duration-300"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
