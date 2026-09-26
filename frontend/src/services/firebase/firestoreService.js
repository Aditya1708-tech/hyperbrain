import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { formatTimeAgo } from '../../utils/formatters';
import { api } from '../api/apiClient';

export const notificationService = {
  // Add notification for a student
  async notifyStudent(userId, title, desc, type = 'info', emoji = 'ℹ️') {
    // Sync to Express MongoDB
    try {
      await api.post('/api/notifications', { userId, title, desc, type, emoji, isAdmin: false });
    } catch (e) {
      console.warn("MongoDB notifyStudent failed:", e);
    }

    try {
      if (db) {
        await addDoc(collection(db, 'notifications'), {
          userId,
          title,
          desc,
          type,
          emoji,
          read: false,
          timestamp: serverTimestamp()
        });
      }
    } catch (e) {
      console.warn("notifyStudent failed:", e);
    }
  },

  // Add notification for admins
  async notifyAdmin(title, desc, type = 'info', emoji = '🔔') {
    try {
      await api.post('/api/notifications', { isAdmin: true, title, desc, type, emoji });
    } catch (e) {
      console.warn("MongoDB notifyAdmin failed:", e);
    }

    try {
      if (db) {
        await addDoc(collection(db, 'notifications'), {
          isAdmin: true,
          title,
          desc,
          type,
          emoji,
          read: false,
          timestamp: serverTimestamp()
        });
      }
    } catch (e) {
      console.warn("notifyAdmin failed:", e);
    }
  },

  // Listen to notifications for a student
  listenToStudentNotifications(userId, callback) {
    // Initial fetch from Express MongoDB
    api.get(`/api/notifications?userId=${userId}`).then(res => {
      if (res && res.success && Array.isArray(res.notifications)) {
        const list = res.notifications.map(n => ({
          id: n._id || n.id,
          ...n,
          time: formatTimeAgo(n.timestamp || n.createdAt)
        }));
        if (list.length > 0) callback(list);
      }
    }).catch(() => {});

    if (!db) return () => {};
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        time: formatTimeAgo(docSnap.data().timestamp)
      }));
      callback(list);
    }, (err) => {
      console.warn("listenToStudentNotifications failed:", err);
      callback([]);
    });
  },

  // Listen to notifications for admins
  listenToAdminNotifications(callback) {
    api.get('/api/notifications?isAdmin=true').then(res => {
      if (res && res.success && Array.isArray(res.notifications)) {
        const list = res.notifications.map(n => ({
          id: n._id || n.id,
          ...n,
          time: formatTimeAgo(n.timestamp || n.createdAt)
        }));
        if (list.length > 0) callback(list);
      }
    }).catch(() => {});

    if (!db) return () => {};
    const q = query(
      collection(db, 'notifications'),
      where('isAdmin', '==', true),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        time: formatTimeAgo(docSnap.data().timestamp)
      }));
      callback(list);
    }, (err) => {
      console.warn("listenToAdminNotifications failed:", err);
      callback([]);
    });
  },

  // Mark single read
  async markAsRead(notifId) {
    try {
      await api.put(`/api/notifications/${notifId}/read`, {});
    } catch (e) {
      // ignore
    }

    try {
      if (db) {
        const docRef = doc(db, 'notifications', notifId);
        await updateDoc(docRef, { read: true });
      }
    } catch (e) {
      console.warn("markAsRead failed:", e);
    }
  }
};

class AnalyticsService {
  async logEvent(eventType, metadata = {}) {
    const user = auth?.currentUser;
    const eventDoc = {
      type: eventType,
      userId: user?.uid || 'anonymous',
      userName: user?.displayName || user?.email?.split('@')[0] || 'Anonymous student',
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        clientTime: new Date().toISOString(),
      }
    };

    // 1. Sync to Express MongoDB
    try {
      await api.post('/api/analytics/event', eventDoc);
    } catch (e) {
      // ignore
    }

    // 2. Sync to Firestore
    try {
      if (db) {
        const logRef = collection(db, 'activity_log');
        await addDoc(logRef, { ...eventDoc, timestamp: serverTimestamp() });
      }
    } catch (err) {
      console.warn("[Analytics] Failed to log telemetry event:", err);
    }
  }

  logRegistration(email) {
    return this.logEvent('new_student_registered', { email });
  }

  logCourseCreated(courseName) {
    return this.logEvent('course_created', { courseName });
  }

  logExamGenerated(subjectName, marks, difficulty) {
    return this.logEvent('mock_exam_generated', { subjectName, marks, difficulty });
  }

  logExamSubmitted(subjectName, score, maxScore) {
    return this.logEvent('mock_exam_submitted', { subjectName, score, maxScore });
  }

  logAiSession(courseName, topicName, promptType, latencyMs, tokensUsed = 1250, success = true, error = '') {
    return this.logEvent('ai_tutor_session_started', {
      courseName,
      topicName,
      promptType,
      latencyMs,
      tokensUsed,
      success,
      error
    });
  }

  logSubscriptionUpgraded(plan, amount) {
    return this.logEvent('subscription_upgraded', { plan, amount });
  }

  logPaymentCompleted(plan, amount) {
    return this.logEvent('payment_completed', { plan, amount });
  }

  logSystemError(component, errorMessage) {
    return this.logEvent('system_error', { component, error: errorMessage });
  }

  logFailedApi(apiName, error) {
    return this.logEvent('failed_api_request', { apiName, error });
  }
}

export const analyticsService = new AnalyticsService();
