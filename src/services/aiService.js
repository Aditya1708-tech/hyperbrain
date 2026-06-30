import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from './firebase/firebase';
import { notificationService } from './firebase/firestoreService';

const isBrowser = typeof window !== 'undefined';

const API_KEY = (typeof process !== 'undefined' && process.env ? process.env.VITE_GEMINI_API_KEY : undefined) || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : undefined);

console.log("Gemini model:", "gemini-2.5-flash");

let genAI = null;
let model = null;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
  });
}

const verifyModel = () => {
  if (!model) {
    const key = (typeof process !== 'undefined' && process.env ? process.env.VITE_GEMINI_API_KEY : undefined) || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : undefined);
    if (!key) {
      throw new Error("Gemini API key missing");
    }
    genAI = new GoogleGenerativeAI(key);
    model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });
  }
};

const aiService = {
  initializeModel() {
    console.log("aiService: Gemini model configuration initialized.");
  },

  async generateNotes(subjectName, topicName) {
    if (isBrowser) {
      try {
        const response = await fetch('/api/generate-notes', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": auth.currentUser?.uid || 'anonymous'
          },
          body: JSON.stringify({ subjectName, topicName })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to generate notes");
        }
        let resultData = data.data;
        if (typeof resultData === 'string') {
          resultData = JSON.parse(resultData.replace(/```json/g, "").replace(/```/g, "").trim());
        }
        const uid = auth.currentUser?.uid || 'anonymous';
        await notificationService.notifyStudent(uid, 'Notes generated', `Your notes for "${topicName}" in "${subjectName}" are ready.`, 'notes', '📝');
        return resultData;
      } catch (error) {
        console.error("AI generation failed:", error);
        return {
          summary: "AI generation failed. Check console logs.",
          flashcards: [],
          quiz: [],
          exam_questions: []
        };
      }
    } else {
      try {
        verifyModel();
        const prompt = `Create comprehensive study content for the topic "${topicName}" in the course "${subjectName}". 
        REQUIRED STRUCTURE:
        1. "summary": Provide a detailed explanation (approx 400 words).
        2. "flashcards": Create 5-8 key concept cards.
        3. "quiz": You MUST generate AT LEAST 10 distinct Multiple Choice Questions (MCQs).
        4. "exam_questions": List 5-7 high-probability theory questions.
        Return strictly valid JSON: 
        {"summary": "...", "flashcards": [{"front": "Q", "back": "A"}], "quiz": [{"question": "Q?", "options": ["A","B","C","D"], "answer": "A", "explanation": "Why?"}], "exam_questions": ["Q1"]}`;
        
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        return {
          parsed: JSON.parse(cleanJson),
          totalTokens: 850
        };
      } catch (error) {
        console.error("AI generation failed:", error);
        return {
          parsed: {
            summary: "AI generation failed. Check console logs.",
            flashcards: [],
            quiz: [],
            exam_questions: []
          },
          totalTokens: 0
        };
      }
    }
  },

  async generateFlashcards(subjectName, topicName) {
    if (isBrowser) {
      try {
        const response = await fetch('/api/generate-flashcards', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": auth.currentUser?.uid || 'anonymous'
          },
          body: JSON.stringify({ subjectName, topicName })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to generate flashcards");
        }
        return data.data;
      } catch (error) {
        console.error("AI generation failed:", error);
        return [];
      }
    } else {
      try {
        verifyModel();
        const prompt = `Create 5 high-quality conceptual flashcards for the topic "${topicName}" in "${subjectName}". 
        Return strictly a valid JSON array matching this exact schema:
        [{"front": "Question?", "back": "Detailed answer explanation."}]`;
        
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        return {
          parsed: JSON.parse(cleanJson),
          totalTokens: 480
        };
      } catch (error) {
        console.error("AI generation failed:", error);
        return {
          parsed: [],
          totalTokens: 0
        };
      }
    }
  },

  async generateMockExam(subjectName, sectionName, questionType, count, marksPerQuestion, topicsList, customDifficulty) {
    if (isBrowser) {
      try {
        const response = await fetch('/api/generate-exam', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": auth.currentUser?.uid || 'anonymous'
          },
          body: JSON.stringify({ subjectName, sectionName, questionType, count, marksPerQuestion, topicsList, customDifficulty })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to generate mock exam");
        }
        return data.data;
      } catch (error) {
        console.error("AI generation failed:", error);
        return [];
      }
    } else {
      try {
        verifyModel();
        const topicsText = topicsList && topicsList.length > 0
          ? topicsList.map(t => typeof t === 'string' ? t : t.title).join(", ")
          : "General core principles";

        let prompt = "";
        if (questionType === 'mcq') {
          prompt = `Generate exactly ${count} Multiple Choice Questions (MCQs) for the subject "${subjectName}" under the section "${sectionName}". Difficulty: ${customDifficulty || 'Medium'}. Focus topics: [${topicsText}]. Each question is worth ${marksPerQuestion} mark(s).
          Return strictly a valid JSON array matching this exact schema:
          [{"type": "mcq", "question": "Question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "Option A", "marks": ${marksPerQuestion}, "explanation": "Brief explanation."}]`;
        } else {
          prompt = `Generate exactly ${count} theoretical/short-answer questions for the subject "${subjectName}" under the section "${sectionName}". Difficulty: ${customDifficulty || 'Medium'}. Focus topics: [${topicsText}]. Each question is worth ${marksPerQuestion} mark(s).
          Return strictly a valid JSON array matching this exact schema:
          [{"type": "theory", "question": "Question text?", "model_answer": "Model answer explanation.", "marks": ${marksPerQuestion}}]`;
        }

        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

        return {
          parsed: JSON.parse(cleanJson),
          totalTokens: 920
        };
      } catch (error) {
        console.error("AI generation failed:", error);
        return {
          parsed: [],
          totalTokens: 0
        };
      }
    }
  },

  async generateTutorResponse(userQuestion) {
    if (isBrowser) {
      try {
        const response = await fetch('/api/ai-tutor', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": auth.currentUser?.uid || 'anonymous'
          },
          body: JSON.stringify({ userQuestion })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed AI call");
        }
        return data.data;
      } catch (error) {
        console.error("AI generation failed:", error);
        return "AI generation failed. Check console logs.";
      }
    } else {
      try {
        verifyModel();
        const systemInstruction = `
        You are a precise mobile tutor. 
        Rules:
        1. Answer in strictly under 60 words.
        2. Use bullet points for lists.
        3. Do not use conversational filler.
        4. Focus on the direct syllabus answer only.
        `;
        const prompt = `${systemInstruction}\n\nUser Question: ${userQuestion}`;
        
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        return rawText;
      } catch (error) {
        console.error("AI generation failed:", error);
        return "AI generation failed. Check console logs.";
      }
    }
  },

  async generateStudyPlan(subjectName, topics, examDate, studyHours) {
    if (isBrowser) {
      try {
        const response = await fetch('/api/study-plan', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": auth.currentUser?.uid || 'anonymous'
          },
          body: JSON.stringify({ subjectName, topics, examDate, studyHours })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to generate study plan");
        }
        const uid = auth.currentUser?.uid || 'anonymous';
        await notificationService.notifyStudent(uid, 'Study roadmap ready', `Custom roadmap for "${subjectName}" is prepared.`, 'study_plan', '📅');
        return data.data;
      } catch (error) {
        console.error("AI generation failed:", error);
        return topics.map((topic, idx) => ({
          day: `Day ${idx + 1}`,
          topic: topic.title,
          tasks: [
            { text: `Review syllabus outline: ${topic.title}`, completed: false },
            { text: `Practice MCQ exam simulator for 10 minutes`, completed: false }
          ],
          completed: false
        }));
      }
    } else {
      try {
        verifyModel();
        const topicsText = topics.map(t => typeof t === 'string' ? t : t.title).join(", ");
        const prompt = `Create a custom day-by-day study roadmap for the course "${subjectName}" with topics: [${topicsText}]. 
        The exam is on ${examDate} and the student studies ${studyHours} hours per day.
        Return strictly a valid JSON array of days matching this structure:
        [{"day": "Day 1", "topic": "Topic Name", "tasks": [{"text": "Task description", "completed": false}], "completed": false}]`;
        
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

        return {
          parsed: JSON.parse(cleanJson),
          totalTokens: 640
        };
      } catch (error) {
        console.error("AI generation failed:", error);
        return {
          parsed: [],
          totalTokens: 0
        };
      }
    }
  }
};

aiService.initializeModel();

export default aiService;
