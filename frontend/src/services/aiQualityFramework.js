import { firestoreRepository } from '../repositories/academic/firestoreRepository.js';

/**
 * =========================================================================
 * HYPERBRAIN AI QUALITY & ACCURACY FRAMEWORK (Phase 3.1)
 * =========================================================================
 * Enforces educational quality standards, formatting constraints, confidence
 * scores, retry/fallback mechanisms, and AI telemetry logging.
 * =========================================================================
 */

export const CONFIG_THRESHOLD = 75; // Confidence score threshold (0-100)

export const aiQualityFramework = {
  
  /**
   * Centralized Prompt Builder
   * Unifies system instructions and workspace context variables
   */
  buildPrompt(options = {}) {
    const {
      taskType = 'chat',
      textContext = '',
      subjectName = '',
      topicName = '',
      graphInfo = '',
      studentProgress = {},
      teachingMode = 'doubt_solver',
      difficulty = 'Intermediate'
    } = options;

    const baseDirectives = `You are HyperBrain AI Engine, an elite educational system grounding explanations strictly in the academic repository notes.
Always prioritize logical consistency, formula correctness, and board curriculum relevance.`;

    const nextActionsDirective = `At the end of your response, ALWAYS append a section titled "Next Actions:" and list exactly 3 actions from:
* [Practice Quiz]
* [Generate Flashcards]
* [Mark Topic Complete]
* [Revise Prerequisite: TopicName]
* [Open Related Topic: TopicName]`;

    switch (taskType) {
      case 'notes':
        return {
          system: `${baseDirectives}
Task: Generate structured, detailed study notes for "${topicName}" in "${subjectName}".
Guidelines:
1. Include heading sections: "### Overview", "### Core Concepts", "### Solved Examples", "### Exam Focus".
2. Present comparisons using Markdown tables.
3. Highlight definitions in bold and encapsulate mathematical formulas in block quotes or math blocks.
4. Add clear exam tips at the end of each section.`,
          user: `Subject: ${subjectName}
Topic: ${topicName}
Study Context Notes: ${textContext}
Related Graph Mappings: ${graphInfo}
Difficulty: ${difficulty}`
        };

      case 'quiz':
        return {
          system: `${baseDirectives}
Task: Generate an interactive MCQ Practice Quiz.
Rules:
1. Return strictly a JSON block enclosed in \`\`\`json ... \`\`\` matching this schema:
   {
     "type": "quiz",
     "topic": "Topic Name",
     "questions": [
       {
         "question": "Question text?",
         "options": ["A", "B", "C", "D"],
         "answer": 0,
         "explanation": "Rationale detail."
       }
     ]
   }
2. Ensure options are distinct and answer indices are valid (0 to 3).`,
          user: `Topic: ${topicName}
Context: ${textContext}`
        };

      case 'flashcards':
        return {
          system: `${baseDirectives}
Task: Generate spaced repetition Flashcards.
Rules:
1. Return strictly a JSON block enclosed in \`\`\`json ... \`\`\` matching this schema:
   {
     "type": "flashcards",
     "topic": "Topic Name",
     "cards": [
       {
         "front": "Question/Term?",
         "back": "Answer/Definition explanation."
       }
     ]
   }`,
          user: `Topic: ${topicName}
Context: ${textContext}`
        };

      case 'chat':
      default:
        return {
          system: `${baseDirectives}
Task: Act as the AI Tutor 2.0 academic mentor.
Difficulty Level: "${difficulty}"
Teaching Mode Prompt:
- Explain Simply: Use basic vocabulary and analogies.
- Professor Mode: Deliver rigorous academic details and formal definitions.
- Exam Mode: Formats answers in scoring board style.
Current Mode setting: ${teachingMode}

Study Outline:
${textContext}
${graphInfo}

${nextActionsDirective}`,
          user: options.userQuestion || ""
        };
    }
  },

  /**
   * Response Validator & Hallucination Detector
   * Evaluates text structures, formats, and keyword matches to compute confidence
   */
  validateResponse(rawText, payload = {}, taskType = 'chat') {
    if (!rawText || rawText.trim().length === 0) {
      return { confidenceScore: 0, reason: "Empty response text" };
    }

    let confidenceScore = 100;
    const reasons = [];

    // Clean JSON content
    let cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    let parsed = null;
    let isJson = false;
    try {
      parsed = JSON.parse(cleanJson);
      isJson = true;
    } catch (e) {
      isJson = false;
    }

    // 1. Length Check
    if (rawText.length < 40) {
      confidenceScore -= 40;
      reasons.push("Extremely short response length");
    }

    // 2. Structured Task Content-Aware Audits
    if (taskType === 'notes') {
      if (!isJson) {
        confidenceScore -= 50;
        reasons.push("Notes response is not valid JSON");
      } else {
        const isSectionNote = parsed.title !== undefined && Array.isArray(parsed.sections);
        if (!isSectionNote) {
          const hasOverview = !!(parsed.overview || parsed.summary);
          const hasDefinition = !!(parsed.definition || parsed.definitions);
          const hasConcepts = Array.isArray(parsed.coreConcepts || parsed.concepts) && (parsed.coreConcepts || parsed.concepts).length > 0;
          const hasExamples = Array.isArray(parsed.examples) && parsed.examples.length > 0;
          const hasExamFocus = Array.isArray(parsed.examTips || parsed.examFocus) && (parsed.examTips || parsed.examFocus).length > 0;

          if (!hasOverview) { confidenceScore -= 15; reasons.push("Missing Overview content"); }
          if (!hasDefinition) { confidenceScore -= 15; reasons.push("Missing Definitions content"); }
          if (!hasConcepts) { confidenceScore -= 20; reasons.push("Missing Core Concepts content"); }
          if (!hasExamples) { confidenceScore -= 15; reasons.push("Missing Examples content"); }
          if (!hasExamFocus) { confidenceScore -= 15; reasons.push("Missing Exam Focus content"); }
        }
      }
    } else if (taskType === 'quiz') {
      if (!isJson) {
        confidenceScore = 0;
        reasons.push("Quiz response is not valid JSON");
      } else {
        const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
        if (questions.length === 0) {
          confidenceScore = 0;
          reasons.push("MCQ questions array is empty");
        } else {
          questions.forEach((q, idx) => {
            const hasQ = !!q.question;
            if (!hasQ) { confidenceScore -= 20; reasons.push(`Question ${idx} missing question text`); }

            if (q.type === 'theory') {
              const hasModelAnswer = q.model_answer !== undefined || q.modelAnswer !== undefined;
              if (!hasModelAnswer) { confidenceScore -= 30; reasons.push(`Theoretical Question ${idx} missing model answer`); }
            } else {
              const hasOptions = Array.isArray(q.options) && q.options.length >= 4;
              const hasCorrect = q.correctAnswer !== undefined || q.answer !== undefined;
              const hasExpl = !!q.explanation;
              const hasDiff = q.difficulty !== undefined;

              if (!hasOptions) { confidenceScore -= 20; reasons.push(`Question ${idx} must contain exactly 4 options`); }
              if (!hasCorrect) { confidenceScore -= 20; reasons.push(`Question ${idx} missing correct answer reference`); }
              if (!hasExpl) { confidenceScore -= 15; reasons.push(`Question ${idx} missing rational explanation`); }
              if (!hasDiff) { confidenceScore -= 10; reasons.push(`Question ${idx} missing difficulty classification`); }
            }
          });
        }
      }
    } else if (taskType === 'flashcards') {
      if (!isJson) {
        confidenceScore = 0;
        reasons.push("Flashcards response is not valid JSON");
      } else {
        const cards = Array.isArray(parsed) ? parsed : (parsed.cards || parsed.flashcards || []);
        if (cards.length === 0) {
          confidenceScore = 0;
          reasons.push("Flashcards array is empty");
        } else {
          cards.forEach((c, idx) => {
            const hasFront = !!c.front;
            const hasBack = !!c.back;

            if (!hasFront) { confidenceScore -= 30; reasons.push(`Card ${idx} missing front content`); }
            if (!hasBack) { confidenceScore -= 30; reasons.push(`Card ${idx} missing back content`); }
          });
        }
      }
    } else if (taskType === 'exam') {
      if (!isJson) {
        confidenceScore = 0;
        reasons.push("Exam response is not valid JSON");
      } else {
        const questions = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.exam_questions || []);
        if (questions.length === 0) {
          confidenceScore = 0;
          reasons.push("Practice exam questions array is empty");
        } else {
          questions.forEach((q, idx) => {
            const hasQ = !!q.question;
            const hasAnswer = !!(q.modelAnswer || q.answer);
            const hasMarks = q.marks !== undefined || q.points !== undefined;
            const hasDiff = q.difficulty !== undefined;

            if (!hasQ) { confidenceScore -= 30; reasons.push(`Exam Question ${idx} missing question text`); }
            if (!hasAnswer) { confidenceScore -= 30; reasons.push(`Exam Question ${idx} missing model solution answer`); }
            if (!hasMarks) { confidenceScore -= 15; reasons.push(`Exam Question ${idx} missing evaluation weight/marks`); }
            if (!hasDiff) { confidenceScore -= 15; reasons.push(`Exam Question ${idx} missing difficulty classification`); }
          });
        }
      }
    }

    // 4. Hallucination Check
    const targetSubject = (payload.subjectName || "").toLowerCase();
    if (targetSubject && targetSubject.length > 3) {
      const tokens = targetSubject.split(" ");
      const matchCount = tokens.filter(t => rawText.toLowerCase().includes(t)).length;
      if (matchCount === 0 && !rawText.toLowerCase().includes("prerequisite")) {
        confidenceScore -= 25;
        reasons.push(`Hallucination warning: Response has zero keyword overlap with subject: ${targetSubject}`);
      }
    }

    return {
      confidenceScore: Math.max(0, confidenceScore),
      isValid: confidenceScore >= CONFIG_THRESHOLD,
      reasons
    };
  },

  /**
   * Formatting Engine
   * Post-processes markdown text outputs to match consistent visual guidelines
   */
  formatResponse(text, taskType = 'chat') {
    if (!text) return "";

    let formatted = text.trim();

    // 1. Spacing normalizer
    formatted = formatted.replace(/\n{3,}/g, "\n\n");

    // 2. Bold headers formatting consistency
    formatted = formatted.replace(/^(Overview|Concepts|Examples|Exam Focus|Next Actions):/gim, "### $1");

    // 3. Highlight definition terms (Term: Definition -> **Term**: Definition)
    formatted = formatted.replace(/^([a-zA-Z\t ]{3,25}):\s/gm, "**$1**: ");

    return formatted;
  },

  /**
   * Telemetry Logger
   * Writes AI response performance checks to Firestore logs
   */
  async logMonitor(metrics = {}) {
    const timestamp = new Date().toISOString();
    const logDoc = {
      ...metrics,
      timestamp
    };

    try {
      const docId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await firestoreRepository.save('ai_quality_logs', docId, logDoc);
    } catch (e) {
      console.warn("[QualityMonitor] Failed to write metrics to database:", e.message);
    }
  }
};
