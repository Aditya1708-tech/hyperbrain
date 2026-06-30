import { auth } from '../firebase/firebase';
import { notificationService } from '../../services/firebase/firestoreService';

const getUserId = () => {
  return auth.currentUser?.uid || 'anonymous';
};

export const notesService = {
  async generateTopicContent(subjectName, topicName) {
    const uid = getUserId();
    try {
      const response = await fetch('/api/generate-notes', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid
        },
        body: JSON.stringify({ subjectName, topicName })
      });

      const result = await response.json();
      if (result.success) {
        // Trigger Notes generated notification
        await notificationService.notifyStudent(uid, 'Notes generated', `Your notes for "${topicName}" in "${subjectName}" are ready.`, 'notes', '📝');
        return result.data;
      }
      if (response.status === 429 || result.message?.includes("limit")) {
        await notificationService.notifyStudent(uid, 'Beta limit reached', `Daily limit reached for notes generation.`, 'limit', '⚠️');
        await notificationService.notifyAdmin('High AI Usage', `Student ${uid} reached beta limit for notes.`, 'limit_admin', '⚡');
      }
      throw new Error(result.message || "Failed to generate notes");
    } catch (e) {
      console.error("AI Notes generation failed, returning offline fallback:", e);
      if (e.message?.includes("limit")) {
        throw e;
      }
      await notificationService.notifyAdmin('Failed API Request', `API request failed for notes: ${e.message}`, 'error', '🔴');
      return {
        summary: `This is a comprehensive study overview of "${topicName}" inside "${subjectName}". Offline backup content activated.`,
        flashcards: [
          { front: `What is the core design paradigm of ${topicName}?`, back: `To establish modular abstraction boundaries and ensure reliable state persistence.` }
        ],
        quiz: Array.from({ length: 10 }).map((_, i) => ({
          question: `Regarding ${topicName}, which statement correctly describes concept element ${i + 1}?`,
          options: [
            "It maps configuration keys to memory structures dynamically",
            "It runs only in legacy browser compatibility runtimes",
            "It requires synchronous database blocks to operate",
            "It is completely deprecated in modern frameworks"
          ],
          answer: "It maps configuration keys to memory structures dynamically",
          explanation: "Dynamic mapping patterns ensure framework flexibility and clean state management."
        })),
        exam_questions: [
          `Discuss the theoretical framework, bottlenecks, and optimization strategies of "${topicName}".`
        ]
      };
    }
  }
};
