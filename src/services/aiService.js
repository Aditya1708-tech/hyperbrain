import { auth } from './firebase/firebase';
import { notificationService } from './firebase/firestoreService';
import { AI_CONFIG } from '../config/aiConfig.js';

const isBrowser = typeof window !== 'undefined';

if (!AI_CONFIG.apiKey) {
  console.error("Missing GROQ API key");
}

/**
 * Centralized reusable function calling the Groq completions API.
 * Supports timeout (15s), try/catch, retries (3 attempts), proper error logging,
 * and exponential backoff on HTTP 503 errors.
 */
export async function generateAI(prompt) {
  if (!AI_CONFIG.apiKey) {
    console.error("Missing GROQ API key");
    throw new Error("Missing GROQ API key configuration");
  }

  const maxRetries = 3;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Groq AI Service] Attempt ${attempt} to generate AI content.`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${AI_CONFIG.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          messages: [{ role: "user", content: prompt }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Groq API returned HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("Empty message content returned from Groq");
      }

      return text;
    } catch (error) {
      console.error(`[Groq Error - Attempt ${attempt}]:`, error);

      const is503 = error.message && (error.message.includes("503") || error.message.includes("Service Unavailable"));

      if (attempt < maxRetries) {
        const backoffDelay = is503 ? delay * Math.pow(2, attempt - 1) : 1000;
        console.log(`[AI Service] Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else {
        throw error;
      }
    }
  }
}

const aiService = {
  initializeModel() {
    console.log("aiService: Groq model configuration initialized with:", AI_CONFIG.model);
  },

  async generateBrainFromPdf(base64Data, fileName) {
    console.log("Generating syllabus brain from PDF name:", fileName);
    const subjectName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

    const prompt = `Create a realistic university syllabus outline for the course "${subjectName}".
    Generate exactly 4 key syllabus topics.
    Return strictly a valid JSON object matching this exact schema:
    {
      "subject_name": "${subjectName}",
      "topics": [
        { "title": "Topic Title", "difficulty": "Easy/Medium/Hard", "summary": "Brief 2-sentence summary of the topic." }
      ]
    }`;

    try {
      const rawText = await generateAI(prompt);
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error("Failed to generate syllabus from PDF:", error);
      return {
        subject_name: subjectName,
        topics: [
          { title: `${subjectName} Basics`, difficulty: "Easy", summary: "Fundamental concepts and definitions." },
          { title: `${subjectName} Advanced Concepts`, difficulty: "Medium", summary: "Deep-dive into architectural patterns." },
          { title: `${subjectName} Optimization`, difficulty: "Hard", summary: "Performance tuning and scaling methods." }
        ]
      };
    }
  },

  async generateNotes(topic, course) {
    console.log("Starting generateNotes");
    console.log("Topic:", topic);
    console.log("Course:", course);

    if (!topic || !course) {
      throw new Error("Missing topic or course data");
    }

    const prompt = `Create comprehensive study content for the topic "${topic}" in the course "${course}". 
    REQUIRED STRUCTURE:
    1. "summary": Provide a detailed explanation (approx 400 words).
    2. "flashcards": Create 5-8 key concept cards.
    3. "quiz": You MUST generate AT LEAST 10 distinct Multiple Choice Questions (MCQs).
    4. "exam_questions": List 5-7 high-probability theory questions.
    Return strictly valid JSON: 
    {"summary": "...", "flashcards": [{"front": "Q", "back": "A"}], "quiz": [{"question": "Q?", "options": ["A","B","C","D"], "answer": "A", "explanation": "Why?"}], "exam_questions": ["Q1"]}`;

    console.log("Prompt:", prompt);

    try {
      const text = await generateAI(prompt);
      console.log("Generated text:", text);
      return text;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async generateQuiz(topic, course) {
    console.log("Starting generateQuiz");
    if (!topic || !course) {
      throw new Error("Missing topic or course data");
    }

    const prompt = `Create a multiple choice quiz for the topic "${topic}" in the course "${course}".
    Generate exactly 5 distinct MCQs.
    Return strictly a valid JSON array matching this exact schema:
    [{"question": "Question?", "options": ["A", "B", "C", "D"], "answer": "A", "explanation": "Why?"}]`;

    try {
      const text = await generateAI(prompt);
      return text;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async generateFlashcards(topic, course) {
    console.log("Starting generateFlashcards");
    if (!topic || !course) {
      throw new Error("Missing topic or course data");
    }

    const prompt = `Create 5 high-quality conceptual flashcards for the topic "${topic}" in "${course}". 
    Return strictly a valid JSON array matching this exact schema:
    [{"front": "Question?", "back": "Detailed answer explanation."}]`;

    try {
      const text = await generateAI(prompt);
      return text;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async askTutor(question, context) {
    console.log("Starting askTutor");
    console.log("Question:", question);
    console.log("Context:", context);

    try {
      const prompt = `
      You are HyperBrain AI Tutor.

      Study Context:
      ${context}

      User Question:
      ${question}

      Give:
      - Simple explanation
      - Examples
      - Important concepts
      `;

      const text = await generateAI(prompt);
      return text;
    } catch (error) {
      console.error("Tutor generation failed:", error);
      throw error;
    }
  },

  async generateSummary(topic, course) {
    console.log("Starting generateSummary");
    const prompt = `Provide a concise bullet-point summary of the core principles of "${topic}" in the course "${course}".`;
    return await generateAI(prompt);
  },

  async generateExamples(topic, course) {
    console.log("Starting generateExamples");
    const prompt = `Provide 3 concrete, real-world examples illustrating the concept of "${topic}" in the course "${course}".`;
    return await generateAI(prompt);
  },

  async explainSimpler(topic, course) {
    console.log("Starting explainSimpler");
    const prompt = `Explain the concept of "${topic}" in the course "${course}" in simpler terms for a beginner.`;
    return await generateAI(prompt);
  },

  async generateTutorResponse(userQuestion) {
    return this.askTutor(userQuestion, "General Syllabus Context");
  },

  async generateMockExam(subjectName, sectionName, questionType, count, marksPerQuestion, topicsList, customDifficulty) {
    console.log("Starting generateMockExam");
    try {
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

      const rawText = await generateAI(prompt);
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async generateStudyPlan(subjectName, topics, examDate, studyHours) {
    console.log("Starting generateStudyPlan");
    try {
      const topicsText = topics.map(t => typeof t === 'string' ? t : t.title).join(", ");
      const prompt = `Create a custom day-by-day study roadmap for the course "${subjectName}" with topics: [${topicsText}]. 
      The exam is on ${examDate} and the student studies ${studyHours} hours per day.
      Return strictly a valid JSON array of days matching this structure:
      [{"day": "Day 1", "topic": "Topic Name", "tasks": [{"text": "Task description", "completed": false}], "completed": false}]`;

      const rawText = await generateAI(prompt);
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
};

aiService.initializeModel();

export async function askTutor(question, context) {
  return aiService.askTutor(question, context);
}

export default aiService;
