import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/common/Loader';

export default function AdminRoute({ children }) {
  const { currentUser, loading, userProfile } = useAuth();

  // Wait for auth to fully initialize
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader size="lg" message="Verifying admin access..." />
      </div>
    );
  }

  // Not logged in
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Temporary debug logs (remove later)
  console.log("Current User:", currentUser);
  console.log("User Profile:", userProfile);

  // Admin check
  if (userProfile?.role !== 'Administrator') {
    return <Navigate to="/" replace />;
  }

  return children;
}