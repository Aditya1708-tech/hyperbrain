/**
 * =========================================================================
 * HYPERBRAIN AI QUALITY FRAMEWORK VERIFICATION SUITE
 * =========================================================================
 * Tests centralized prompt building templates, post-process markdown formatting
 * normalizers, and response quality validations (redundancies, schemas, hallucinations).
 * =========================================================================
 */

let passed = true;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.error(`❌ [FAIL] ${message}`);
    passed = false;
  }
}

// -------------------------------------------------------------------
// FRAMEWORK ALGORITHMS REPLICAS
// -------------------------------------------------------------------

const CONFIG_THRESHOLD = 75;

const aiQualityFrameworkReplica = {
  
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

  validateResponse(rawText, payload = {}, taskType = 'chat') {
    if (!rawText || rawText.trim().length === 0) {
      return { confidenceScore: 0, reason: "Empty response text" };
    }

    let confidenceScore = 100;
    const reasons = [];

    if (rawText.length < 40) {
      confidenceScore -= 50;
      reasons.push("Extremely short response length");
    }

    const sentences = rawText.split(/[.!?\n]/).map(s => s.trim()).filter(s => s.length > 10);
    const seen = new Set();
    let duplicates = 0;
    sentences.forEach(s => {
      if (seen.has(s)) duplicates++;
      seen.add(s);
    });
    if (duplicates > 0) {
      const penalty = Math.min(40, duplicates * 10);
      confidenceScore -= penalty;
      reasons.push(`Duplicate lines detected: ${duplicates} repeats`);
    }

    if (taskType === 'notes') {
      const hasOverview = rawText.includes("Overview");
      const hasConcepts = rawText.includes("Core Concepts") || rawText.includes("Concepts");
      const hasExamples = rawText.includes("Example");
      const hasExamFocus = rawText.includes("Exam Focus") || rawText.includes("Exam");

      if (!hasOverview) { confidenceScore -= 10; reasons.push("Missing Overview section"); }
      if (!hasConcepts) { confidenceScore -= 15; reasons.push("Missing Core Concepts section"); }
      if (!hasExamples) { confidenceScore -= 10; reasons.push("Missing Examples section"); }
      if (!hasExamFocus) { confidenceScore -= 10; reasons.push("Missing Exam Focus tips"); }

      if (!rawText.includes("|") && !rawText.includes("*") && !rawText.includes("-")) {
        confidenceScore -= 15;
        reasons.push("Lacks structured bullet points or Markdown comparison tables");
      }
    } else if (taskType === 'quiz' || taskType === 'flashcards') {
      try {
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        if (taskType === 'quiz') {
          if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
            confidenceScore = 0;
            reasons.push("Invalid MCQ questions array structure");
          } else {
            parsed.questions.forEach((q, qIdx) => {
              if (!q.question || !q.options || q.options.length < 2 || q.answer === undefined) {
                confidenceScore -= 20;
                reasons.push(`Question index ${qIdx} has missing fields or options`);
              }
            });
          }
        } else {
          if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
            confidenceScore = 0;
            reasons.push("Invalid Flashcards cards array structure");
          }
        }
      } catch (e) {
        confidenceScore = 0;
        reasons.push("Failed to parse output as valid JSON configuration block");
      }
    }

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

  formatResponse(text, taskType = 'chat') {
    if (!text) return "";

    let formatted = text.trim();
    formatted = formatted.replace(/\n{3,}/g, "\n\n");
    formatted = formatted.replace(/^(Overview|Concepts|Examples|Exam Focus|Next Actions):/gim, "### $1");
    formatted = formatted.replace(/^([a-zA-Z\t ]{3,25}):\s/gm, "**$1**: ");
    return formatted;
  }
};

// ==========================================
// TEST EXECUTION RUNS
// ==========================================

async function runTests() {
  console.log("-------------------------------------------------------------------");
  console.log("🧪 RUNNING HYPERBRAIN AI QUALITY FRAMEWORK TESTS");
  console.log("-------------------------------------------------------------------");

  // Test 1: Centralized Prompt Builder templates
  const promptNotes = aiQualityFrameworkReplica.buildPrompt({
    taskType: 'notes',
    subjectName: 'Operating Systems',
    topicName: 'Deadlocks',
    textContext: 'Deadlocks occur when processes hold resources...',
    difficulty: 'Advanced'
  });
  
  assert(promptNotes.system.includes("### Overview") && promptNotes.system.includes("### Core Concepts"), "Notes prompt builder mandates standard academic markdown headings");
  assert(promptNotes.user.includes("Operating Systems") && promptNotes.user.includes("Deadlocks"), "Notes prompt builder packages topic & subject contexts");

  const promptQuiz = aiQualityFrameworkReplica.buildPrompt({
    taskType: 'quiz',
    topicName: 'Mutex Semaphores'
  });
  assert(promptQuiz.system.includes("JSON") && promptQuiz.system.includes("questions"), "Quiz prompt builder mandates strict JSON schema configuration output format");

  // Test 2: Heuristic structural and quality validators
  // Case A: Perfect response
  const perfectResponse = `### Overview
Deadlocks are blocking conditions in operating systems.
### Core Concepts
A deadlock consists of mutual exclusion, hold and wait, no preemption, and circular wait.
### Solved Examples
Example: Process A holds Tape and waits for Printer, Process B holds Printer and waits for Tape.
### Exam Focus
Tip: Know the 4 conditions required for deadlocks to occur.
* Bullet point 1
* Bullet point 2
* Bullet point 3
| Condition | Description |
| --- | --- |
| Mutual Exclusion | One process per resource |
`;
  const valPerfect = aiQualityFrameworkReplica.validateResponse(perfectResponse, { subjectName: "Operating Systems" }, 'notes');
  assert(valPerfect.isValid === true, `Valid notes format receives high confidence (Score: ${valPerfect.confidenceScore})`);

  // Case B: Missing sections
  const missingSectionsText = `Overview of Deadlocks:
A deadlock is when processes wait forever. That is all.
* Short list item.`;
  const valMissing = aiQualityFrameworkReplica.validateResponse(missingSectionsText, { subjectName: "Operating Systems" }, 'notes');
  assert(valMissing.confidenceScore < 75, `Response missing headings/tables is flagged as low confidence (Score: ${valMissing.confidenceScore})`);
  assert(valMissing.reasons.some(r => r.includes("Missing")), "Missing sections reasons reported");

  // Case C: Duplicate content penalty
  const duplicatesText = `### Overview
Operating Systems deadlocks represent locking conditions.
Operating Systems deadlocks represent locking conditions.
Operating Systems deadlocks represent locking conditions.
### Core Concepts
A process holds Tape and waits for Printer.
### Solved Examples
Example scenario.
### Exam Focus
Board exam tips.`;
  const valDup = aiQualityFrameworkReplica.validateResponse(duplicatesText, { subjectName: "Operating Systems" }, 'notes');
  assert(valDup.confidenceScore < 75, `Repetitive duplicate content triggers confidence penalties (Score: ${valDup.confidenceScore})`);
  assert(valDup.reasons.some(r => r.includes("Duplicate")), "Duplicate repeats reason reported");

  // Case D: Hallucination match penalty
  const hallucinatedText = `### Overview
Organic chemistry reactions occur through carbon compounds.
### Core Concepts
Alkanes and Alkenes represent saturated and unsaturated hydrocarbons.
### Solved Examples
Example methane structure.
### Exam Focus
Exam tips on chemical formulas.`;
  const valHal = aiQualityFrameworkReplica.validateResponse(hallucinatedText, { subjectName: "Operating Systems" }, 'notes');
  assert(valHal.reasons.some(r => r.includes("Hallucination")), "Hallucination match checks trigger subject mismatch penalties");

  // Test 3: Formatting Engine normalizing
  const rawTextWithOddSpacing = `
Overview:
This is deadlocks overview.


Concepts:
Core conditions are Hold and Wait.

Mutual Exclusion: Only one process can use a resource at a time.
`;
  const formatted = aiQualityFrameworkReplica.formatResponse(rawTextWithOddSpacing, 'chat');
  assert(!formatted.includes("\n\n\n"), "Formatter limits multiple trailing newlines spacing");
  assert(formatted.includes("### Overview") && formatted.includes("### Concepts"), "Formatter normalizes standard subheaders prefix headings format");
  assert(formatted.includes("**Mutual Exclusion**:"), "Formatter highlights definition prefix terms");

  console.log("-------------------------------------------------------------------");
  if (passed) {
    console.log("⭐ ALL AI QUALITY FRAMEWORK TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("💥 QUALITY FRAMEWORK VERIFICATION SUITE RECORDED AUDIT FAILURES.");
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error("Test suite crashed:", e);
  process.exit(1);
});
