import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getTodayDateString } from '../../utils/helpers';
import { BETA_LIMITS } from '../../utils/constants';

export const userService = {
  async saveUserProfile(user, name, additionalData = {}) {
    if (!db) return;
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      name: name || user.displayName || user.email.split('@')[0],
      email: user.email,
      role: 'Student',
      status: 'active',
      isPro: false,
      createdAt: serverTimestamp(),
      ...additionalData
    }, { merge: true });
  },

  async updateUserStatus(userId, isOnline) {
    if (!userId || !db) return;
    const userDocRef = doc(db, 'users', userId);
    try {
      await updateDoc(userDocRef, {
        isOnline,
        lastActive: serverTimestamp()
      });
    } catch (err) {
      console.warn("Update user online status failed:", err);
    }
  },

  async setUserOnline(user) {
    if (!user || !db) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
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

  // userService consolidation
  async checkLimit(userId, requestType) {
    const limit = BETA_LIMITS[requestType] || 999;
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
    if (!userId || !db) return;
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
  }
};
