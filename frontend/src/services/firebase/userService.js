import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getTodayDateString } from '../../utils/helpers';
import { BETA_LIMITS } from '../../utils/constants';
import { api } from '../api/apiClient';

export const userService = {
  async saveUserProfile(user, name, additionalData = {}) {
    const profileData = {
      name: name || user.displayName || user.email.split('@')[0],
      displayName: name || user.displayName || user.email.split('@')[0],
      email: user.email,
      role: 'Student',
      status: 'active',
      isPro: false,
      ...additionalData
    };

    // 1. Sync to Express MongoDB
    try {
      await api.put('/api/users/profile', profileData);
    } catch (e) {
      // non-fatal
    }

    // 2. Sync to Firestore
    try {
      if (db) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          ...profileData,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (e) {
      // non-fatal
    }
  },

  async updateUserStatus(userId, isOnline) {
    if (!userId) return;

    try {
      await api.post('/api/users/status', { userId, isOnline });
    } catch (e) {
      // non-fatal
    }

    if (!db) return;
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        isOnline,
        lastActive: serverTimestamp()
      });
    } catch (err) {
      console.warn("Update user online status failed:", err);
    }
  },

  async setUserOnline(user) {
    if (!user) return;

    try {
      await api.post('/api/users/status', { userId: user.uid, isOnline: true });
    } catch (e) {
      // non-fatal
    }

    if (!db) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        isOnline: true,
        lastActive: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn("Set user online failed:", err);
    }
  },

  // Check quota limit
  async checkLimit(userId, requestType) {
    const limit = BETA_LIMITS[requestType] || 999;
    if (import.meta.env.DEV) {
      return { allowed: true, current: 0, limit: 99999 };
    }

    // Check MongoDB first
    try {
      const res = await api.get(`/api/users/limit/${userId}/${requestType}`);
      if (res && res.success) {
        return {
          allowed: res.allowed,
          current: res.current,
          limit: res.limit
        };
      }
    } catch (e) {
      // fallback
    }

    if (!userId || !db) {
      return { allowed: true, current: 0, limit };
    }
    const dateStr = getTodayDateString();
    const docId = `${userId}_${requestType}_${dateStr}`;
    const docRef = doc(db, 'ai_usage', docId);
    
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const count = snap.data().requestCount || 0;
        return {
          allowed: count < limit,
          current: count,
          limit
        };
      }
      return {
        allowed: true,
        current: 0,
        limit
      };
    } catch (err) {
      console.warn("Check limit failed, assuming allowed:", err);
      return { allowed: true, current: 0, limit };
    }
  },

  async incrementUsage(userId, requestType) {
    if (!userId) return;

    // MongoDB increment
    try {
      await api.post('/api/users/increment-usage', { userId, requestType });
    } catch (e) {
      // non-fatal
    }

    if (!db) return;
    const dateStr = getTodayDateString();
    const docId = `${userId}_${requestType}_${dateStr}`;
    const docRef = doc(db, 'ai_usage', docId);

    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, {
          requestCount: (snap.data().requestCount || 0) + 1
        });
      } else {
        await setDoc(docRef, {
          userId,
          requestType,
          requestCount: 1,
          date: dateStr,
          createdAt: new Date()
        });
      }
    } catch (err) {
      console.warn("Increment usage failed:", err);
    }
  },

  getTimeUntilMidnight() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const difference = midnight - now;
    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);
    const formatted = `${hours}h ${minutes}m ${seconds}s`;
    return {
      hours,
      minutes,
      seconds,
      milliseconds: difference,
      formatted
    };
  }
};

export const getTimeUntilMidnight = userService.getTimeUntilMidnight;
export default userService;
