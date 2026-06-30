import React from 'react';
import { AlertCircle } from 'lucide-react';
import { auth, db } from '../../services/firebase/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  async componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught runtime exception:", error, errorInfo);
    
    // Log caught errors to Firestore error_logs
    try {
      if (db) {
        const userId = auth.currentUser?.uid || 'anonymous';
        const page = window.location.pathname;
        const errorMessage = error?.message || error?.toString() || 'Unknown Exception';
        const stackTrace = error?.stack || errorInfo?.componentStack || '';
        
        await addDoc(collection(db, 'error_logs'), {
          userId,
          page,
          errorMessage,
          stackTrace,
          timestamp: new Date()
        });
      }
    } catch (dbErr) {
      console.warn("Could not log boundary exception to Firestore:", dbErr);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-secondary text-primary flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md bg-card p-8 rounded-2xl border border-red-500/20 shadow-xl space-y-6">
            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-full border border-red-200 dark:border-red-900/40 w-fit mx-auto text-red-500">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-black text-primary uppercase tracking-widest">
                Something went wrong
              </h2>
              <p className="text-xs text-muted font-semibold leading-relaxed">
                HyperBrain encountered an unexpected execution error. Try refreshing or navigating back to the main dashboard.
              </p>
            </div>
            {this.state.error && (
              <pre className="text-[10px] text-red-650 bg-red-50/50 dark:bg-red-955/10 p-3 rounded-xl overflow-x-auto text-left font-mono max-h-36">
                {this.state.error.toString()}
              </pre>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
              >
                Retry
              </button>
              <button
                onClick={this.handleGoDashboard}
                className="flex-1 py-2.5 border border-border-theme hover:bg-bg-secondary text-primary text-xs font-bold rounded-xl transition-all active:scale-95"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
