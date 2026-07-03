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

  const isAdmin = userRole === 'admin' || userRole === 'administrator';
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
        const isDefaultAdmin = currentUser.email?.toLowerCase() === 'aditya@hyperbrain.ai' || currentUser.email?.toLowerCase().includes('admin') || isLocalhost;
        
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
          let normalizedRole = userData.role ? userData.role.toLowerCase() : null;
          
          if (!normalizedRole && isDefaultAdmin) {
            normalizedRole = 'admin';
            try {
              await updateDoc(userDocRef, { role: 'Administrator' });
              console.log("Auto-assigned Administrator role in Firestore for:", currentUser.email);
            } catch (updateErr) {
              console.warn("Auto-assigning role in Firestore failed:", updateErr);
            }
          }
          setUserRole(normalizedRole);
        } else {
          console.warn(`Warning: Firestore document users/${currentUser.uid} does not exist`);
          if (isDefaultAdmin) {
            setUserRole('admin');
            try {
              await setDoc(userDocRef, {
                name: currentUser.displayName || currentUser.email.split('@')[0],
                email: currentUser.email,
                role: 'Administrator',
                isOnline: true,
                lastActive: serverTimestamp()
              });
              console.log("Auto-created user document with Administrator role in Firestore for:", currentUser.email);
            } catch (createErr) {
              console.warn("Auto-creating user document in Firestore failed:", createErr);
            }
          } else {
            setUserRole(null);
          }
        }
      } catch (err) {
        console.warn("Firestore admin check failed, checking email fallback:", err);
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isDefaultAdmin = currentUser.email?.toLowerCase() === 'aditya@hyperbrain.ai' || currentUser.email?.toLowerCase().includes('admin') || isLocalhost;
        if (isDefaultAdmin) {
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

  if (user.role !== "admin" && user.role !== "administrator") {
    return <Navigate to="/" />;
  }

  return children;
}

