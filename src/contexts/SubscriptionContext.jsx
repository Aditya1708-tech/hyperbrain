import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/firebase';

export const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setIsPro(false);
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setIsPro(docSnap.data().isPro || false);
      } else {
        setIsPro(false);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Subscription listener failed:", error);
      setIsPro(false);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  return (
    <SubscriptionContext.Provider value={{ isPro, loading }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
