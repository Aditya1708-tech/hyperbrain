import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function AdminRoute({ children }) {
  const { user, loading, userProfile } = useAuth();

  // Wait for Firebase auth to finish
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  // No user
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Not admin
  if (userProfile?.role !== "Administrator") {
    return <Navigate to="/" replace />;
  }

  return children;
}

console.log("USER:", user);
console.log("LOADING:", loading);
console.log("ROLE:", userProfile?.role);