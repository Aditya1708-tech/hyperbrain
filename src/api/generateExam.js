const FIREBASE_PROJECT_ID = "campus-hyper-brain";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function jsToFirestore(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: String(value) };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(item => {
            if (typeof item === 'object') {
              return { mapValue: jsToFirestore(item) };
            }
            return { stringValue: String(item) };
          })
        }
      };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: jsToFirestore(value) };
    }
  }
  return { fields };
}

function firestoreToJs(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [key, valObj] of Object.entries(fields)) {
    if (valObj.hasOwnProperty('stringValue')) {
      obj[key] = valObj.stringValue;
    } else if (valObj.hasOwnProperty('booleanValue')) {
      obj[key] = valObj.booleanValue;
    } else if (valObj.hasOwnProperty('integerValue')) {
      obj[key] = parseInt(valObj.integerValue, 10);
    } else if (valObj.hasOwnProperty('doubleValue')) {
      obj[key] = parseFloat(valObj.doubleValue);
    } else if (valObj.hasOwnProperty('timestampValue')) {
      obj[key] = new Date(valObj.timestampValue);
    } else if (valObj.hasOwnProperty('arrayValue')) {
      const values = valObj.arrayValue.values || [];
      obj[key] = values.map(v => {
        if (v.hasOwnProperty('mapValue')) {
          return firestoreToJs(v.mapValue.fields);
        }
        return v.stringValue || v.integerValue || v.doubleValue || v.booleanValue;
      });
    } else if (valObj.hasOwnProperty('mapValue')) {
      obj[key] = firestoreToJs(valObj.mapValue.fields);
    } else if (valObj.hasOwnProperty('nullValue')) {
      obj[key] = null;
    }
  }
  return obj;
}

async function getFirestoreDoc(collection, docId) {
  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}/${collection}/${docId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.fields) {
      return firestoreToJs(data.fields);
    }
  } catch (e) {
    console.error("Firestore get doc failed:", e);
  }
  return null;
}

async function setFirestoreDoc(collection, docId, jsObj) {
  try {
    const firestoreData = jsToFirestore(jsObj);
    const res = await fetch(`${FIRESTORE_BASE_URL}/${collection}/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(firestoreData)
    });
    return res.ok;
  } catch (e) {
    console.error("Firestore set doc failed:", e);
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(455).json({ success: false, message: "Method Not Allowed" });
  }

  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ success: false, message: "Missing x-user-id header" });
  }

  const userRecord = await getFirestoreDoc('users', userId);
  if (!userRecord) {
    return res.status(401).json({ success: false, message: "Unauthorized: User not registered" });
  }

  const { subjectName, sectionName, questionType, count, marksPerQuestion, topicsList, customDifficulty } = req.body;
  if (!subjectName || !sectionName || !questionType || !count || !marksPerQuestion) {
    return res.status(400).json({ success: false, message: "Missing required parameters" });
  }

  const cacheKey = `exam_${subjectName.replace(/\s+/g, '_')}_${sectionName.replace(/\s+/g, '_')}_${questionType}_${count}_${marksPerQuestion}`;

  // 1. Check Cache
  const cached = await getFirestoreDoc('ai_cache', cacheKey);
  if (cached && cached.result) {
    return res.status(200).json({ success: true, cached: true, data: cached.result });
  }

  // 2. Check limits (Mock Exams: 5/day)
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const usageId = `${userId}_mock_exams_${dateStr}`;

  const usageRecord = await getFirestoreDoc('ai_usage', usageId);
  const countUsage = usageRecord ? usageRecord.requestCount || 0 : 0;
  if (countUsage >= 5) {
    return res.status(429).json({ success: false, message: "You have reached today's beta limit." });
  }

  // 3. Call Gemini (Max 20s)
  const startTime = Date.now();
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const topicsText = topicsList && topicsList.length > 0
    ? topicsList.map(t => typeof t === 'string' ? t : t.title).join(", ")
    : "General core principles";

  const prompt = `Act as an academic university examiner for the subject "${subjectName}".
  Generate EXACTLY ${count} questions for "${sectionName}".
  
  Topic Outline: ${topicsText}
  Difficulty: ${customDifficulty || "Mixed"}
  
  CRITICAL REQUIREMENTS:
  1. Every question must be worth EXACTLY ${marksPerQuestion} marks.
  2. Return ONLY a valid JSON array matching this exact schema:
  ${questionType === 'mcq' ? `
  [
    {
      "type": "mcq",
      "question": "A clear MCQ question?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "answer": "Option 1",
      "marks": 1,
      "explanation": "Brief explanation."
    }
  ]
  ` : `
  [
    {
      "type": "theory",
      "question": "Explain...",
      "model_answer": "Detailed answer covering expected points.",
      "marks": ${marksPerQuestion}
    }
  ]
  `}
  `;

  try {
    const fetchPromise = fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request Timeout")), 20000)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    if (!response.ok) {
      throw new Error(`Gemini status code ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    
    if (Array.isArray(parsed)) {
      const sliced = parsed.slice(0, count);
      // Save Cache
      await setFirestoreDoc('ai_cache', cacheKey, { result: sliced });

      // Save Usage
      await setFirestoreDoc('ai_usage', usageId, {
        userId,
        requestType: "mock_exams",
        requestCount: countUsage + 1,
        date: dateStr,
        createdAt: new Date()
      });

      // Log stats
      const responseTime = Date.now() - startTime;
      const tokens = data.usageMetadata?.totalTokens || 920;
      const logId = `${userId}_mock_exams_${Date.now()}`;
      await setFirestoreDoc('ai_logs', logId, {
        userId,
        requestType: "mock_exams",
        tokens,
        responseTime,
        timestamp: new Date()
      });

      return res.status(200).json({ success: true, cached: false, data: sliced });
    }
    throw new Error("Invalid structure returned by AI");
  } catch (err) {
    console.error("Server API generate-exam failed:", err);
    // Offline Backup fallback questions to prevent crash
    const fallbackList = [];
    for (let i = 1; i <= count; i++) {
      if (questionType === 'mcq') {
        fallbackList.push({
          type: "mcq",
          question: `Regarding ${subjectName}, identify the correct concept concerning question ${i}?`,
          options: ["Core framework design mapping", "Optional secondary layout", "Standard local caching rule", "Legacy parameters"],
          answer: "Core framework design mapping",
          marks: 1,
          explanation: "Fundamental mapping structures outline key operations."
        });
      } else {
        fallbackList.push({
          type: "theory",
          question: `State the system integration guidelines, bottlenecks, and performance challenges of ${subjectName} Section ${i}?`,
          model_answer: "This section explores resource constraints, modular boundary definitions, and state persistence rules.",
          marks: marksPerQuestion
        });
      }
    }
    return res.status(200).json({ success: false, message: "AI service temporarily unavailable", data: fallbackList });
  }
}
