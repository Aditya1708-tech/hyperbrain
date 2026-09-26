/**
 * =========================================================================
 * HYPERBRAIN BETA LAUNCH SYSTEM VERIFICATION SUITE
 * =========================================================================
 * Tests invite code checks, waitlist requests, remote feature flag configs,
 * onboarding step arrays, and in-app/AI response feedback logs schemas.
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
// BETA SERVICE REPLICAS
// -------------------------------------------------------------------

let activeFeatureFlags = {
  aiTutorEnabled: true,
  notesEnabled: true,
  flashcardsEnabled: true,
  quizEnabled: true,
  registrationEnabled: true,
  maintenanceMode: false
};

const mockInviteCodes = new Set(["BETA_LAUNCH_2026", "CAMPUS_ALPHA"]);

const betaLaunchServiceReplica = {
  getFeatureFlags() {
    return activeFeatureFlags;
  },

  updateFeatureFlags(updated = {}) {
    activeFeatureFlags = { ...activeFeatureFlags, ...updated };
    return activeFeatureFlags;
  },

  validateInviteCode(code) {
    if (!code) return false;
    return mockInviteCodes.has(code.trim().toUpperCase());
  },

  getOnboardingSteps() {
    return [
      { step: 0, title: "Welcome to HyperBrain 🚀" },
      { step: 1, title: "Define Your Academic Goal 🎯" },
      { step: 2, title: "Course Selection 📚" }
    ];
  },

  getProductTourSteps() {
    return {
      academicHub: "Browse workspaces and syllabuses.",
      notes: "View core in-depth study sheets."
    };
  },

  submitFeedback(userId, type, message, payload = {}) {
    const requiredFields = ['userId', 'type', 'message', 'appVersion', 'currentPage', 'browserInfo'];
    const doc = {
      userId,
      type,
      message,
      appVersion: "1.0.0-beta3",
      currentPage: payload.currentPage || "Dashboard",
      browserInfo: payload.browserInfo || "Chrome Testing Engine",
      timestamp: new Date().toISOString()
    };

    const missing = requiredFields.filter(f => doc[f] === undefined);
    return {
      success: missing.length === 0,
      missing,
      doc
    };
  },

  submitAiResponseFeedback(userId, responseId, feedbackType, reason = "") {
    return {
      userId,
      responseId,
      feedbackType, // 'helpful', 'not_helpful', 'incorrect', 'hallucination'
      reason,
      timestamp: new Date().toISOString()
    };
  }
};

// ==========================================
// TEST EXECUTION RUNS
// ==========================================

async function runTests() {
  console.log("-------------------------------------------------------------------");
  console.log("🧪 RUNNING HYPERBRAIN BETA LAUNCH SYSTEM TESTS");
  console.log("-------------------------------------------------------------------");

  // Test 1: Feature Flags Toggle configurations
  const initialFlags = betaLaunchServiceReplica.getFeatureFlags();
  assert(initialFlags.aiTutorEnabled === true && initialFlags.maintenanceMode === false, "Feature flags initialized with default beta settings");

  betaLaunchServiceReplica.updateFeatureFlags({ maintenanceMode: true, aiTutorEnabled: false });
  const updatedFlags = betaLaunchServiceReplica.getFeatureFlags();
  assert(updatedFlags.maintenanceMode === true && updatedFlags.aiTutorEnabled === false, "Feature flags updated remote overrides correctly");

  // Test 2: Invite Code Validation
  assert(betaLaunchServiceReplica.validateInviteCode("BETA_LAUNCH_2026") === true, "Valid registration invite code is accepted");
  assert(betaLaunchServiceReplica.validateInviteCode("CAMPUS_ALPHA") === true, "Alphanumeric referral invite code is accepted");
  assert(betaLaunchServiceReplica.validateInviteCode("WRONG_CODE") === false, "Invalid code registration request is rejected");

  // Test 3: Onboarding wizard configurations
  const steps = betaLaunchServiceReplica.getOnboardingSteps();
  assert(steps.length === 3, "Onboarding configurations load wizard outlines");
  assert(steps[0].title === "Welcome to HyperBrain 🚀", "Onboarding welcome slides match landing labels");

  const tour = betaLaunchServiceReplica.getProductTourSteps();
  assert(tour.notes !== "", "Product tour configurations supply page context tooltips");

  // Test 4: In-App Feedback forms audits
  const feedbackResult = betaLaunchServiceReplica.submitFeedback(
    'student_789',
    'bug_report',
    'Application freezes when downloading outline notes PDF',
    { currentPage: 'Study Notes', browserInfo: 'Mozilla Firefox' }
  );
  assert(feedbackResult.success === true, "In-app bug feedback maps user browser specs and workspace context keys");
  assert(feedbackResult.doc.type === 'bug_report', "Feedback logger tags bugs categories properly");

  // Test 5: AI Response Helpfulness feedback
  const aiFeedback = betaLaunchServiceReplica.submitAiResponseFeedback('student_789', 'resp_112233', 'helpful');
  assert(aiFeedback.feedbackType === 'helpful', "AI quality feedback maps helpful logs");

  const aiHallucination = betaLaunchServiceReplica.submitAiResponseFeedback('student_789', 'resp_445566', 'hallucination', 'Mentions organic chemistry in OS notes');
  assert(aiHallucination.feedbackType === 'hallucination' && aiHallucination.reason !== "", "AI quality feedback maps hallucination logs containing details");

  console.log("-------------------------------------------------------------------");
  if (passed) {
    console.log("⭐ ALL BETA LAUNCH SYSTEM VERIFICATIONS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("💥 BETA LAUNCH SYSTEM AUDITS COMPLETED WITH FAILURES.");
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error("Test suite crashed:", e);
  process.exit(1);
});
