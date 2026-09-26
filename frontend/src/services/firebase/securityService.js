import { firestoreRepository } from '../../repositories/academic/firestoreRepository.js';
import { db } from './firebase.js';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * =========================================================================
 * HYPERBRAIN SECURITY & ENTERPRISE READINESS SERVICE (Phase 3.3)
 * =========================================================================
 * Implements role verification (Student, Admin, Super Admin), prompt injection
 * checks, sliding-window rate limit buckets, and telemetry audit loggers.
 * =========================================================================
 */

// Role Hierarchy Mapping
export const ROLES = {
  STUDENT: { name: 'Student', level: 1 },
  ADMIN: { name: 'Admin', level: 2 },
  SUPER_ADMIN: { name: 'Super Admin', level: 3 }
};

// Rate Limit Thresholds (Requests per hour per task type)
const RATE_LIMITS = {
  chat: 30,
  notes: 10,
  quiz: 15,
  flashcards: 15,
  workspace_creation: 10,
  repository: 100
};

// Global rate limiting storage in-memory (userId -> { taskType -> timestampArray })
const rateLimitBuckets = new Map();

// Cooldown lock store (userId -> lockExpirationTimestamp)
const cooldownStore = new Map();

export const securityService = {

  /**
   * Role-Based Access Control Verification
   */
  hasRoleAccess(userRole, requiredRoleName) {
    const userRoleObj = Object.values(ROLES).find(r => r.name.toLowerCase() === (userRole || 'student').toLowerCase());
    const reqRoleObj = Object.values(ROLES).find(r => r.name.toLowerCase() === requiredRoleName.toLowerCase());
    
    if (!userRoleObj || !reqRoleObj) return false;
    return userRoleObj.level >= reqRoleObj.level;
  },

  /**
   * Prompts Injection Detector
   * Analyzes string inputs for common jailbreak, bypass, or system leakage vectors
   */
  detectPromptInjection(inputString) {
    if (!inputString || typeof inputString !== 'string') return false;

    const lowerInput = inputString.toLowerCase();
    const injectionPatterns = [
      "ignore previous",
      "ignore instructions",
      "ignore the instructions",
      "bypass safety",
      "forget your instructions",
      "reveal your system prompt",
      "reveal your instructions",
      "print your instructions",
      "system prompt",
      "you are now a",
      "dan mode",
      "jailbreak"
    ];

    return injectionPatterns.some(pattern => lowerInput.includes(pattern));
  },

  /**
   * Sliding-Window Rate Limiter
   * Limits operations to prevent API resource abuse
   */
  checkRateLimit(userId, taskType = 'chat') {
    if (import.meta.env.DEV) {
      return { allowed: true, count: 0, limit: 99999 };
    }
    const limit = RATE_LIMITS[taskType] || 20;
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    if (!rateLimitBuckets.has(userId)) {
      rateLimitBuckets.set(userId, {});
    }

    const userMap = rateLimitBuckets.get(userId);
    if (!userMap[taskType]) {
      userMap[taskType] = [];
    }

    // Filter out requests older than 1 hour
    userMap[taskType] = userMap[taskType].filter(timestamp => timestamp > oneHourAgo);

    if (userMap[taskType].length >= limit) {
      console.warn(`[Security] Rate limit exceeded for user ${userId} on task ${taskType}`);
      return { allowed: false, count: userMap[taskType].length, limit };
    }

    // Add current timestamp
    userMap[taskType].push(now);
    return { allowed: true, count: userMap[taskType].length, limit };
  },

  /**
   * Cooldown Restrictions Management
   */
  isUserCooldownLocked(userId) {
    if (!cooldownStore.has(userId)) return false;
    const expiration = cooldownStore.get(userId);
    if (Date.now() > expiration) {
      cooldownStore.delete(userId);
      return false;
    }
    return true;
  },

  applyUserCooldown(userId, durationMs = 900000) { // 15 mins default
    cooldownStore.set(userId, Date.now() + durationMs);
    console.warn(`[Security] Applied cooldown lock to user ${userId} for ${durationMs}ms`);
  },

  /**
   * Unified Request Validator Guard
   */
  validateRequest(userId, payload = {}, taskType = 'chat') {
    // 1. Cooldown checks
    if (this.isUserCooldownLocked(userId)) {
      return { allowed: false, reason: "Account is in temporary cooldown due to security violations." };
    }

    // 2. Input Validation (Ensure payloads are formatted and IDs exist)
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return { allowed: false, reason: "Missing or malformed authentication credentials." };
    }

    // 3. Scan for Injection Abuse
    const textContent = payload.prompt || payload.userQuestion || JSON.stringify(payload.messages || "");
    if (this.detectPromptInjection(textContent)) {
      this.applyUserCooldown(userId, 1800000); // 30 minutes for jailbreak attempts
      this.logAudit('prompt_injection_threat', userId, { taskType, textContent });
      return { allowed: false, reason: "Security Exception: Malicious command inputs detected." };
    }

    // 4. Check rate limits
    const rateCheck = this.checkRateLimit(userId, taskType);
    if (!rateCheck.allowed) {
      return { allowed: false, reason: `Rate limit exceeded. Allowed: ${rateCheck.limit} calls/hour.` };
    }

    return { allowed: true };
  },

  /**
   * Database-Backed Daily AI Credits Limit Guard (Production Ready)
   */
  async validateProductionQuota(userId) {
    if (import.meta.env.DEV) {
      return { allowed: true };
    }
    if (!userId || userId === "student_1" || !db) {
      return { allowed: true };
    }

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return { allowed: true };
      }

      const userData = userSnap.data();
      const plan = userData.plan || (userData.isPro ? 'pro' : 'free');
      
      let maxCredits = 50; // Free: 50 / day
      if (plan === 'pro' || userData.isPro) {
        maxCredits = 500; // Pro: 500 / day
      } else if (plan === 'institution') {
        maxCredits = userData.customQuota || 1000; // Institution: configurable
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const lastReset = userData.lastReset || '';
      let creditsRemaining = userData.aiCreditsRemaining !== undefined ? userData.aiCreditsRemaining : maxCredits;

      if (lastReset !== todayStr) {
        creditsRemaining = maxCredits;
        await updateDoc(userRef, {
          aiCreditsRemaining: maxCredits,
          lastReset: todayStr
        }).catch(() => {});
      }

      if (creditsRemaining <= 0) {
        return {
          allowed: false,
          reason: `Daily generation limit reached. Free accounts get ${maxCredits} AI queries per day. Upgrade to Pro for full access.`
        };
      }

      // Deduct one credit
      await updateDoc(userRef, {
        aiCreditsRemaining: creditsRemaining - 1
      }).catch(() => {});

      return { allowed: true };
    } catch (err) {
      console.warn("Production quota verification failed, allowing request:", err);
      return { allowed: true };
    }
  },

  /**
   * Security Audit Logger
   */
  async logAudit(eventType, userId, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logDoc = {
      eventType,
      userId,
      metadata,
      timestamp
    };

    console.warn(`[AuditLog] EVENT: ${eventType} | USER: ${userId} | DETAILS:`, metadata);

    try {
      const docId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await firestoreRepository.save('security_audit_logs', docId, logDoc);
    } catch (e) {
      console.error("[Security] Audit log write failed:", e.message);
    }
  }
};
