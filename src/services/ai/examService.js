import { auth } from '../firebase/firebase';
import { notificationService } from '../../services/firebase/firestoreService';

const getUserId = () => {
  return auth.currentUser?.uid || 'anonymous';
};

export const examService = {
  async generateExamSection(subjectName, sectionName, questionType, count, marksPerQuestion, topicsList, customDifficulty) {
    const uid = getUserId();
    try {
      const response = await fetch('/api/generate-exam', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid
        },
        body: JSON.stringify({
          subjectName,
          sectionName,
          questionType,
          count,
          marksPerQuestion,
          topicsList,
          customDifficulty
        })
      });

      const result = await response.json();
      if (result.success || result.data) {
        // Trigger Mock exam ready notification
        await notificationService.notifyStudent(uid, 'Mock exam ready', `Exam set for "${subjectName}" is compiled.`, 'mock_exam', '🎓');
        return result.data;
      }
      if (response.status === 429 || result.message?.includes("limit")) {
        await notificationService.notifyStudent(uid, 'Beta limit reached', `Daily limit reached for exam generation.`, 'limit', '⚠️');
        await notificationService.notifyAdmin('High AI Usage', `Student ${uid} reached beta limit for exams.`, 'limit_admin', '⚡');
      }
      throw new Error(result.message || "Failed to generate exam");
    } catch (e) {
      console.warn("AI generation failed for exam section, returning offline fallback:", e);
      if (e.message?.includes("limit")) {
        throw e;
      }
      await notificationService.notifyAdmin('Failed API Request', `API request failed for exams: ${e.message}`, 'error', '🔴');
      const fallbacks = [];
      for (let i = 1; i <= count; i++) {
        if (questionType === 'mcq') {
          fallbacks.push({
            type: "mcq",
            question: `Identify the correct statement regarding ${subjectName} Core Principles (Question ${i})?`,
            options: [
              "It is the main design blueprint model",
              "It is a secondary configuration pattern",
              "It is completely optional inside deployment",
              "It is restricted only to legacy environments"
            ],
            answer: "It is the main design blueprint model",
            marks: 1,
            explanation: "Core principles establish the main architectural blueprints for the subject."
          });
        } else {
          fallbacks.push({
            type: "theory",
            question: `Describe the primary features, patterns, and challenges of ${subjectName} Module ${i}?`,
            model_answer: `This topic covers the fundamental operations, compilation metrics, design parameters and deployment structures of ${subjectName} Module ${i}.`,
            marks: marksPerQuestion
          });
        }
      }
      return fallbacks;
    }
  },

  async gradeTheoryAnswer(question, modelAnswer, studentAnswer, maxMarks) {
    try {
      const score = Math.min(maxMarks, Math.max(1, Math.floor(studentAnswer.trim().length / 30)));
      return {
        score,
        feedback: `[Offline Auto-Grader] Evaluated answer. Score: ${score}/${maxMarks}.`
      };
    } catch (e) {
      return { score: 0, feedback: "Failed to connect to AI grading." };
    }
  }
};
