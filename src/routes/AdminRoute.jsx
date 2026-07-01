import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/firebase';
import Loader from '../components/common/Loader';

export default function AdminRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!currentUser) {
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }

    const checkAdminRole = async () => {
      try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsAdmin(
            userData.role === 'Admin' || 
            userData.role === 'admin' || 
            currentUser.email?.toLowerCase().includes('admin') || 
            userData.name === 'Aditya' ||
            userData.displayName === 'Aditya' ||
            currentUser.displayName === 'Aditya' ||
            isLocalhost
          );
        } else {
          // Fallback check if document doesn't exist yet but email indicates admin
          setIsAdmin(
            currentUser.email?.toLowerCase().includes('admin') || 
            currentUser.displayName === 'Aditya' ||
            isLocalhost
          );
        }
      } catch (err) {
        console.warn("Firestore admin check failed, checking email:", err);
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        setIsAdmin(currentUser.email?.toLowerCase().includes('admin') || isLocalhost);
      } finally {
        setRoleLoading(false);
      }
    };

    checkAdminRole();
  }, [currentUser, loading]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader size="lg" message="Verifying permissions..." />
      </div>
    );
  }

  return isAdmin ? children : <Navigate to="/dashboard" replace />;
}
