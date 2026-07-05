import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import hyperBrainLogo from "../../assets/logos/logo.png";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Card from "../../components/common/Card";

export default function AdminLogin() {
  const navigate = useNavigate();
  
  // Input fields state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Check if admin is already logged in via sessionStorage
  const isAdminAuthenticated = sessionStorage.getItem("hyperbrain_admin") === "authenticated";

  // Clean error messages when user types
  useEffect(() => {
    setErrorMsg("");
  }, [username, password]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setIsLoading(true);
    setErrorMsg("");

    // Simulate network authentication transition delay
    setTimeout(() => {
      const configUsername = import.meta.env.VITE_ADMIN_USERNAME || "Aditya";
      const configPassword = import.meta.env.VITE_ADMIN_PASSWORD || "HelloWorld!";

      if (
        username.trim() === configUsername && 
        password === configPassword
      ) {
        sessionStorage.setItem("hyperbrain_admin", "authenticated");
        setIsLoading(false);
        navigate("/admin/dashboard");
      } else {
        setErrorMsg("Invalid administrator credentials.");
        setIsLoading(false);
      }
    }, 800);
  };

  // If already authenticated, redirect directly to dashboard
  if (isAdminAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Decorative backdrop glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      {/* Header Container */}
      <div className="flex flex-col items-center text-center mb-8 z-10">
        <img
          src={hyperBrainLogo}
          alt="HyperBrain Logo"
          className="h-16 w-auto object-contain mb-4 animate-fade-in hover:scale-105 transition-transform duration-300"
        />
        <h2 className="text-xl font-bold tracking-tight text-white font-sans uppercase tracking-wider">
          HyperBrain Platform
        </h2>
        <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-1.5 bg-blue-950/40 px-3 py-1 rounded-full border border-blue-900/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Beta Administrative Console</span>
        </p>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-[380px] bg-slate-900/80 backdrop-blur-md border border-slate-800/80 shadow-2xl p-8 space-y-6 text-slate-100 z-10 rounded-2xl relative">
        {/* Glow border line on top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-t-2xl" />

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold text-center flex items-center justify-center space-x-2 leading-relaxed animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-0.5">
              Admin Identity
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="w-4.5 h-4.5 text-slate-500" />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full pl-10 pr-4 py-3 bg-[#0d1527] border border-slate-850 focus:border-blue-600 rounded-xl focus:ring-1 focus:ring-blue-600 outline-none text-slate-200 placeholder-slate-650 text-xs transition-colors duration-300 font-semibold"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-0.5">
              Access Credentials
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-4.5 h-4.5 text-slate-500" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-[#0d1527] border border-slate-850 focus:border-blue-600 rounded-xl focus:ring-1 focus:ring-blue-600 outline-none text-slate-200 placeholder-slate-650 text-xs transition-colors duration-300 font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Secure Sign In Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : null}
            <span className="tracking-wider">SECURE AUTHORIZATION</span>
          </Button>
        </form>
      </Card>
      
      {/* Footer warning */}
      <span className="mt-8 text-[9px] font-semibold text-slate-600 uppercase tracking-widest text-center max-w-[280px]">
        Authorized administrative access only. Log files are monitored.
      </span>
    </div>
  );
}
