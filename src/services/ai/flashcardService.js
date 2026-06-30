import { auth } from '../firebase/firebase';
import { notificationService } from '../../services/firebase/firestoreService';

const getUserId = () => {
  return auth.currentUser?.uid || 'anonymous';
};

export const flashcardService = {
  async generateFlashcards(subjectName, topicName) {
    const uid = getUserId();
    try {
      const response = await fetch('/api/generate-flashcards', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid
        },
        body: JSON.stringify({ subjectName, topicName })
      });

      const result = await response.json();
      if (result.success) {
        // Trigger Flashcards ready notification
        await notificationService.notifyStudent(uid, 'Flashcards created', `Flashcards for "${topicName}" are compiled.`, 'flashcards', '⚡');
        return result.data;
      }
      if (response.status === 429 || result.message?.includes("limit")) {
        await notificationService.notifyStudent(uid, 'Beta limit reached', `Daily limit reached for flashcards.`, 'limit', '⚠️');
        await notificationService.notifyAdmin('High AI Usage', `Student ${uid} reached beta limit for flashcards.`, 'limit_admin', '⚡');
      }
      throw new Error(result.message || "Failed to generate flashcards");
    } catch (e) {
      console.warn("Flashcard Gemini query failed, returning offline fallback:", e);
      if (e.message?.includes("limit")) {
        throw e;
      }
      await notificationService.notifyAdmin('Failed API Request', `API request failed for flashcards: ${e.message}`, 'error', '🔴');
      const fallback = [
        { front: `What is the core principle of ${topicName}?`, back: `Understanding the structural and logical patterns of ${topicName} inside ${subjectName}.` },
        { front: `State one typical challenge with ${topicName}.`, back: `Managing performance bottlenecks and complex runtime states.` }
      ];
      return fallback;
    }
  }
};
