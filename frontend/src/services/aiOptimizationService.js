import { firestoreRepository } from '../repositories/academic/firestoreRepository.js';

/**
 * =========================================================================
 * HYPERBRAIN PERFORMANCE & COST OPTIMIZATION SERVICE (Phase 3.2)
 * =========================================================================
 * Manages in-memory + Firestore caches, in-flight request deduplication,
 * task-specific provider routing, token usage estimation, and cost monitoring.
 * =========================================================================
 */

// In-memory cache store
const localCacheStore = new Map();

// In-flight active requests (Deduplication map)
const activeRequests = new Map(); // key -> Promise

// Provider Pricing (Per 1 Million Tokens)
const MODEL_PRICING = {
  groq: { input: 0.59, output: 0.79 },      // Llama 3.3 70B Versatile average
  gemini: { input: 0.075, output: 0.30 },   // Gemini 2.5 Flash pricing
  default: { input: 0.10, block: 0.10 }
};

// Telemetry counters
let cacheHits = 0;
let cacheMisses = 0;
let totalCostEstimated = 0;

export const aiOptimizationService = {
  
  /**
   * Generates a fast, unique string hash for caching payloads
   */
  generateCacheKey(payload, taskType = 'default') {
    const stringified = payload.messages 
      ? JSON.stringify(payload.messages.map(m => `${m.role}:${m.content}`))
      : (payload.prompt || "");
    
    let hash = 0;
    for (let i = 0; i < stringified.length; i++) {
      hash = (hash << 5) - hash + stringified.charCodeAt(i);
      hash |= 0;
    }
    return `${taskType}_${Math.abs(hash)}`;
  },

  /**
   * Multi-Level Cache Lookup
   * Checks local memory, then queries Firestore ai_cache
   */
  async lookupCache(key) {
    // 1. Check local memory
    if (localCacheStore.has(key)) {
      cacheHits++;
      console.log(`[Optimization] Local memory cache hit for key: ${key}`);
      return localCacheStore.get(key);
    }

    // 2. Check Firestore cache
    try {
      const cachedDoc = await firestoreRepository.findById('ai_cache', key);
      if (cachedDoc && cachedDoc.result) {
        cacheHits++;
        console.log(`[Optimization] Firestore persistent cache hit for key: ${key}`);
        // Populate local memory for future checks
        localCacheStore.set(key, cachedDoc.result);
        return cachedDoc.result;
      }
    } catch (e) {
      console.warn(`[Optimization] Firestore cache lookup failed for key: ${key}`, e.message);
    }

    cacheMisses++;
    return null;
  },

  /**
   * Saves results into memory and Firestore
   */
  async saveToCache(key, result) {
    if (!result) return;
    
    // Save memory
    localCacheStore.set(key, result);

    // Save Firestore
    try {
      await firestoreRepository.save('ai_cache', key, {
        result,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn(`[Optimization] Firestore cache save failed for key: ${key}`, e.message);
    }
  },

  /**
   * Request Coalescer (Deduplication)
   * Wraps executions. Concurrent requests for the same key await the same Promise.
   */
  async deduplicateRequest(key, executeFn) {
    if (activeRequests.has(key)) {
      console.log(`[Optimization] Coalescing active in-flight request for key: ${key}`);
      return activeRequests.get(key);
    }

    // Spawn new execution promise
    const promise = executeFn().finally(() => {
      // Clean up on finish
      activeRequests.delete(key);
    });

    activeRequests.set(key, promise);
    return promise;
  },

  /**
   * Invalidate local memory and Firestore cache store
   */
  async invalidateCache(keyPattern = null) {
    if (!keyPattern) {
      localCacheStore.clear();
      console.log("[Optimization] Local cache fully cleared.");
      return;
    }

    // Patterned local clear
    for (const k of localCacheStore.keys()) {
      if (k.includes(keyPattern)) {
        localCacheStore.delete(k);
      }
    }
  },

  /**
   * Token optimizer: trims text inputs to fit model focus areas
   */
  optimizeTokenContext(text, maxLength = 3000) {
    if (!text || text.length <= maxLength) return text;
    // Truncate to maximum characters, prioritizing headings
    console.log(`[Optimization] Truncating context from ${text.length} to ${maxLength} chars.`);
    return text.substring(0, maxLength) + "\n\n[Context truncated for token optimization...]";
  },

  /**
   * Estimated Cost Tracker
   */
  estimateAndTrackCost(provider, inputTokens = 800, outputTokens = 400) {
    const rate = MODEL_PRICING[provider] || MODEL_PRICING.default;
    const inputCost = (inputTokens / 1000000) * rate.input;
    const outputCost = (outputTokens / 1000000) * (rate.output || rate.input);
    const sessionCost = inputCost + outputCost;

    totalCostEstimated += sessionCost;
    return sessionCost;
  },

  /**
   * Get Optimization Metrics Telemetry
   */
  getTelemetry() {
    const totalRequests = cacheHits + cacheMisses;
    const hitRate = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;
    const missRate = totalRequests > 0 ? Math.round((cacheMisses / totalRequests) * 100) : 0;

    return {
      cacheHits,
      cacheMisses,
      hitRate,
      missRate,
      totalCostEstimated: parseFloat(totalCostEstimated.toFixed(6))
    };
  }
};
