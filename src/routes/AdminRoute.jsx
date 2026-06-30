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
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsAdmin(
            userData.role === 'Admin' || 
            userData.role === 'admin' || 
            currentUser.email?.includes('admin') || 
            userData.name === 'Aditya'
          );
        } else {
          // Fallback check if document doesn't exist yet but email indicates admin
          setIsAdmin(currentUser.email?.includes('admin') || currentUser.displayName === 'Aditya');
        }
      } catch (err) {
        console.warn("Firestore admin check failed, checking email:", err);
        setIsAdmin(currentUser.email?.includes('admin'));
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
