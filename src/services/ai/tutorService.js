import { auth } from '../firebase/firebase';
import { notificationService } from '../../services/firebase/firestoreService';

const getUserId = () => {
  return auth.currentUser?.uid || 'anonymous';
};

export const tutorService = {
  async sendMessage(userQuestion) {
    const uid = getUserId();
    try {
      const response = await fetch('/api/ai-tutor', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid
        },
        body: JSON.stringify({ userQuestion })
      });
      
      const result = await response.json();
      if (result.success) {
        return result.data;
      }
      if (response.status === 429 || result.message?.includes("limit")) {
        await notificationService.notifyStudent(uid, 'Beta limit reached', `Daily limit reached for AI Tutor messages.`, 'limit', '⚠️');
        await notificationService.notifyAdmin('High AI Usage', `Student ${uid} reached beta limit for AI Tutor.`, 'limit_admin', '⚡');
      }
      throw new Error(result.message || "Failed AI call");
    } catch (e) {
      console.error("AI Tutor call failed, returning fallback:", e);
      if (!e.message?.includes("limit")) {
        await notificationService.notifyAdmin('Failed API Request', `API request failed for AI Tutor: ${e.message}`, 'error', '🔴');
      }
      return "Tutor currently in offline backup state. Please check network connection.";
    }
  },

  async generateStudyPlan(subjectName, topics, examDate, studyHours) {
    const uid = getUserId();
    try {
      const response = await fetch('/api/study-plan', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid
        },
        body: JSON.stringify({
          subjectName,
          topics,
          examDate,
          studyHours
        })
      });

      const result = await response.json();
      if (result.success) {
        // Trigger Study roadmap ready notification
        await notificationService.notifyStudent(uid, 'Study roadmap ready', `Custom roadmap for "${subjectName}" is prepared.`, 'study_plan', '📅');
        return result.data;
      }
      if (response.status === 429 || result.message?.includes("limit")) {
        await notificationService.notifyStudent(uid, 'Beta limit reached', `Daily limit reached for study roadmap.`, 'limit', '⚠️');
        await notificationService.notifyAdmin('High AI Usage', `Student ${uid} reached beta limit for study plans.`, 'limit_admin', '⚡');
      }
      throw new Error(result.message || "Failed to generate study plan");
    } catch (e) {
      console.warn("Study plan Gemini query failed, returning offline fallback:", e);
      if (e.message?.includes("limit")) {
        throw e;
      }
      await notificationService.notifyAdmin('Failed API Request', `API request failed for study plans: ${e.message}`, 'error', '🔴');
      const fallback = topics.map((topic, idx) => {
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        return {
          day: days[idx % days.length],
          topic: topic.title,
          tasks: [
            { text: `Review syllabus outline: ${topic.title}`, completed: false },
            { text: `Practice MCQ exam simulator for 10 minutes`, completed: false }
          ],
          completed: false
        };
      });
      return fallback;
    }
  }
};
