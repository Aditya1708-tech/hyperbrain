import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { formatTimeAgo } from '../../utils/formatters';

export const notificationService = {
  // Add notification for a student
  async notifyStudent(userId, title, desc, type = 'info', emoji = 'ℹ️') {
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
    const user = auth.currentUser;
    const eventDoc = {
      type: eventType,
      userId: user?.uid || 'anonymous',
      userName: user?.displayName || user?.email?.split('@')[0] || 'Anonymous student',
      timestamp: serverTimestamp() || new Date(),
      metadata: {
        ...metadata,
        clientTime: new Date().toISOString(),
      }
    };

    try {
      if (db) {
        const logRef = collection(db, 'activity_log');
        await addDoc(logRef, eventDoc);
      }
    } catch (err) {
      console.warn("[Analytics] Failed to log telemetry event:", err);
      // Local fallback telemetry queue (simulated local events)
      try {
        const queue = JSON.parse(localStorage.getItem('telemetry_queue') || '[]');
        queue.push({ ...eventDoc, timestamp: new Date().toISOString() });
        localStorage.setItem('telemetry_queue', JSON.stringify(queue.slice(-50)));
      } catch (localErr) {
        // ignore
      }
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
