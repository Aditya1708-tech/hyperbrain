import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../services/firebase/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { BrainCircuit, Mail, Lock, Loader2, ShieldAlert, LogOut, ArrowLeft } from "lucide-react";
import hyperBrainLogo from "../../assets/logos/logo.png";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Card from "../../components/common/Card";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { currentUser, userProfile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Clean error messages on input
  useEffect(() => {
    setErrorMsg("");
  }, [email, password]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      // The auth observer will update the context, which will trigger the role check below.
    } catch (err) {
      console.error("Admin login error:", err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/user-not-found") {
        setErrorMsg("Access Denied: Incorrect Admin ID or Access Code.");
      } else {
        setErrorMsg(`Authentication Failed: ${err.message || err.code}`);
      }
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setEmail("");
      setPassword("");
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // If still loading session/profile
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-secondary flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">Verifying credentials...</span>
      </div>
    );
  }

  // If user is logged in
  if (currentUser) {
    if (userProfile?.role === "Administrator") {
      return <Navigate to="/admin/dashboard" replace />;
    }

    // Authenticated but NOT an administrator (Access Denied)
    return (
      <div className="min-h-screen bg-bg-secondary text-primary flex flex-col items-center justify-center p-6 transition-colors duration-300 relative select-none">
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src={hyperBrainLogo}
            alt="HyperBrain Logo"
            className="h-16 w-auto object-contain mb-4"
          />
          <h2 className="text-xl font-bold tracking-tight text-primary font-sans">HyperBrain Admin Console</h2>
        </div>

        <Card className="w-full max-w-[420px] bg-card border border-red-500/25 shadow-2xl p-8 space-y-6 text-primary flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-550 border border-red-500/20">
            <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-extrabold tracking-tight text-red-500">Access Denied</h3>
            <p className="text-xs text-muted font-semibold leading-relaxed">
              Your account does not have administrator privileges.
            </p>
          </div>

          <div className="w-full bg-bg-secondary border border-border-theme p-3 rounded-xl text-left">
            <p className="text-[9px] font-black uppercase text-muted tracking-wider leading-none">Logged in as</p>
            <p className="text-xs font-bold truncate mt-1 text-primary">{currentUser.email}</p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <Button
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full py-3 bg-red-650 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 border border-red-800"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>TERMINATE SESSION & SWITCH ACCOUNT</span>
            </Button>

            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3 bg-bg-secondary hover:bg-hover-theme text-primary font-bold text-xs rounded-xl border border-border-theme flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>RETURN TO STUDENT PORTAL</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Unauthenticated: Show Login screen
  return (
    <div className="min-h-screen bg-bg-secondary text-primary flex flex-col items-center justify-center p-6 transition-colors duration-300 relative select-none">
      <div className="flex flex-col items-center text-center mb-8">
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
        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold text-center leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Admin ID"
            icon={Mail}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@hyperbrain.ai"
            className="bg-bg-secondary border-border-theme text-primary placeholder-muted"
          />

          <Input
            label="Access Code"
            icon={Lock}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-bg-secondary border-border-theme text-primary placeholder-muted"
          />

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : null}
            <span>SECURE AUTHORIZATION</span>
          </Button>
        </form>
      </Card>
    </div>
  );
}
