import { firestoreRepository } from '../../repositories/academic/firestoreRepository.js';

/**
 * =========================================================================
 * HYPERBRAIN SUBSCRIPTION ARCHITECTURE SERVICE (Phase 4.2)
 * =========================================================================
 * Defines plans structure (Free, Student Pro, Student Pro+), feature gating,
 * trial controls, usage limits, and future payment hooks.
 * =========================================================================
 */

export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: 'free',
    name: 'Free Basic',
    features: {
      aiTutor: true,
      notes: true,
      flashcards: true,
      quiz: true,
      adaptiveLearning: false,
      advancedAnalytics: false,
      aiModelPriority: 'low'
    },
    limits: {
      aiRequestsMonthly: 15,
      notesGenMonthly: 3,
      flashcardsCreated: 20,
      quizAttemptsMonthly: 5,
      workspacesCreated: 2
    },
    pricing: {
      monthly: { amount: 0, currency: 'USD', amountINR: 0 },
      quarterly: { amount: 0, currency: 'USD', amountINR: 0 },
      annual: { amount: 0, currency: 'USD', amountINR: 0 }
    }
  },
  STUDENT_PRO: {
    id: 'student_pro',
    name: 'Student Pro',
    features: {
      aiTutor: true,
      notes: true,
      flashcards: true,
      quiz: true,
      adaptiveLearning: true,
      advancedAnalytics: true,
      aiModelPriority: 'normal'
    },
    limits: {
      aiRequestsMonthly: 100,
      notesGenMonthly: 20,
      flashcardsCreated: 150,
      quizAttemptsMonthly: 30,
      workspacesCreated: 10
    },
    pricing: {
      monthly: { amount: 9.99, currency: 'USD', amountINR: 499 },
      quarterly: { amount: 24.99, currency: 'USD', amountINR: 1299 },
      annual: { amount: 79.99, currency: 'USD', amountINR: 3999 }
    }
  },
  STUDENT_PRO_PLUS: {
    id: 'student_pro_plus',
    name: 'Student Pro+',
    features: {
      aiTutor: true,
      notes: true,
      flashcards: true,
      quiz: true,
      adaptiveLearning: true,
      advancedAnalytics: true,
      aiModelPriority: 'high'
    },
    limits: {
      aiRequestsMonthly: 500,
      notesGenMonthly: 100,
      flashcardsCreated: 1000,
      quizAttemptsMonthly: 200,
      workspacesCreated: 50
    },
    pricing: {
      monthly: { amount: 19.99, currency: 'USD', amountINR: 999 },
      quarterly: { amount: 49.99, currency: 'USD', amountINR: 2499 },
      annual: { amount: 149.99, currency: 'USD', amountINR: 7999 }
    }
  }
};

export const subscriptionService = {
  
  /**
   * Fetch subscription state for a user
   */
  async getSubscription(userId) {
    try {
      const sub = await firestoreRepository.findById('subscriptions', userId);
      if (sub) return sub;
    } catch (e) {
      console.warn("[Subscription] Failed to load subscription, running free plan.");
    }
    
    // Default Free plan state
    return {
      userId,
      planId: 'free',
      status: 'active',
      trialEnabled: false,
      trialExpiresAt: null,
      expiresAt: null,
      usage: {
        aiRequests: 0,
        notesGen: 0,
        flashcards: 0,
        quizAttempts: 0,
        workspaces: 0
      },
      planHistory: [
        { planId: 'free', startDate: new Date().toISOString(), reason: 'initial_onboarding' }
      ]
    };
  },

  /**
   * Save Subscription details
   */
  async saveSubscription(userId, subscriptionData) {
    try {
      await firestoreRepository.save('subscriptions', userId, subscriptionData);
      return true;
    } catch (e) {
      console.error("[Subscription] Failed to save subscription doc:", e);
      return false;
    }
  },

  /**
   * Feature Access Check
   */
  hasFeatureAccess(planId, featureKey) {
    const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === planId) || SUBSCRIPTION_PLANS.FREE;
    return !!plan.features[featureKey];
  },

  /**
   * Quota limits checks
   */
  checkQuotaLimit(subscription, limitKey, currentCount) {
    const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === subscription.planId) || SUBSCRIPTION_PLANS.FREE;
    const maxVal = plan.limits[limitKey] || 0;
    return {
      allowed: currentCount < maxVal,
      current: currentCount,
      limit: maxVal
    };
  },

  /**
   * Record Usage Metrics (Increment local state counters)
   */
  async incrementUsage(userId, metricKey) {
    const sub = await this.getSubscription(userId);
    if (!sub.usage) sub.usage = {};
    sub.usage[metricKey] = (sub.usage[metricKey] || 0) + 1;
    await this.saveSubscription(userId, sub);
    return sub;
  },

  /**
   * Future Integration Hooks Preparation
   * Pre-configures external transaction keys.
   */
  prepareBillingPayload(planId, gateway = 'stripe') {
    const plansPricing = {
      'student_pro': { amount: 499, currency: 'INR' },
      'student_pro_plus': { amount: 999, currency: 'INR' }
    };
    const details = plansPricing[planId] || { amount: 0, currency: 'INR' };
    return {
      gateway,
      planId,
      amount: details.amount,
      currency: details.currency,
      created: new Date().toISOString()
    };
  }
};
