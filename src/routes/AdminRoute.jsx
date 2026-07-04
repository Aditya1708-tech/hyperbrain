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

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (
    userProfile?.role ===
    "Administrator"
  ) {
    return children;
  }

  return <Navigate to="/" />;
}