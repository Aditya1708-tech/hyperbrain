import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { subscriptionService, SUBSCRIPTION_PLANS } from '../services/firebase/subscriptionService';
import { db } from '../services/firebase/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !db) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const subDocRef = doc(db, 'subscriptions', currentUser.uid);
    const unsubscribe = onSnapshot(subDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setSubscription(snapshot.data());
      } else {
        // Fallback default free plan
        setSubscription({
          userId: currentUser.uid,
          planId: 'free',
          status: 'active',
          trialEnabled: false,
          trialExpiresAt: null,
          expiresAt: null,
          usage: {
            aiRequests: 0,
            notesGen: 0,
            flashcards: 0,
            quizAttempts: 0,
            workspaces: 0
          }
        });
      }
      setLoading(false);
    }, (error) => {
      console.warn("Real-time subscription listener failed, falling back to one-time fetch:", error);
      subscriptionService.getSubscription(currentUser.uid).then(sub => {
        setSubscription(sub);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  const isPro = subscription ? (subscription.planId === 'student_pro' || subscription.planId === 'student_pro_plus') : false;

  const hasFeatureAccess = (featureKey) => {
    if (!subscription) return false;
    return subscriptionService.hasFeatureAccess(subscription.planId, featureKey);
  };

  const checkLimit = (limitKey) => {
    if (!subscription) return { allowed: false, current: 0, limit: 0 };
    const usageKey = limitKey === 'aiRequestsMonthly' ? 'aiRequests'
                    : limitKey === 'notesGenMonthly' ? 'notesGen'
                    : limitKey === 'flashcardsCreated' ? 'flashcards'
                    : limitKey === 'quizAttemptsMonthly' ? 'quizAttempts'
                    : 'workspaces';
    const current = subscription.usage?.[usageKey] || 0;
    return subscriptionService.checkQuotaLimit(subscription, limitKey, current);
  };

  const incrementMetric = async (metricKey) => {
    if (!currentUser) return;
    try {
      const updated = await subscriptionService.incrementUsage(currentUser.uid, metricKey);
      setSubscription(updated);
    } catch (e) {
      console.warn("Failed to increment subscription usage counter:", e);
    }
  };

  const fetchSubscriptionDetails = async () => {
    if (!currentUser) return;
    try {
      const sub = await subscriptionService.getSubscription(currentUser.uid);
      setSubscription(sub);
    } catch (e) {
      console.warn("Failed manual subscription refresh:", e);
    }
  };

  return (
    <SubscriptionContext.Provider value={{ 
      subscription, 
      plan: subscription ? SUBSCRIPTION_PLANS[subscription.planId.toUpperCase()] : null,
      loading, 
      isPro, 
      hasFeatureAccess, 
      checkLimit, 
      incrementMetric,
      refreshSubscription: fetchSubscriptionDetails
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
