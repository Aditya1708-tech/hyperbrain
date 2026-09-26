import express from 'express';
import { generateContent, LATEST_GEMINI_MODELS } from '../services/geminiService.js';
import { AiTelemetryLog } from '../models/AiLog.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// Helper to log AI telemetry into MongoDB
const logTelemetry = async (userId, taskType, latencyMs, success, error = '') => {
  try {
    const entry = new AiTelemetryLog({
      userId: userId || 'anonymous',
      taskType,
      latencyMs,
      success,
      error,
      model: LATEST_GEMINI_MODELS[0]
    });
    await entry.save();
  } catch (err) {
    // Non-blocking
  }
};

// POST /api/ai/tutor (AI Tutor conversation)
router.post('/tutor', verifyAuth, async (req, res) => {
  const startTime = Date.now();
  try {
    const { question, messages, context, difficulty = 'Medium' } = req.body;
    const promptInput = messages || question;

    if (!promptInput) {
      return res.status(400).json({ success: false, message: 'Question or messages required' });
    }

    const systemInstruction = `You are HyperBrain AI Tutor, an elite academic mentor.
Target academic depth: ${difficulty}.
Context: ${context || 'General Academic'}.
Keep your responses precise, accurate, encouraging, and structured using clean Markdown.
Highlight key definitions, formulas, or steps clearly.`;

    const result = await generateContent({
      prompt: promptInput,
      systemInstruction,
      temperature: 0.6
    });

    const latency = Date.now() - startTime;
    await logTelemetry(req.user?.uid, 'ai_tutor', latency, true);

    return res.json({
      success: true,
      text: result.text,
      model: result.model,
      latencyMs: latency
    });
  } catch (error) {
    console.error('AI Tutor route error:', error);
    await logTelemetry(req.user?.uid, 'ai_tutor', Date.now() - startTime, false, error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/extract-document (Extract chapters & syllabus from text or document)
router.post('/extract-document', verifyAuth, async (req, res) => {
  const startTime = Date.now();
  try {
    const { fileName, documentText, description } = req.body;

    const prompt = `Analyze this course document (${fileName || 'Textbook/Syllabus'}):
Description: ${description || ''}
Content Snippet:
${(documentText || '').substring(0, 15000)}

Extract the core chapters/modules into a strictly valid JSON object matching this schema:
{
  "subject": "Detected Subject Name",
  "program": "Detected Program/Degree or general level",
  "chapters": [
    {
      "title": "Module or Chapter Title",
      "description": "Short 1-sentence description of concepts covered",
      "difficulty": "Easy" | "Medium" | "Hard"
    }
  ]
}
Return ONLY valid JSON. No markdown backticks or commentary.`;

    const result = await generateContent({ prompt, temperature: 0.2 });
    let parsed;
    try {
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      parsed = {
        subject: fileName?.replace(/\.[^/.]+$/, '') || 'Academic Subject',
        program: 'Undergraduate',
        chapters: [
          { title: 'Unit 1: Fundamentals', description: 'Core introductory concepts', difficulty: 'Easy' },
          { title: 'Unit 2: Advanced Topics', description: 'Deep dive into practical implementation', difficulty: 'Medium' }
        ]
      };
    }

    const latency = Date.now() - startTime;
    await logTelemetry(req.user?.uid, 'extract_document', latency, true);

    return res.json({
      success: true,
      ...parsed,
      model: result.model,
      latencyMs: latency
    });
  } catch (error) {
    await logTelemetry(req.user?.uid, 'extract_document', Date.now() - startTime, false, error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/generate-notes
router.post('/generate-notes', verifyAuth, async (req, res) => {
  const startTime = Date.now();
  try {
    const { topicName, subjectName, instructions, context } = req.body;

    if (!topicName) {
      return res.status(400).json({ success: false, message: 'Topic name is required' });
    }

    const prompt = `Create comprehensive, high-yield academic study notes for:
Subject: ${subjectName || 'General'}
Topic: ${topicName}
${instructions ? `Specific Focus: ${instructions}` : ''}
${context ? `Reference Context: ${context.substring(0, 5000)}` : ''}

Include:
1. Executive Summary & Core Intuition
2. Key Definitions & Formal Theorems / Concepts
3. Step-by-Step Breakdown or Equations
4. Real-world Examples / Applications
5. Common Pitfalls & Exam Tips
6. Rapid Self-Review Questions

Format in clean, beautiful Markdown.`;

    const result = await generateContent({ prompt, temperature: 0.5 });
    const latency = Date.now() - startTime;
    await logTelemetry(req.user?.uid, 'generate_notes', latency, true);

    return res.json({
      success: true,
      notes: result.text,
      model: result.model,
      latencyMs: latency
    });
  } catch (error) {
    await logTelemetry(req.user?.uid, 'generate_notes', Date.now() - startTime, false, error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/generate-flashcards
router.post('/generate-flashcards', verifyAuth, async (req, res) => {
  const startTime = Date.now();
  try {
    const { topicName, subjectName, count = 10, notesContext } = req.body;

    const prompt = `Generate ${count} high-retention active recall flashcards for:
Subject: ${subjectName || 'Academic Course'}
Topic: ${topicName || 'Key Concepts'}
${notesContext ? `Source Notes: ${notesContext.substring(0, 5000)}` : ''}

Format as a strict JSON array of objects:
[
  {
    "front": "Prompt or Question",
    "back": "Clear, concise answer with key terms bolded",
    "difficulty": "Easy" | "Medium" | "Hard"
  }
]
Output ONLY valid JSON array. No surrounding backticks.`;

    const result = await generateContent({ prompt, temperature: 0.4 });
    let flashcards = [];
    try {
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      flashcards = JSON.parse(cleanJson);
    } catch (e) {
      flashcards = [
        { front: `What is the core principle of ${topicName}?`, back: 'Fundamental concept with core mechanics.', difficulty: 'Medium' }
      ];
    }

    const latency = Date.now() - startTime;
    await logTelemetry(req.user?.uid, 'generate_flashcards', latency, true);

    return res.json({
      success: true,
      flashcards,
      model: result.model,
      latencyMs: latency
    });
  } catch (error) {
    await logTelemetry(req.user?.uid, 'generate_flashcards', Date.now() - startTime, false, error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/generate-exam
router.post('/generate-exam', verifyAuth, async (req, res) => {
  const startTime = Date.now();
  try {
    const { subjectName, topic, numQuestions = 10, difficulty = 'Medium' } = req.body;

    const prompt = `Create a rigorous mock examination for:
Subject: ${subjectName}
Topic: ${topic || 'Comprehensive'}
Difficulty: ${difficulty}
Number of Questions: ${numQuestions}

Include a mix of multiple choice questions (MCQ) and short theoretical questions.
Return ONLY a valid JSON object matching this schema:
{
  "subjectName": "${subjectName}",
  "topic": "${topic || 'Comprehensive'}",
  "totalMarks": ${numQuestions * 2},
  "durationMinutes": ${Math.round(numQuestions * 2.5)},
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "Question statement",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Why this is correct",
      "marks": 2
    }
  ]
}
Return strictly raw JSON.`;

    const result = await generateContent({ prompt, temperature: 0.3 });
    let examData;
    try {
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      examData = JSON.parse(cleanJson);
    } catch (e) {
      examData = {
        subjectName,
        topic: topic || 'General',
        totalMarks: 20,
        durationMinutes: 30,
        questions: []
      };
    }

    const latency = Date.now() - startTime;
    await logTelemetry(req.user?.uid, 'generate_exam', latency, true);

    return res.json({
      success: true,
      exam: examData,
      model: result.model,
      latencyMs: latency
    });
  } catch (error) {
    await logTelemetry(req.user?.uid, 'generate_exam', Date.now() - startTime, false, error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/study-plan
router.post('/study-plan', verifyAuth, async (req, res) => {
  const startTime = Date.now();
  try {
    const { courseName, daysRemaining = 30, dailyHours = 2, chapters } = req.body;

    const prompt = `Generate an adaptive, high-impact study roadmap:
Course: ${courseName}
Time Available: ${daysRemaining} days (${dailyHours} hours/day)
Syllabus / Modules: ${JSON.stringify(chapters || ['Module 1', 'Module 2'])}

Output a structured JSON plan:
{
  "courseName": "${courseName}",
  "dailyHours": ${dailyHours},
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "Core Fundamentals",
      "tasks": [
        { "title": "Read Chapter 1 & take notes", "estimatedMinutes": 60, "completed": false }
      ]
    }
  ]
}
Return ONLY JSON.`;

    const result = await generateContent({ prompt, temperature: 0.4 });
    let planData;
    try {
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      planData = JSON.parse(cleanJson);
    } catch (e) {
      planData = { courseName, dailyHours, weeks: [] };
    }

    const latency = Date.now() - startTime;
    await logTelemetry(req.user?.uid, 'generate_study_plan', latency, true);

    return res.json({
      success: true,
      plan: planData,
      model: result.model,
      latencyMs: latency
    });
  } catch (error) {
    await logTelemetry(req.user?.uid, 'generate_study_plan', Date.now() - startTime, false, error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/generate (Generic content generation for frontend services)
router.post('/generate', async (req, res) => {
  const startTime = Date.now();
  try {
    const { prompt, messages, systemInstruction, temperature = 0.7, modelName } = req.body;
    const promptInput = messages || prompt;

    if (!promptInput) {
      return res.status(400).json({ success: false, message: 'Prompt or messages required' });
    }

    const result = await generateContent({
      prompt: promptInput,
      systemInstruction,
      temperature,
      modelName
    });

    const latency = Date.now() - startTime;
    await logTelemetry(req.user?.uid, 'generic_generate', latency, true);

    return res.json({
      success: true,
      text: result.text,
      model: result.model,
      latencyMs: latency
    });
  } catch (error) {
    console.error('Generic generation error:', error);
    await logTelemetry(req.user?.uid, 'generic_generate', Date.now() - startTime, false, error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
