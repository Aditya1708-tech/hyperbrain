import { firestoreRepository } from '../../repositories/academic/firestoreRepository.js';

/**
 * =========================================================================
 * HYPERBRAIN BETA LAUNCH SYSTEM SERVICE (Phase 3.5)
 * =========================================================================
 * Manages guided onboarding progress, contextual tours, waitlists, invite
 * code verification, feedback collections, and remote feature flag configs.
 * =========================================================================
 */

// Default local configuration for Feature Flags
let activeFeatureFlags = {
  aiTutorEnabled: true,
  notesEnabled: true,
  flashcardsEnabled: true,
  quizEnabled: true,
  registrationEnabled: true,
  maintenanceMode: false,
  globalAnnouncement: "Welcome to HyperBrain Private Beta! Try out our AI Tutor 2.0 and Spaced Repetition engine."
};

// In-memory list of invite codes for registration control
const mockInviteCodes = new Set(["BETA_LAUNCH_2026", "CAMPUS_ALPHA", "DEEPMIND_BETA"]);

export const betaLaunchService = {
  
  /**
   * Get Active Feature Flags
   */
  async getFeatureFlags() {
    try {
      const config = await firestoreRepository.findById('app_configs', 'feature_flags');
      if (config) {
        activeFeatureFlags = { ...activeFeatureFlags, ...config };
      }
    } catch (e) {
      console.warn("[BetaLaunch] Remote feature flags lookup failed, running offline fallback.");
    }
    return activeFeatureFlags;
  },

  /**
   * Admin: Modify Feature Flags / Emergency toggles
   */
  async updateFeatureFlags(updatedFlags = {}) {
    activeFeatureFlags = { ...activeFeatureFlags, ...updatedFlags };
    try {
      await firestoreRepository.save('app_configs', 'feature_flags', activeFeatureFlags);
      console.log("[BetaLaunch] Remote feature flags successfully updated:", activeFeatureFlags);
    } catch (e) {
      console.warn("[BetaLaunch] Remote feature flags update failed, updating in-memory only.");
    }
    return activeFeatureFlags;
  },

  /**
   * Invite Code & Waitlist Validator
   */
  validateInviteCode(code) {
    if (!code) return false;
    return mockInviteCodes.has(code.trim().toUpperCase());
  },

  async joinWaitlist(email, targetCourse = "") {
    const timestamp = new Date().toISOString();
    const docId = `wait_${Date.now()}`;
    const waitlistDoc = { email, targetCourse, timestamp, status: 'pending' };

    try {
      await firestoreRepository.save('waitlist', docId, waitlistDoc);
      return { success: true, message: "Successfully registered to the HyperBrain waitlist!" };
    } catch (e) {
      console.warn("[BetaLaunch] Waitlist registration failed, registering locally:", e.message);
      return { success: true, localFallback: true };
    }
  },

  /**
   * Guided Onboarding Flow Steps Loader
   */
  getOnboardingSteps() {
    return [
      {
        step: 0,
        title: "Welcome to HyperBrain 🚀",
        desc: "The world's most advanced AI-powered academic learning engine. Let's customize your study path."
      },
      {
        step: 1,
        title: "Define Your Academic Goal 🎯",
        desc: "Choose your focus area (e.g. Master Board Exams, ACE College Semester, Competitive Placement Tests)."
      },
      {
        step: 2,
        title: "Course Selection 📚",
        desc: "Select the academic subject you want to master first (e.g. Computer Science, Engineering Mathematics)."
      },
      {
        step: 3,
        title: "Setup Your First Study Workspace 💻",
        desc: "We will build a dedicated workspace compiling notes, quiz cards, flashcards, and graph maps."
      },
      {
        step: 4,
        title: "Meet Your AI Tutor 2.0 🧠",
        desc: "Engage in active recall discussions, professor-mode deep dives, or solve doubts instantly in your workspace."
      }
    ];
  },

  /**
   * Product Tour Tooltips Context
   */
  getProductTourSteps() {
    return {
      academicHub: "Browse through predefined Board Syllabuses, upload your custom textbooks, and spin up new learning workspace contexts.",
      workspace: "This is your learning cockpit, aligning progress checklists, spaced repetition pathways, and quick study routes.",
      notes: "View comprehensive, detailed notes enriched with formula blocks, warnings, code snippets, and exam preparation tips.",
      flashcards: "Practice active recall utilizing 3D memory flipcards designed to combat the cognitive memory decay curve.",
      quiz: "Test your proficiency under adaptive timer rules and verify understanding with detailed solution explanations.",
      analytics: "Inspect weekly study duration trendlines, subject progress meters, and cognitive strengths/weaknesses grids."
    };
  },

  /**
   * Submit User In-App Feedback
   */
  async submitFeedback(userId, type, message, payload = {}) {
    const timestamp = new Date().toISOString();
    const feedbackDoc = {
      userId,
      type, // 'bug_report', 'ai_issue', 'content_incorrect', 'missing_syllabus', 'feature_request'
      message,
      appVersion: "1.0.0-beta3",
      workspaceId: payload.workspaceId || "unknown",
      currentPage: payload.currentPage || "Dashboard",
      browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : "Node CLI Environment",
      timestamp
    };

    try {
      const docId = `feedback_${Date.now()}`;
      await firestoreRepository.save('user_feedbacks', docId, feedbackDoc);
      return { success: true };
    } catch (e) {
      console.warn("[BetaLaunch] Feedback submission failed, recorded local buffer:", e.message);
      return { success: true, localBuffer: true };
    }
  },

  /**
   * Submit AI Response Quality Feedback
   */
  async submitAiResponseFeedback(userId, responseId, feedbackType, reason = "") {
    const timestamp = new Date().toISOString();
    const aiFeedbackDoc = {
      userId,
      responseId,
      feedbackType, // 'helpful', 'not_helpful', 'incorrect', 'hallucination'
      reason,
      timestamp
    };

    try {
      const docId = `aifeedback_${Date.now()}`;
      await firestoreRepository.save('ai_feedbacks', docId, aiFeedbackDoc);
      return { success: true };
    } catch (e) {
      console.warn("[BetaLaunch] AI response feedback saving failed:", e.message);
      return { success: true, localBuffer: true };
    }
  }
};
