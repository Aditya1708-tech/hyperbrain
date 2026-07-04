import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AdminRoute({ children }) {
  const {
    currentUser,
    userProfile,
    loading
  } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  // not logged in
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  console.log("Current User:", currentUser);
  console.log("User Profile:", userProfile);

  // allow your admin email directly
  if (
    currentUser.email === "aditya@hyperbrain.ai"
  ) {
    return children;
  }

  // fallback role check
  if (userProfile?.role === "Administrator") {
    return children;
  }

  return <Navigate to="/" replace />;
}