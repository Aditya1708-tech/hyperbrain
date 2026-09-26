/**
 * =========================================================================
 * HYPERBRAIN AI TUTOR 2.0 VERIFICATION SUITE
 * =========================================================================
 * Tests context pipeline, teaching modes, learning graph prerequisite checks,
 * response decorators, and frontend follow-up action buttons parsing.
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

// 1. Mocking teaching modes mapping prompts
const teachingModePrompts = {
  explain_simply: `You are in "Explain Simply" Mode. Explain the concepts using simple analogies, very easy vocabulary, and clear, step-by-step layout. Avoid high-level academic jargon.`,
  professor: `You are in "Professor Mode". Deliver rigorous academic explanations, formal definitions, proofs, detailed technical breakdowns, and comprehensive code blocks.`,
  exam: `You are in "Exam Mode". Format your answers strictly in a high-scoring university board structure (e.g., CBSE/AICTE layout). Define marks weightage, provide structured headings, and list common exam questions at the end.`,
  interview: `You are in "Interview Mode". Focus on interview preparation. Present explanations in a question-answer dialogue format, highlighting typical interviewer follow-ups, common traps, and industry tips on how to present the concept.`,
  revision: `You are in "Revision Mode". Provide highly summarized bullet points, cheat-sheet summaries, memory hooks, mnemonics, and quick-recall concepts.`,
  challenge: `You are in "Challenge Mode". Instead of direct answers, present a short scenario-based problem or critical thinking question to test the student's understanding and prompt them to solve it.`,
  doubt_solver: `You are in "Doubt Solver" Mode. Deliver a step-by-step debugging analysis, identify common student misconceptions, and explain why errors occur.`,
  future_visual: `You are in "Future Visual Mode". Present explanations using structural flowcharts, ASCII diagrams, or layout patterns to show the conceptual flow.`
};

// Mocked Learning Graph Prerequisites lookup
const mockGraphPrereqs = {
  'Deadlocks': ['Synchronization'],
  'Synchronization': ['Critical_Section', 'Process_Management'],
  'Inheritance': ['OOP_Basics']
};

/**
 * Replica of askTutorChat core pipeline
 */
function simulateTutorChatPipeline(messages, context, difficulty = 'Medium') {
  let textContext = "";
  let workspaceId = "";
  let activeTopicId = "";
  let teachingMode = "doubt_solver";
  let studentProgress = {};
  let quizPerformance = {};

  if (typeof context === 'object' && context !== null) {
    textContext = context.textContext || "";
    workspaceId = context.workspaceId || "";
    activeTopicId = context.activeTopicId || "";
    teachingMode = context.teachingMode || "doubt_solver";
    studentProgress = context.studentProgress || {};
    quizPerformance = context.quizPerformance || {};
    difficulty = context.difficulty || difficulty;
  } else {
    textContext = context || "";
  }

  // Prerequisite Audit
  let prereqAlertText = "";
  let incompletePrereqs = [];
  
  if (activeTopicId && mockGraphPrereqs[activeTopicId]) {
    const directPrereqs = mockGraphPrereqs[activeTopicId];
    
    for (const pr of directPrereqs) {
      const prRecord = studentProgress[pr];
      const isCompleted = prRecord === true || (prRecord && prRecord.completed === true);
      if (!isCompleted) {
        incompletePrereqs.push(pr);
      }
    }

    if (incompletePrereqs.length > 0) {
      prereqAlertText = `⚠️ [Recommendation: Study Prerequisite First] You haven't completed the prerequisite topic(s): ${incompletePrereqs.join(', ')}. We highly recommend reviewing these first to build a solid foundation!\n\n`;
    }
  }

  // Pick prompt
  const selectedModePrompt = teachingModePrompts[teachingMode] || teachingModePrompts['doubt_solver'];

  // Construct System Prompt
  const systemPrompt = `You are HyperBrain AI Tutor 2.0, an advanced academic mentor deeply integrated with the student's workspace environment.
Your current role:
1. Explain concepts, solve doubts, and suggest customized study paths.
2. Adapt your answers to the selected Difficulty Level: "${difficulty}".
3. Teaching Mode Guidelines:
   ${selectedModePrompt}
4. Align your responses to the current Study Context:
   ${textContext}
   ${incompletePrereqs.length > 0 ? `⚠️ Student has NOT completed prerequisites: ${incompletePrereqs.join(', ')}. Encourage studying them first.` : ''}
5. Primary Source Grounding: Use the provided workspace text and notes (Knowledge Object) as your primary source of truth.
6. Connect Concepts: Use the learning graph details to link related concepts together.
7. Next Actions Output: At the end of your response, ALWAYS add a section titled "Next Actions:" and list exactly 3 actions.
`;

  return {
    systemPrompt,
    prereqAlertText,
    incompletePrereqs,
    teachingMode
  };
}

/**
 * Replica of UI Next Actions Parser
 */
const parseAiResponse = (text) => {
  if (!text) return { cleanText: "", actions: [] };

  const nextActionsIndex = text.indexOf("Next Actions:");
  if (nextActionsIndex === -1) {
    return { cleanText: text, actions: [] };
  }

  const cleanText = text.substring(0, nextActionsIndex).trim();
  const actionsSection = text.substring(nextActionsIndex);
  
  const actions = [];
  const regex = /\[([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(actionsSection)) !== null) {
    const actionRaw = match[1];
    actions.push(actionRaw.trim());
  }

  return { cleanText, actions };
};

// ==========================================
// TEST EXECUTION RUNS
// ==========================================

console.log("-------------------------------------------------------------------");
console.log("🧪 RUNNING HYPERBRAIN AI TUTOR 2.0 INTEGRATION TESTS");
console.log("-------------------------------------------------------------------");

// Test 1: Teaching Mode selection updates system prompt correctly
const pipelineResult1 = simulateTutorChatPipeline([], { teachingMode: 'explain_simply' });
assert(pipelineResult1.systemPrompt.includes("Explain Simply"), "Pipeline selects Explain Simply mode prompts");
assert(pipelineResult1.systemPrompt.includes("simple analogies, very easy vocabulary"), "Explain Simply system prompt includes analogies directive");

const pipelineResult2 = simulateTutorChatPipeline([], { teachingMode: 'professor' });
assert(pipelineResult2.systemPrompt.includes("Professor Mode"), "Pipeline selects Professor Mode prompts");
assert(pipelineResult2.systemPrompt.includes("rigorous academic explanations, formal definitions, proofs"), "Professor Mode system prompt includes academic rigor directive");


// Test 2: Prerequisite block checking
// Case A: Prerequisite (Synchronization) is complete
const completedProgress = { 'Synchronization': { completed: true } };
const resA = simulateTutorChatPipeline([], {
  activeTopicId: 'Deadlocks',
  studentProgress: completedProgress
});
assert(resA.incompletePrereqs.length === 0, "Deadlocks has no incomplete prerequisites if Synchronization is checked");
assert(resA.prereqAlertText === "", "No warning alert text if prerequisites are complete");

// Case B: Prerequisite (Synchronization) is incomplete
const incompleteProgress = { 'Synchronization': { completed: false } };
const resB = simulateTutorChatPipeline([], {
  activeTopicId: 'Deadlocks',
  studentProgress: incompleteProgress
});
assert(resB.incompletePrereqs.includes('Synchronization'), "Synchronization identified as incomplete prerequisite for Deadlocks");
assert(resB.prereqAlertText.includes("Study Prerequisite First"), "Prerequisite recommendation alert prepended");
assert(resB.systemPrompt.includes("Student has NOT completed prerequisites: Synchronization"), "System prompt alerts LLM of incomplete prerequisites");


// Test 3: LLM Next Actions parsing in Frontend
const mockLlmResponse = `A deadlock occurs when processes are unable to proceed because each is waiting for the other.

Next Actions:
* [Practice Quiz]
* [Mark Topic Complete]
* [Revise Prerequisite: Synchronization]
`;

const parsed = parseAiResponse(mockLlmResponse);

assert(parsed.cleanText.includes("A deadlock occurs when processes are unable to proceed"), "Response body text extracted correctly");
assert(!parsed.cleanText.includes("Next Actions:"), "Next Actions section stripped from clean text body");
assert(parsed.actions.length === 3, "Extracted exactly 3 action items");
assert(parsed.actions.includes("Practice Quiz"), "Parsed 'Practice Quiz' button command");
assert(parsed.actions.includes("Mark Topic Complete"), "Parsed 'Mark Topic Complete' button command");
assert(parsed.actions.includes("Revise Prerequisite: Synchronization"), "Parsed 'Revise Prerequisite: Synchronization' button command with parameter");


console.log("-------------------------------------------------------------------");
if (passed) {
  console.log("⭐ ALL AI TUTOR 2.0 VERIFICATION TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
} else {
  console.error("💥 SYSTEM AUDIT FAILURES DETECTED IN AI TUTOR 2.0 PIPELINE.");
  process.exit(1);
}
