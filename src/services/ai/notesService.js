import { auth } from '../firebase/firebase';
import { notificationService } from '../../services/firebase/firestoreService';

const model = {
  async generateContent(prompt) {
    const response = await fetch('/api/generate-notes', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": auth.currentUser?.uid || 'anonymous'
      },
      body: JSON.stringify({ subjectName: prompt.courseName, topicName: prompt.topicTitle })
    });

    if (!response.ok) {
      throw new Error(`Server returned status code ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Failed to generate notes");
    }
    return result;
  }
};

export const notesService = {
  async generateTopicContent(courseName, topicTitle) {
    console.log("Gemini key exists:", !!import.meta.env.VITE_GEMINI_API_KEY);
    console.log("Topic:", topicTitle);
    console.log("Course:", courseName);

    const prompt = { courseName, topicTitle };

    try {
      console.log("Sending request to Gemini...");
      const result = await model.generateContent(prompt);
      console.log("Gemini response:", result);
      
      const uid = auth.currentUser?.uid || 'anonymous';
      await notificationService.notifyStudent(uid, 'Notes generated', `Your notes for "${topicTitle}" in "${courseName}" are ready.`, 'notes', '📝');
      
      return result.data;
    } catch (error) {
      console.error("Gemini generation failed:", error);
      const uid = auth.currentUser?.uid || 'anonymous';
      await notificationService.notifyAdmin('Failed API Request', `API request failed for notes: ${error.message}`, 'error', '🔴');
      throw new Error("AI generation failed. Check console logs.");
    }
  }
};
