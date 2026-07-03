import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/firebase';
import Loader from '../components/common/Loader';

// Loading screen fallback component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <Loader size="lg" message="Verifying permissions..." />
    </div>
  );
}

export default function AdminRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const user = currentUser ? {
    uid: currentUser.uid,
    email: currentUser.email,
    displayName: currentUser.displayName,
    role: userRole
  } : null;

  const isAdmin = userRole === 'admin';
  const isLoading = loading || roleLoading;

  // Task 2: Log authentication and roles states
  useEffect(() => {
    console.log("Auth user:", user);
    console.log("Role:", user?.role);
    console.log("isAdmin:", isAdmin);
    console.log("Loading:", isLoading);
  }, [user, isAdmin, isLoading]);

  useEffect(() => {
    if (loading) return;

    if (!currentUser) {
      setUserRole(null);
      setRoleLoading(false);
      return;
    }

    const checkAdminRole = async () => {
      try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isLocalhost) {
          // Dev local environment debug bypass
          setUserRole('admin');
          setRoleLoading(false);
          return;
        }

        const userDocRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          
          // Task 3: Verify role retrieval and log warning if missing
          if (!userData.role) {
            console.warn(`Warning: Role field is missing from Firestore user document users/${currentUser.uid}`);
          }
          
          const normalizedRole = userData.role ? userData.role.toLowerCase() : null;
          setUserRole(normalizedRole);
        } else {
          console.warn(`Warning: Firestore document users/${currentUser.uid} does not exist`);
          setUserRole(null);
        }
      } catch (err) {
        console.warn("Firestore admin check failed, checking email fallback:", err);
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (currentUser.email?.toLowerCase().includes('admin') || isLocalhost) {
          setUserRole('admin');
        } else {
          setUserRole(null);
        }
      } finally {
        setRoleLoading(false);
      }
    };

    checkAdminRole();
  }, [currentUser, loading]);

  // Task 4: Redirect conditions implementation
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/" />;
  }

  return children;
}

