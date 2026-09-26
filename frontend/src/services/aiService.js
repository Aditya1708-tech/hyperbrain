import { auth, db } from './firebase/firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { aiQualityFramework, CONFIG_THRESHOLD } from './aiQualityFramework.js';
import { aiOptimizationService } from './aiOptimizationService.js';
import { securityService } from './firebase/securityService.js';
import { notificationService } from './firebase/firestoreService';
import { AI_CONFIG } from '../config/aiConfig.js';
import { learningGraphService } from './academic/learningGraphService';

const getEnvVar = (name) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return '';
};

function maskKey(key) {
  if (!key) return "None";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function isRealKey(key){
  if(!key) return false;
  const invalidValues = [
    "ADD_GEMINI_KEY_HERE",
    "ADD_GROQ_KEY_HERE",
    "",
    null,
    undefined
  ];
  return !invalidValues.includes(key);
}

// 1. Multiple API keys per provider
const providers = {
  gemini: [
    getEnvVar('VITE_GEMINI_KEY_1') || getEnvVar('GEMINI_KEY_1'),
    getEnvVar('VITE_GEMINI_KEY_2') || getEnvVar('GEMINI_KEY_2')
  ].filter(isRealKey)
};

if (providers.gemini.length === 0) {
  console.info("[AI Gateway] No client-side Gemini keys found. Operating securely via backend Express AI gateway.");
} else {
  console.log("Loaded client-side Gemini keys:", providers.gemini.length);
}

const isBrowser = typeof window !== 'undefined';

// 5. Health tracking store
const healthStatus = {};
const currentIndex = { gemini: 0 };

// 7. Key validation
function validateKey(key, provider) {
  if (!key) return false;
  const patterns = {
    gemini: [
      /^(AQ|AIza)[A-Za-z0-9_\-\.]{20,}$/
    ]
  };
  return patterns[provider]?.some(pattern => pattern.test(key));
}

function initializeKeys() {
  const allKeys = [
    ...providers.gemini.map(k => ({ key: k, prov: 'gemini' }))
  ];

  for (const entry of allKeys) {
    if (validateKey(entry.key, entry.prov)) {
      healthStatus[entry.key] = {
        key: entry.key,
        provider: entry.prov,
        requests: 0,
        failures: 0,
        lastUsed: "",
        status: "healthy",
        retryAfter: null
      };
    }
  }
}

initializeKeys();

// Cooldown Recovery
function checkAndRecoverKeys() {
  const now = Date.now();
  for (const key of Object.keys(healthStatus)) {
    const statusObj = healthStatus[key];
    if (statusObj.status === "failed" && statusObj.retryAfter && now > statusObj.retryAfter) {
      statusObj.status = "healthy";
      statusObj.failures = 0;
      statusObj.retryAfter = null;
      console.log(`[Gateway] Auto-recovered key: ${maskKey(key)} for provider: ${statusObj.provider}`);
    }
  }
}

// 6. Cooldown logic
function markFailed(key, cooldownUntil) {
  if (healthStatus[key]) {
    healthStatus[key].status = "failed";
    const expire = cooldownUntil || (Date.now() + 300000);
    healthStatus[key].retryAfter = expire;
    console.warn(`[Gateway] Key marked failed: ${maskKey(key)}. Cooldown set.`);
  }
}

// 2. Smart key rotation
function getNextKey(provider) {
  const keys = providers[provider] || [];
  const healthyKeys = keys.filter(key => {
    const stat = healthStatus[key];
    return !stat || stat.status !== "failed";
  });

  if (!healthyKeys.length) {
    throw new Error("No healthy keys available");
  }

  const key = healthyKeys[currentIndex[provider] % healthyKeys.length];
  currentIndex[provider]++;
  return key;
}

let keysLoadedFromFirestore = false;

export async function loadKeysFromFirestore() {
  if (keysLoadedFromFirestore) return;
  try {
    const geminiDoc = await getDoc(doc(db, 'system_settings', 'gemini'));
    if (geminiDoc.exists()) {
      const data = geminiDoc.data();
      if (data && Array.isArray(data.keys)) {
        const freshKeys = data.keys.filter(Boolean);
        if (freshKeys.length > 0) {
          providers.gemini = freshKeys;
        }
      }
    }
    
    const allKeys = [
      ...providers.gemini.map(k => ({ key: k, prov: 'gemini' }))
    ];
    for (const entry of allKeys) {
      if (!healthStatus[entry.key]) {
        healthStatus[entry.key] = {
          key: entry.key,
          provider: entry.prov,
          requests: 0,
          failures: 0,
          lastUsed: "",
          status: "healthy",
          retryAfter: null
        };
      }
    }

    keysLoadedFromFirestore = true;
    console.log("[Gateway] Keys loaded from Firestore. Gemini:", providers.gemini.length);
  } catch (e) {
    console.warn("[Gateway] Error loading keys from Firestore:", e);
  }
}

export async function reloadGatewayKeys() {
  keysLoadedFromFirestore = false;
  await loadKeysFromFirestore();
}

export async function testProviderConnection(provider, key) {
  console.log("Provider:", provider);
  console.log("Key prefix:", key ? key.substring(0, 5) : "None");
  console.log("Key length:", key ? key.length : 0);
  console.log("Testing connection...");

  try {
    if (provider === "gemini") {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        {
          method: "GET",
          headers: {
            "x-goog-api-key": key
          }
        }
      );

      const responseText = await response.text();
      console.log("Response status:", response.status);
      console.log("Response body:", responseText);

      return response.ok;
    }
    return false;
  } catch (error) {
    console.error(`${provider} connection test failed:`, error);
    return false;
  }
}

// Verification with lightweight API health request
export async function verifyKeyHealth(key, provider) {
  return testProviderConnection(provider, key);
}

async function initializeGatewayHealth() {
  console.log("[Gateway] Performing lightweight key health validations...");
  for (const key of Object.keys(healthStatus)) {
    const statusObj = healthStatus[key];
    const isHealthy = await verifyKeyHealth(key, statusObj.provider);
    if (!isHealthy) {
      statusObj.status = "failed";
      statusObj.retryAfter = Date.now() + 60000; // 1 min cooldown
      console.warn(`[Gateway] Key health test failed: ${maskKey(key)} for ${statusObj.provider}`);
    } else {
      console.log(`[Gateway] Key validated: ${maskKey(key)} for ${statusObj.provider}`);
    }
  }
}

// Trigger validation asynchronously
setTimeout(initializeGatewayHealth, 1000);

// Provider requests
async function executeGeminiCall(key, payload, taskType) {
  const model = AI_CONFIG.model;
  let contents = [];
  let systemInstruction = undefined;

  if (payload.messages) {
    const systemMsg = payload.messages.find(m => m.role === 'system');
    if (systemMsg) {
      systemInstruction = { parts: [{ text: systemMsg.content }] };
    }
    contents = payload.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
  } else {
    contents = [{ parts: [{ text: payload.prompt }] }];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const isStructured = 
    payload.responseMimeType === 'application/json' ||
    taskType === 'notes' ||
    taskType === 'quiz' ||
    taskType === 'extraction' ||
    taskType === 'flashcards';

  const generationConfig = {
    temperature: 0.7,
    maxOutputTokens: isStructured ? 8192 : (payload.messages ? 3000 : 2000),
    responseMimeType: isStructured ? 'application/json' : undefined,
    responseSchema: payload.responseSchema || undefined
  };

  const supportsThinking = model.includes('2.5') || model.includes('pro') || model.includes('thinking');
  if (isStructured && supportsThinking) {
    generationConfig.thinkingConfig = {
      thinkingBudget: 0
    };
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key
      },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw { status: res.status, message: errText };
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error("Empty response content from Gemini");
    }
    return content;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

// 4. Provider fallbacks config
const fallbacks = {
  notes: ['gemini'],
  quiz: ['gemini'],
  extraction: ['gemini'],
  chat: ['gemini'],
  default: ['gemini']
};

async function executeWithGateway(payload, taskType = 'default') {
  // --- PRODUCTION SECURITY CHECKS ---
  const userId = payload.userId || "student_1";
  const securityGuard = securityService.validateRequest(userId, payload, taskType);
  if (!securityGuard.allowed) {
    throw new Error(`Security Exception: ${securityGuard.reason}`);
  }

  // --- PRODUCTION CREDITS LIMIT GUARD ---
  const quotaCheck = await securityService.validateProductionQuota(userId);
  if (!quotaCheck.allowed) {
    throw new Error(`Security Exception: ${quotaCheck.reason}`);
  }

  // 1. Generate unique cache key
  const cacheKey = aiOptimizationService.generateCacheKey(payload, taskType);

  // 2. Multi-level Cache Lookup
  const cachedResult = await aiOptimizationService.lookupCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // 3. Optimize Token Context (Trim long context segments to avoid token bloat)
  if (payload.prompt) {
    payload.prompt = aiOptimizationService.optimizeTokenContext(payload.prompt);
  }
  if (payload.messages) {
    payload.messages = payload.messages.map(m => ({
      ...m,
      content: aiOptimizationService.optimizeTokenContext(m.content || m.text || "")
    }));
  }

  // 4. Request Deduplication (Coalesce concurrent identical queries)
  const executionFn = async () => {
    return await executeGatewayRetrieval(payload, taskType, cacheKey);
  };

  return await aiOptimizationService.deduplicateRequest(cacheKey, executionFn);
}

async function executeGatewayRetrieval(payload, taskType, cacheKey) {
  await loadKeysFromFirestore();
  checkAndRecoverKeys();

  console.log("Providers loaded:", providers);
  console.log("Gemini keys:", providers.gemini?.length);
  console.log("Runtime keys:", providers);

  const providerList = fallbacks[taskType] || fallbacks.default;
  let fallbackUsed = false;
  let retryCount = 0;
  let fallbacksCount = 0;

  const startTime = Date.now();
  let bestAttempt = { text: "", score: -1, provider: "" };

  for (let pIdx = 0; pIdx < providerList.length; pIdx++) {
    const provider = providerList[pIdx];
    if (pIdx > 0) {
      fallbackUsed = true;
      fallbacksCount++;
    }

    const keys = providers[provider];
    if (!keys || keys.length === 0) continue;

    // Try keys for this provider
    for (let tryCount = 0; tryCount < keys.length; tryCount++) {
      let key;
      try {
        key = getNextKey(provider);
      } catch (e) {
        console.warn(`[Gateway] No healthy keys found for ${provider}:`, e.message);
        break;
      }

      const maskedKey = maskKey(key);
      console.log("Current provider:", provider);
      console.log("Current key:", maskedKey);
      console.log("Health:", healthStatus[key]);
      console.log("Retries:", retryCount);
      console.log("Fallback activated:", fallbackUsed);

      const statusObj = healthStatus[key];
      if (statusObj) {
        statusObj.requests++;
        statusObj.lastUsed = new Date().toISOString();
      }

      try {
        let result = "";
        if (provider === 'gemini') {
          result = await executeGeminiCall(key, payload, taskType);
        }

        if (result) {
          const validation = aiQualityFramework.validateResponse(result, payload, taskType);
          console.log(`[QualityFramework] Confidence score: ${validation.confidenceScore} (threshold: ${CONFIG_THRESHOLD})`);

          if (validation.confidenceScore >= CONFIG_THRESHOLD) {
            const formatted = aiQualityFramework.formatResponse(result, taskType);

            // Track estimated API costs
            const inputToks = payload.prompt ? Math.ceil(payload.prompt.length / 4) : 800;
            const outputToks = Math.ceil(result.length / 4);
            const estimatedCost = aiOptimizationService.estimateAndTrackCost(provider, inputToks, outputToks);

            // Save to Cache
            await aiOptimizationService.saveToCache(cacheKey, formatted);

            await aiQualityFramework.logMonitor({
              taskType,
              provider,
              latency: Date.now() - startTime,
              confidence: validation.confidenceScore,
              retries: retryCount,
              fallbacks: fallbacksCount,
              success: true,
              estimatedCost
            });

            return formatted;
          } else {
            console.warn(`[QualityFramework] Low confidence score: ${validation.confidenceScore}. Reasons:`, validation.reasons);
            if (validation.confidenceScore > bestAttempt.score) {
              bestAttempt = { text: result, score: validation.confidenceScore, provider };
            }
          }
        }
      } catch (err) {
        console.error(`[Gateway] Error on provider: ${provider} with key: ${maskedKey}`, err);
        retryCount++;
        if (statusObj) {
          statusObj.failures++;
        }

        console.log("Response:", err.status);
        console.log("Error:", err);

        // Check retry conditions: 429, quota exceeded, timeout, network failure, provider unavailable
        const shouldCooldown = err.status === 429 || 
                               err.status === 403 || 
                               err.status === 503 ||
                               err.status === 504 ||
                               err.status === 500 ||
                               err.message?.includes("429") || 
                               err.message?.includes("403") || 
                               err.message?.includes("503") || 
                               err.message?.includes("Rate limit") || 
                               err.message?.includes("quota") ||
                               err.message?.includes("exhausted") ||
                               err.name === "AbortError" ||
                               err.name === "TypeError" || // Network failure
                               err.message?.includes("fetch") ||
                               err.message?.includes("network");

        if (shouldCooldown) {
          markFailed(key, Date.now() + 300000);
        }

        // Brief delay before retry
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  if (bestAttempt.text) {
    console.warn(`[QualityFramework] Returning best attempt with confidence score: ${bestAttempt.score}`);
    const formatted = aiQualityFramework.formatResponse(bestAttempt.text, taskType);
    
    const inputToks = payload.prompt ? Math.ceil(payload.prompt.length / 4) : 800;
    const outputToks = Math.ceil(bestAttempt.text.length / 4);
    const estimatedCost = aiOptimizationService.estimateAndTrackCost(bestAttempt.provider, inputToks, outputToks);

    // Save to Cache
    await aiOptimizationService.saveToCache(cacheKey, formatted);

    await aiQualityFramework.logMonitor({
      taskType,
      provider: bestAttempt.provider,
      latency: Date.now() - startTime,
      confidence: bestAttempt.score,
      retries: retryCount,
      fallbacks: fallbacksCount,
      success: true,
      fallbackUsedThreshold: true,
      estimatedCost
    });

    return formatted;
  }

  // Seamless fallback to Express Backend AI Gateway (where private keys are safely stored)
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: payload.prompt,
        messages: payload.messages,
        systemInstruction: payload.systemInstruction,
        temperature: payload.temperature
      })
    });
    const data = await res.json();
    if (res.ok && data.success && data.text) {
      const formatted = aiQualityFramework.formatResponse(data.text, taskType);
      await aiOptimizationService.saveToCache(cacheKey, formatted);
      return formatted;
    }
  } catch (backendError) {
    console.warn("[Gateway] Backend AI gateway fallback attempt failed:", backendError);
  }

  await aiQualityFramework.logMonitor({
    taskType,
    provider: "failure",
    latency: Date.now() - startTime,
    confidence: 0,
    retries: retryCount,
    fallbacks: fallbacksCount,
    success: false
  });

  throw new Error("AI quality validation failed: No provider could return a validated response.");
}

export async function generateAI(prompt, taskType = 'default', options = {}) {
  try {
    const text = await executeWithGateway({ prompt, ...options }, taskType);
    console.log("AI generation success");
    return text;
  } catch (error) {
    console.error("[Gateway Error]:", error);
    throw error;
  }
}

const aiService = {
  initializeModel() {
    console.log("aiService: Gemini model configuration initialized with:", AI_CONFIG.model);
  },

  async generateBrainFromPdf(base64Data, fileName) {
    console.log("Generating syllabus brain from PDF name:", fileName);
    const subjectName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

    const prompt = `You are a syllabus extraction engine.
    Task:
    Extract ONLY actual chapter titles from the Table of Contents or Index of the textbook "${subjectName}".
    
    STRICT RULES:
    1. Extract only top-level chapters/units.
    2. Ignore:
       - subtopics
       - bullet points
       - learning outcomes
       - page numbers
       - repeated headings
       - section labels like: "Part A", "Section I", "Unit", "Module"
    3. Remove page numbers.
    4. Remove separators: :, |, -, dots, ....
    5. If a line contains chapter title + subtopics:
       Keep only the chapter title.
    6. Remove duplicates.
    7. Preserve original order.
    8. Do not explain anything. Do not invent chapters. Do not generate topics not present in the PDF.

    Return strictly a valid JSON object matching this exact schema:
    {
      "subject_name": "${subjectName}",
      "topics": [
        { "title": "Chapter Title", "difficulty": "Easy/Medium/Hard", "summary": "Brief 2-sentence summary of the topic." }
      ]
    }`;

    try {
      const rawText = await generateAI(prompt, 'extraction');
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error("Failed to generate syllabus from PDF:", error);
      throw new Error("Unable to detect chapter index from document");
    }
  },

  async generateSectionContent(topic, course, section, isRetry = false) {
    if (!topic || !topic.trim()) {
      throw new Error("Missing topic");
    }

    let structureDesc = `Return exactly this JSON format:
    {
      "title": "Section Title",
      "sections": [
        {
          "type": "heading" | "paragraph" | "bulletList" | "formula" | "example" | "warning",
          "content": "Paragraph content or title description here. Keep paragraph values brief (max 4-5 lines) with line-height of 1.8.",
          "items": ["Only for bulletList type, list of bullet point items here"]
        }
      ]
    }`;

    if (section === 'quiz') {
      structureDesc = `Return exactly this JSON format with the questions array:
      {
        "title": "Quiz",
        "quiz": [
          {
            "question": "Question text?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "answer": "Option A",
            "explanation": "Why this option is correct."
          }
        ]
      }`;
    } else if (section === 'flashcards') {
      structureDesc = `Return exactly this JSON format with the cards array:
      {
        "title": "Flashcards",
        "flashcards": [
          {
            "front": "Term or Question?",
            "back": "Detailed definition or answer."
          }
        ]
      }`;
    }

    const sectionPrompts = {
      overview: `Create a highly detailed, comprehensive summary and overview for the topic "${topic}" in course "${course}". Explain why it matters, its real-world application, historical background, and direct impact. Make it extremely informative so the student has a complete foundational context.`,
      definition: `Define the core terms and formal academic definitions for "${topic}" in course "${course}". Provide rigorous technical explanations as well as intuitive conceptual breakdowns for each defined term.`,
      coreConcepts: `Provide an exhaustive, in-depth explanation of the major core concepts of "${topic}" in course "${course}". Break down at least 4-5 key concepts, detailing their structural characteristics, mechanisms, and rules.`,
      formula: `Explain the formulas, equations, derivations, units, and calculations for "${topic}" in "${course}". Provide step-by-step instructions on how to use each formula. If not applicable, return a blank title and empty sections list.`,
      detailedExplanation: `Provide an exhaustive, deep-dive academic textbook style explanation of what, why, and how "${topic}" works in course "${course}". Detail the theoretical foundations, mechanisms, edge cases, and advanced conceptual frameworks so the student does not need any external study resource.`,
      examples: `Provide 3 highly detailed, step-by-step solved mathematical, coding, or case-study examples for "${topic}", walking through every step of the solution and reasoning process.`,
      mistakes: `Detail common student misconceptions, mistakes, logical traps, and specific tips on how to avoid them when answering questions about "${topic}".`,
      examFocus: `Highlight exam focus points, high-yield topics, and expected university board questions for "${topic}".`,
      flashcards: `Generate 3-5 key flashcards to memorize core terms for "${topic}".`,
      quiz: `Generate 5 multiple choice quiz questions (MCQs) for "${topic}".`,
      revision: `Provide a quick summary, revision sheet, and 3 tutoring jump questions for "${topic}".`
    };

    const prompt = `${sectionPrompts[section] || `Explain "${section}" for topic "${topic}".`}
    
    IMPORTANT:
    Return STRICT VALID JSON ONLY.
    ${structureDesc}
    Do NOT return markdown code fences (like \`\`\`json), explanations, comments, trailing commas, or single quotes.`;

    console.log("Generating section:", section);
    console.log("Topic:", topic);
    console.log("Prompt:", prompt);

    try {
      const response = await generateAI(prompt, 'notes');
      console.log("Gateway response:", response);

      if (response && typeof response === 'object' && response.success === false) {
        throw new Error(response.reason || "provider_failure");
      }
      
      const responseText = typeof response === 'string' ? response : (response?.content || '');
      if (!responseText || !responseText.trim()) {
        throw new Error("Empty response");
      }

      console.log("Response length:", responseText.length);
      
      const isCompleteJSON = (text) => {
        try {
          const cleaned = text.replace(/```json|```/g, "").replace(/[\u0000-\u001F]+/g, " ").trim();
          JSON.parse(cleaned);
          return true;
        } catch {
          return false;
        }
      };

      const valid = isCompleteJSON(responseText);
      console.log("JSON valid:", valid);

      if (!valid && !isRetry) {
        console.warn("Invalid JSON response detected. Retrying once...");
        return this.generateSectionContent(topic, course, section, true);
      }

      const cleaned = responseText.replace(/```json|```/g, "").replace(/[\u0000-\u001F]+/g, " ").trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error(`Failed to generate section ${section}:`, e);
      console.log("Error:", e);
      if (!isRetry) {
        return this.generateSectionContent(topic, course, section, true);
      }
      return {
        title: section.charAt(0).toUpperCase() + section.slice(1),
        sections: [
          {
            type: "paragraph",
            content: "Temporarily unavailable"
          }
        ]
      };
    }
  },

  async generateNotesInSections(topic, course) {
    const sections = [
      "overview",
      "definition",
      "coreConcepts",
      "formula",
      "detailedExplanation",
      "examples",
      "examFocus",
      "flashcards",
      "quiz"
    ];
    
    // Concurrency-limited runner (limit = 2)
    const results = [];
    const executing = [];
    const limit = 2;

    for (const section of sections) {
      const p = this.generateSectionContent(topic, course, section);
      results.push(p);

      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    const resolved = await Promise.all(results);
    console.log("Generated sections:", resolved);

    const combinedSummary = resolved
      .filter(s => s && Array.isArray(s.sections))
      .map(s => {
        const blockText = s.sections.map(b => {
          if (b.type === 'heading') return `### ${b.content}`;
          if (b.type === 'bulletList') return b.items?.map(it => `* ${it}`).join('\n');
          return b.content;
        }).join('\n\n');
        return `## ${s.title}\n\n${blockText}`;
      })
      .join('\n\n');

    const quizSection = resolved.find(s => s.quiz && Array.isArray(s.quiz));
    const flashcardsSection = resolved.find(s => s.flashcards && Array.isArray(s.flashcards));

    return {
      title: topic,
      summary: combinedSummary,
      flashcards: flashcardsSection ? flashcardsSection.flashcards : [],
      quiz: quizSection ? quizSection.quiz : [],
      exam_questions: [],
      rawSections: resolved
    };
  },

  async generateNotes(topic, course, customPrompt = null, options = {}) {
    if (customPrompt) {
      console.log(`Starting generateNotes with custom prompt for topic: ${topic}`);
      return await generateAI(customPrompt, 'notes', options);
    }
    console.log("Starting generateNotes (Sequential Section Dispatcher)");
    return await this.generateNotesInSections(topic, course);
  },

  async generateQuiz(topic, course) {
    console.log("Starting generateQuiz");
    if (!topic || !course) {
      throw new Error("Missing topic or course data");
    }

    const prompt = `Create a multiple choice quiz for the topic "${topic}" in the course "${course}".
    Generate exactly 5 distinct MCQs.
    Return strictly a valid JSON array matching this exact schema:
    [{"question": "Question?", "options": ["A", "B", "C", "D"], "answer": "A", "explanation": "Why?"}]`;

    try {
      const text = await generateAI(prompt, 'quiz');
      return text;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async generateFlashcards(topic, course) {
    console.log("Starting generateFlashcards");
    if (!topic || !course) {
      throw new Error("Missing topic or course data");
    }

    const prompt = `Create 5 high-quality conceptual flashcards for the topic "${topic}" in "${course}". 
    Return strictly a valid JSON array matching this exact schema:
    [{"front": "Question?", "back": "Detailed answer explanation."}]`;

    try {
      const text = await generateAI(prompt, 'quiz');
      return text;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async getGraphContextForQuery(text = "") {
    try {
      await learningGraphService.ensureCacheLoaded();
      const nodes = await learningGraphService.getAllNodes();
      
      const matchedNodes = [];
      const lowerText = text.toLowerCase();
      
      for (const node of nodes) {
        const topicIdLower = (node.topicId || "").toLowerCase();
        const topicClean = topicIdLower.replace(/_/g, ' ').replace(/-/g, ' ');
        const matchesTopic = topicIdLower && (lowerText.includes(topicIdLower) || lowerText.includes(topicClean));
        
        if (matchesTopic) {
          matchedNodes.push(node);
        }
      }

      if (matchedNodes.length === 0) return "";

      let graphInfo = "\n=== KNOWLEDGE RELATIONSHIPS FROM HYPERBRAIN LEARNING GRAPH ===\n";
      for (const node of matchedNodes) {
        const topicId = node.topicId;
        const prereqs = await learningGraphService.getPrerequisites(topicId);
        const nextTopics = await learningGraphService.getNextTopics(topicId);
        const related = await learningGraphService.getRelatedTopics(topicId);

        graphInfo += `Topic: ${topicId}\n`;
        if (node.difficulty) graphInfo += `- Difficulty: ${node.difficulty}\n`;
        if (node.estimatedTime) graphInfo += `- Estimated study time: ${node.estimatedTime} mins\n`;
        if (prereqs.length > 0) {
          graphInfo += `- Prerequisites: ${prereqs.map(p => p.topicId).join(', ')}\n`;
        }
        if (nextTopics.length > 0) {
          graphInfo += `- Future/Next recommended topics: ${nextTopics.map(n => n.topicId).join(', ')}\n`;
        }
        if (related.length > 0) {
          graphInfo += `- Related topics: ${related.map(r => r.topicId).join(', ')}\n`;
        }
        graphInfo += "\n";
      }
      graphInfo += "==============================================================\n";
      return graphInfo;
    } catch (err) {
      console.warn("Failed to get graph context for query:", err);
      return "";
    }
  },

  async askTutor(question, context) {
    console.log("Starting askTutor");
    console.log("Question:", question);
    console.log("Context:", context);

    try {
      const graphInfo = await this.getGraphContextForQuery(question + " " + context);
      const prompt = `
      You are HyperBrain AI Tutor.

      Study Context:
      ${context}
      ${graphInfo}

      User Question:
      ${question}

      Give:
      - Simple explanation
      - Examples
      - Important concepts
      `;

      const text = await generateAI(prompt, 'chat');
      return text;
    } catch (error) {
      console.error("Tutor generation failed:", error);
      throw error;
    }
  },

  async generateSummary(topic, course) {
    console.log("Starting generateSummary");
    const prompt = `Provide a concise bullet-point summary of the core principles of "${topic}" in the course "${course}".`;
    return await generateAI(prompt);
  },

  async generateExamples(topic, course) {
    console.log("Starting generateExamples");
    const prompt = `Provide 3 concrete, real-world examples illustrating the concept of "${topic}" in the course "${course}".`;
    return await generateAI(prompt);
  },

  async explainSimpler(topic, course) {
    console.log("Starting explainSimpler");
    const prompt = `Explain the concept of "${topic}" in the course "${course}" in simpler terms for a beginner.`;
    return await generateAI(prompt);
  },

  async generateTutorResponse(userQuestion) {
    return this.askTutor(userQuestion, "General Syllabus Context");
  },

  async generateMockExam(subjectName, sectionName, questionType, count, marksPerQuestion, topicsList, customDifficulty) {
    console.log("Starting generateMockExam");
    try {
      const topicsText = topicsList && topicsList.length > 0
        ? topicsList.map(t => typeof t === 'string' ? t : t.title).join(", ")
        : "General core principles";

      let prompt = "";
      if (questionType === 'mcq') {
        prompt = `Generate exactly ${count} Multiple Choice Questions (MCQs) for the subject "${subjectName}" under the section "${sectionName}". Difficulty: ${customDifficulty || 'Medium'}. Focus topics: [${topicsText}]. Each question is worth ${marksPerQuestion} mark(s).
        Return strictly a valid JSON array matching this exact schema:
        [{"type": "mcq", "question": "Question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "Option A", "marks": ${marksPerQuestion}, "explanation": "Brief explanation."}]`;
      } else {
        prompt = `Generate exactly ${count} theoretical/short-answer questions for the subject "${subjectName}" under the section "${sectionName}". Difficulty: ${customDifficulty || 'Medium'}. Focus topics: [${topicsText}]. Each question is worth ${marksPerQuestion} mark(s).
        Return strictly a valid JSON array matching this exact schema:
        [{"type": "theory", "question": "Question text?", "model_answer": "Model answer explanation.", "marks": ${marksPerQuestion}}]`;
      }

      const rawText = await generateAI(prompt, 'quiz');
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async generateStudyPlan(subjectName, topics, examDate, studyHours) {
    console.log("Starting generateStudyPlan");
    try {
      const topicsText = topics.map(t => typeof t === 'string' ? t : t.title).join(", ");
      const prompt = `Create a custom day-by-day study roadmap for the course "${subjectName}" with topics: [${topicsText}]. 
      The exam is on ${examDate} and the student studies ${studyHours} hours per day.
      Return strictly a valid JSON array of days matching this structure:
      [{"day": "Day 1", "topic": "Topic Name", "tasks": [{"text": "Task description", "completed": false}], "completed": false}]`;

      const rawText = await generateAI(prompt);
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async askTutorChat(messages, context, difficulty = 'Medium') {
    const hasKeys = providers.gemini.length > 0;
    if (!hasKeys) {
      console.error("No API keys loaded in gateway");
      throw new Error("No configured keys available in AI Gateway.");
    }

    // 1. Context Pipeline Extraction
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

    try {
      // 2. Learning Graph Prerequisite Audit
      let prereqAlertText = "";
      let incompletePrereqs = [];
      
      if (activeTopicId) {
        await learningGraphService.ensureCacheLoaded();
        const directPrereqs = await learningGraphService.getPrerequisites(activeTopicId);
        
        for (const pr of directPrereqs) {
          const prRecord = studentProgress[pr.topicId];
          const isCompleted = prRecord === true || (prRecord && prRecord.completed === true);
          if (!isCompleted) {
            incompletePrereqs.push(pr.topicId);
          }
        }

        if (incompletePrereqs.length > 0) {
          prereqAlertText = `⚠️ [Recommendation: Study Prerequisite First] You haven't completed the prerequisite topic(s): ${incompletePrereqs.join(', ')}. We highly recommend reviewing these first to build a solid foundation!\n\n`;
        }
      }

      const lastUserMsg = messages && messages.length > 0 ? (messages[messages.length - 1].text || messages[messages.length - 1].content || "") : "";
      const graphInfo = await this.getGraphContextForQuery(lastUserMsg + " " + textContext + " " + activeTopicId);

      // 3. Mapping teaching modes prompts
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

      const selectedModePrompt = teachingModePrompts[teachingMode] || teachingModePrompts['doubt_solver'];

      // 4. Construct System Prompt
      const systemPrompt = `You are HyperBrain AI Tutor 2.0, an advanced academic mentor deeply integrated with the student's workspace environment.
Your current role:
1. Explain concepts, solve doubts, and suggest customized study paths.
2. Adapt your answers to the selected Difficulty Level: "${difficulty}".
   - Beginner: Simple analogies, very easy vocabulary, step-by-step concepts.
   - Intermediate: Standard college level, detailed definitions, structured examples.
   - Advanced: Academic rigor, formal definitions, proofs, technical details, code blocks.
3. Teaching Mode Guidelines:
   ${selectedModePrompt}
4. Align your responses to the current Study Context:
   ${textContext}
   ${graphInfo}
   ${incompletePrereqs.length > 0 ? `⚠️ Student has NOT completed prerequisites: ${incompletePrereqs.join(', ')}. Encourage studying them first.` : ''}
5. Primary Source Grounding: Use the provided workspace text and notes (Knowledge Object) as your primary source of truth.
6. Connect Concepts: Use the learning graph details to link related concepts together.
7. Next Actions Output: At the end of your response, ALWAYS add a section titled "Next Actions:" and list exactly 3 actions from this list, wrapped in square brackets:
   - * [Practice Quiz]
   - * [Generate Flashcards]
   - * [Revise Prerequisite: PrereqTopicName] (Use this if they have incomplete prerequisites like: ${incompletePrereqs.join(', ')})
   - * [Open Related Topic: RelatedTopicName]
   - * [Mark Topic Complete]

   Format example:
   Next Actions:
   * [Practice Quiz]
   * [Mark Topic Complete]
   * [Open Related Topic: Synchronization]
`;

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role === 'ai' || msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.text || msg.content
        }))
      ];

      const text = await executeWithGateway({ messages: apiMessages }, 'chat');
      
      if (!text) {
        throw new Error("Invalid response: Empty message content returned from Gateway.");
      }

      console.log("AI Chat completion success");
      // Prepend warning if prerequisites are incomplete
      return prereqAlertText + text;
    } catch (error) {
      console.error("[Gateway Chat Error]:", error);
      throw error;
    }
  },

  async classifyAndExtractDocument(fileName, fileSize, extractedText = "") {
    const prompt = `Extract only top-level chapter titles from this TOC text. Ignore questions, examples, exercises, and subtopics.

You are a syllabus extraction engine.

Task:
Extract ONLY actual chapter titles from the textbook's Table of Contents or Index.

STRICT RULES:

1. Extract only top-level chapters/units.
2. Ignore:
   * subtopics
   * bullet points
   * learning outcomes
   * page numbers
   * repeated headings
   * section labels like:
     "Part A"
     "Section I"
     "Unit"
     "Module"
3. Remove page numbers.
4. Remove separators:
   :, |, -, dots, ....
5. If a line contains chapter title + subtopics:
   Keep only the chapter title.

Example:

Input:
"Sources of Law : Meaning of Law | Significance | Relevance of Law to Civil Society"

Output:
"Sources of Law"

Input:
"Chapter 1 Accounting for Partnership Firms – Fundamentals"

Output:
"Accounting for Partnership Firms – Fundamentals"

Input:
"Unit II Accounting for Companies"

Output:
"Accounting for Companies"

6. Remove duplicates.
7. Preserve original order.
8. Return ONLY valid JSON matching this schema:
{
  "classification": "Syllabus | Textbook | Study notes | Research paper | Handwritten notes | Mixed document",
  "confidence": 0.95,
  "reasoning": "Explanation of indicators found",
  "topicSource": "index_detected | toc_detected | ai_generated",
  "subject_name": "extracted subject name",
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Chapter Title",
      "description": "Short description of the chapter contents.",
      "difficulty": "Easy",
      "pageRange": "1-15"
    }
  ]
}

Do not explain anything.
Do not invent chapters.
Do not generate topics not present in the PDF.

Here is the document context:
- File Name: "${fileName}"
- File Size: ${fileSize} bytes
- Extracted Text:
--- EXTRACTED TEXT START ---
${extractedText}
--- EXTRACTED TEXT END ---

Do NOT wrap the JSON in markdown formatting other than \`\`\`json ... \`\`\`. Do NOT add any extra commentary outside the JSON block.`;

    try {
      const rawText = await generateAI(prompt, 'extraction');
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error("Document classification and extraction failed:", error);
      throw new Error("Unable to detect chapter index from document");
    }
  },

  async generateUpgradedNotes(subjectName, chapters, level = 'Detailed Notes', workspaceContext = {}) {
    const chaptersText = chapters.map(ch => `Chapter ${ch.chapterNumber || ''}: ${ch.title} (Description: ${ch.description || ''})`).join('\n');

    let contextText = "";
    if (workspaceContext.bookName) {
      contextText += `Uploaded Book / Source: ${workspaceContext.bookName}\n`;
    }
    if (workspaceContext.syllabus) {
      contextText += `Syllabus Context: ${workspaceContext.syllabus}\n`;
    }
    if (workspaceContext.goals && workspaceContext.goals.length > 0) {
      contextText += `Syllabus Goals: ${workspaceContext.goals.join(', ')}\n`;
    }

    const prompt = `You are a world-class academic educator, curriculum designer, and expert AI tutor.
Generate a deep, textbook-level, syllabus-aware interactive study package for the subject "${subjectName}" focusing on these chapters/topics:
${chaptersText}

Primary Source and Context of Truth:
${contextText}

You must prioritize absolute clarity, deep explanations, and practical understanding. Avoid generic summaries or brief bullet points. Expand key concepts so that students fully master the topic without requiring external resources. Minimum depth requirement is 1000-2000 words.

Your response must contain two parts:

PART 1: Deep Markdown Study Guide
Produce a deeply structured study guide with the following sections:
# [Topic Title]

## Quick Overview
- What this topic is
- Why it matters
- Where it is used
- Real-world relevance

## Definition
- Formal definition
- Simplified student-friendly explanation

## Core Concepts
- Break the topic into its core concepts. For each concept, provide a detailed explanation (no huge paragraphs, use examples).

## Formula Section (Include ONLY if relevant to the subject, otherwise state "No formulas apply for this chapter")
- Formula, Variable meanings, Units, Derivation (if important), When to use, Common mistakes, Solved numerical example.

## Detailed Explanation
- Divide into: What, Why, How, Working, Importance, Applications, Advantages, Disadvantages. Limit to 3-5 lines per block.

## Deep Understanding Section
- Explain the intuition, logic, and how to think about the concepts (e.g. use relatable physical/economic/programmatic analogies rather than abstract terms).

## Solved Examples
- Provide at least 3 concrete solved examples (Math: step-by-step calculations; Accounts: journal entries and balance sheets; Programming: code blocks; Law: case examples; Science: numerical examples).

## Visual Learning Section
- Comparison tables, process flowcharts, timelines, or diagrams represented in text/markdown tables.

## Common Student Mistakes
- ❌ Wrong thinking vs. ✅ Correct understanding.

## Memory Tricks
- Mnemonics, shortcuts, and revision tricks.

## Exam Focus Section
- Star ratings (⭐/⭐⭐/⭐⭐⭐) with expected questions, patterns, and exam tips.

## Flashcards
- Q / A list of at least 5 conceptual cards.

## AI Practice Questions
- Easy, Medium, Hard, Conceptual, and Application-based questions.

## Quick Revision Sheet
- 5 to 10 clear, high-yield bullet points.

## One Minute Revision
- Ultra-short recap.

PART 2: Interactive JSON Package
At the very bottom of your response, you MUST append a single valid JSON block enclosed in \`\`\`json ... \`\`\` containing:
\`\`\`json
{
  "type": "deep_interactive_package",
  "title": "${subjectName}",
  "overview": {
    "what": "What this topic is",
    "why": "Why it matters",
    "where": "Where it is used",
    "relevance": "Real-world relevance"
  },
  "definition": {
    "formal": "Formal textbook definition",
    "simplified": "Simplified translation in student-friendly language"
  },
  "coreConcepts": [
    { "title": "Concept Name", "explanation": "Detailed conceptual explanation", "importance": "Why it is critical" }
  ],
  "formula": {
    "exists": true,
    "formula": "Formula definition",
    "variables": ["Var 1 description", "Var 2 description"],
    "units": "Standard units",
    "derivation": "Derivation overview",
    "whenToUse": "When to apply this formula",
    "commonMistakes": "Mistakes to avoid when using this formula",
    "calculation": "Solved numerical example step-by-step"
  }, // or set "exists": false if no formulas apply
  "detailed": {
    "what": "What explanation (max 5 lines)",
    "why": "Why explanation (max 5 lines)",
    "how": "How explanation (max 5 lines)",
    "working": "Working process (max 5 lines)",
    "importance": "Key importance (max 5 lines)",
    "advantages": "Advantages bullet points (max 5 lines)",
    "disadvantages": "Disadvantages bullet points (max 5 lines)",
    "applications": "Practical applications (max 5 lines)"
  },
  "deepUnderstanding": {
    "intuition": "Conceptual intuition",
    "logic": "Underlying logic",
    "thinking": "How to think about it analogy"
  },
  "solvedExamples": [
    { "title": "Example 1 Title", "content": "Calculations / code / journal / case text", "explanation": "Explanation of solution" },
    { "title": "Example 2 Title", "content": "Calculations / code / journal / case text", "explanation": "Explanation of solution" },
    { "title": "Example 3 Title", "content": "Calculations / code / journal / case text", "explanation": "Explanation of solution" }
  ],
  "visual": {
    "type": "flowchart",
    "data": ["Step 1", "Step 2", "Step 3"]
  },
  "mistakes": [
    { "wrong": "❌ Wrong thinking description", "correct": "✅ Correct understanding explanation" }
  ],
  "memoryTrick": {
    "mnemonic": "Memory tricks, mnemonics, or shortcuts to remember the theme",
    "shortcut": "Shortcuts / tricks"
  },
  "examFocus": [
    { "question": "Expected exam question", "rating": 3, "pattern": "Previous pattern or derivation details", "tip": "Exam tip" }
  ],
  "tutorQuestions": [
    { "question": "Conceptual challenge question?", "difficulty": "Easy", "type": "Conceptual" },
    { "question": "Numerical calculation question?", "difficulty": "Medium", "type": "Numerical" },
    { "question": "Application case study question?", "difficulty": "Hard", "type": "Application-based" }
  ],
  "revisionSheet": [
    "Key revision bullet point 1",
    "Key revision bullet point 2",
    "Key revision bullet point 3",
    "Key revision bullet point 4",
    "Key revision bullet point 5"
  ],
  "oneMinuteRevision": "Ultra-short recap summarizing everything",
  "flashcards": [
    { "front": "Concept Question 1?", "back": "Definition 1" },
    { "front": "Concept Question 2?", "back": "Definition 2" },
    { "front": "Concept Question 3?", "back": "Definition 3" },
    { "front": "Concept Question 4?", "back": "Definition 4" },
    { "front": "Concept Question 5?", "back": "Definition 5" }
  ],
  "quiz": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Why correct"
    },
    {
      "question": "Question text 2?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 1,
      "explanation": "Why correct"
    },
    {
      "question": "Question text 3?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 2,
      "explanation": "Why correct"
    },
    {
      "question": "Question text 4?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 3,
      "explanation": "Why correct"
    },
    {
      "question": "Question text 5?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Why correct"
    }
  ]
}
\`\`\`

Strict rules:
- Provide high quality academic details. No placeholders.
- The JSON block at the bottom must be perfectly valid.`;

    try {
      const response = await generateAI(prompt, 'notes');
      return response;
    } catch (err) {
      console.error("Failed to generate upgraded notes:", err);
      throw err;
    }
  },

  async fetchOrGenerateSyllabus(programName) {
    console.log("Starting fetchOrGenerateSyllabus for:", programName);
    const prompt = `You are a world-class academic curriculum designer and expert syllabus discovery engine.
    Task:
    Search, discover, or compile the official, standard university/board syllabus curriculum structure for the educational program/degree/exam: "${programName}".
    Ground this search in official guidelines (UGC, AICTE, CBSE, state boards, or ICAI).
    
    STRICT RULES:
    1. Organize the syllabus into semesters (e.g. "Semester 1", "Semester 2") or study levels (e.g. "Prelims Phase", "Foundation Level").
    2. Provide exactly 3 major subjects for the first few semesters/levels.
    3. For each subject, provide exactly 3 detailed topics/chapters.
    4. For each topic, provide a chapterNumber (integer), title, description, difficulty, and a concise 1-2 sentence core concept "summary" which acts as the notes.
    5. Return STRICTLY a valid JSON object matching this exact schema:
    {
      "name": "${programName}",
      "description": "Comprehensive program overview detailing eligibility and scope.",
      "duration": "e.g. 3 Years or 1 Year",
      "eligibility": "e.g. Class 12 or Bachelor's Degree",
      "universities": ["UGC", "AICTE", "Major Indian Universities"],
      "lastUpdated": "July 2026",
      "semesters": {
        "Semester 1": [
          {
            "name": "Subject 1 Name",
            "topics": [
              {
                "chapterNumber": 1,
                "title": "Topic 1 Title",
                "description": "Topic brief description.",
                "difficulty": "Easy" | "Medium" | "Hard",
                "summary": "Core concept summary details for notes preview."
              }
            ]
          }
        ]
      }
    }
    
    Do NOT wrap in any extra text or markdown formatting besides standard JSON.`;

    try {
      const response = await generateAI(prompt, 'notes');
      return response;
    } catch (err) {
      console.error("Failed to fetch or generate syllabus:", err);
      throw err;
    }
  }
};

aiService.initializeModel();

export async function askTutor(question, context) {
  return aiService.askTutor(question, context);
}

export async function askTutorChat(messages, context, difficulty) {
  return aiService.askTutorChat(messages, context, difficulty);
}

export async function classifyAndExtractDocument(fileName, fileSize, description) {
  return aiService.classifyAndExtractDocument(fileName, fileSize, description);
}

export async function generateUpgradedNotes(subjectName, chapters, level) {
  return aiService.generateUpgradedNotes(subjectName, chapters, level);
}

export async function fetchOrGenerateSyllabus(programName) {
  return aiService.fetchOrGenerateSyllabus(programName);
}

export function getGatewayStats() {
  const statsList = [];
  for (const key of Object.keys(healthStatus)) {
    const s = healthStatus[key];
    statsList.push({
      key: maskKey(key),
      provider: s.provider,
      requests: s.requests || 0,
      failures: s.failures || 0,
      lastUsed: s.lastUsed || "Never",
      status: s.status || "healthy"
    });
  }
  return statsList;
}

export default aiService;
