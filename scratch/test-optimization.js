/**
 * =========================================================================
 * HYPERBRAIN PERFORMANCE & COST OPTIMIZATION VERIFICATION SUITE
 * =========================================================================
 * Tests multi-level caching, concurrent request deduplication, context
 * token truncation, model pricing cost estimation, and telemetry trackers.
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
// OPTIMIZATION SERVICE REPLICAS
// -------------------------------------------------------------------

const localCacheStore = new Map();
const activeRequests = new Map();

const MODEL_PRICING = {
  groq: { input: 0.59, output: 0.79 },
  gemini: { input: 0.075, output: 0.30 },
  default: { input: 0.10, output: 0.10 }
};

let cacheHits = 0;
let cacheMisses = 0;
let totalCostEstimated = 0;

const aiOptimizationServiceReplica = {
  generateCacheKey(payload, taskType = 'default') {
    const stringified = payload.messages 
      ? JSON.stringify(payload.messages) 
      : (payload.prompt || "");
    
    let hash = 0;
    for (let i = 0; i < stringified.length; i++) {
      hash = (hash << 5) - hash + stringified.charCodeAt(i);
      hash |= 0;
    }
    return `${taskType}_${Math.abs(hash)}`;
  },

  async lookupCache(key) {
    if (localCacheStore.has(key)) {
      cacheHits++;
      return localCacheStore.get(key);
    }
    cacheMisses++;
    return null;
  },

  async saveToCache(key, result) {
    localCacheStore.set(key, result);
  },

  async deduplicateRequest(key, executeFn) {
    if (activeRequests.has(key)) {
      return activeRequests.get(key);
    }

    const promise = executeFn().finally(() => {
      activeRequests.delete(key);
    });

    activeRequests.set(key, promise);
    return promise;
  },

  optimizeTokenContext(text, maxLength = 100) { // Set small length for test
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "\n\n[Truncated...]";
  },

  estimateAndTrackCost(provider, inputTokens, outputTokens) {
    const rate = MODEL_PRICING[provider] || MODEL_PRICING.default;
    const inputCost = (inputTokens / 1000000) * rate.input;
    const outputCost = (outputTokens / 1000000) * rate.output;
    const sessionCost = inputCost + outputCost;

    totalCostEstimated += sessionCost;
    return sessionCost;
  },

  getTelemetry() {
    const totalRequests = cacheHits + cacheMisses;
    return {
      cacheHits,
      cacheMisses,
      hitRate: totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0,
      totalCostEstimated: parseFloat(totalCostEstimated.toFixed(6))
    };
  }
};

// ==========================================
// TEST EXECUTION RUNS
// ==========================================

async function runTests() {
  console.log("-------------------------------------------------------------------");
  console.log("🧪 RUNNING HYPERBRAIN OPTIMIZATION & DE-DUPLICATION TESTS");
  console.log("-------------------------------------------------------------------");

  // Test 1: Cache keys generated uniquely
  const payload1 = { prompt: "Explain Mutex Semaphores" };
  const payload2 = { prompt: "Explain Bankers Algorithm" };
  const key1 = aiOptimizationServiceReplica.generateCacheKey(payload1, 'chat');
  const key2 = aiOptimizationServiceReplica.generateCacheKey(payload2, 'chat');
  assert(key1 !== key2, "Unique prompts generate distinct cache keys");

  // Test 2: Local Cache set and retrieve
  await aiOptimizationServiceReplica.saveToCache(key1, "Cached Semaphores definition");
  const cachedVal = await aiOptimizationServiceReplica.lookupCache(key1);
  assert(cachedVal === "Cached Semaphores definition", "Cached results are successfully saved and loaded from local cache");

  const telemetryAfterHit = aiOptimizationServiceReplica.getTelemetry();
  assert(telemetryAfterHit.cacheHits === 1, "Cache hit telemetry counts hits accurately");

  // Test 3: Request coalescing (Deduplication)
  let executionsCount = 0;
  const longExecution = () => new Promise(resolve => {
    executionsCount++;
    setTimeout(() => resolve("Coalesced Result"), 50);
  });

  // Call deduplicate concurrently
  const reqKey = "coalesce_test";
  const [res1, res2] = await Promise.all([
    aiOptimizationServiceReplica.deduplicateRequest(reqKey, longExecution),
    aiOptimizationServiceReplica.deduplicateRequest(reqKey, longExecution)
  ]);

  assert(executionsCount === 1, "Deduplication: Only ONE execution was triggered for concurrent identical requests");
  assert(res1 === "Coalesced Result" && res2 === "Coalesced Result", "Deduplication: Both callers received identical returned results");

  // Test 4: Token Context Truncation optimization
  const longContext = "A".repeat(250);
  const truncated = aiOptimizationServiceReplica.optimizeTokenContext(longContext, 50);
  assert(truncated.length === 50 + "\n\n[Truncated...]".length, "Token optimizer trims context to limit unnecessary token transfers");

  // Test 5: Cost tracking calculations
  const costGroq = aiOptimizationServiceReplica.estimateAndTrackCost('groq', 100000, 50000);
  const costGemini = aiOptimizationServiceReplica.estimateAndTrackCost('gemini', 100000, 50000);

  assert(costGroq > costGemini, "AI Routing costs are computed differently based on model profiles (Groq > Gemini)");
  assert(aiOptimizationServiceReplica.getTelemetry().totalCostEstimated > 0, "API total cost tracked in telemetry session logs");

  console.log("-------------------------------------------------------------------");
  if (passed) {
    console.log("⭐ ALL OPTIMIZATION FRAMEWORK TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("💥 OPTIMIZATION FRAMEWORK INTEGRATION ENCOUNTERED AUDIT FAILURES.");
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error("Test execution aborted:", e);
  process.exit(1);
});
