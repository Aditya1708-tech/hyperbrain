import React from "react";
import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }) {
  const isAdminAuthenticated = sessionStorage.getItem("hyperbrain_admin") === "authenticated";

  if (!isAdminAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}