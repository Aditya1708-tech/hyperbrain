const FIREBASE_PROJECT_ID = "campus-hyper-brain";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Convert plain JS object to Firestore document format
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

// Convert Firestore document format to plain JS object
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

// Read document
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

// Write document
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

  // Validate user exists in Firestore
  const userRecord = await getFirestoreDoc('users', userId);
  if (!userRecord) {
    return res.status(401).json({ success: false, message: "Unauthorized: User not registered" });
  }

  const { subjectName, topicName } = req.body;
  if (!subjectName || !topicName) {
    return res.status(400).json({ success: false, message: "Missing subjectName or topicName parameters" });
  }

  const cacheKey = `notes_${subjectName.replace(/\s+/g, '_')}_${topicName.replace(/\s+/g, '_')}`;

  // 1. Check cache first
  const cached = await getFirestoreDoc('ai_cache', cacheKey);
  if (cached && cached.result) {
    return res.status(200).json({ success: true, cached: true, data: cached.result });
  }

  // 2. Validate usage limits (Notes: 10/day)
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const usageId = `${userId}_notes_${dateStr}`;

  const usageRecord = await getFirestoreDoc('ai_usage', usageId);
  const count = usageRecord ? usageRecord.requestCount || 0 : 0;
  if (count >= 10) {
    return res.status(429).json({ success: false, message: "You have reached today's beta limit." });
  }

  // 3. Call Gemini with timeout protection (Max: 20s)
  const startTime = Date.now();
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `Create comprehensive study content for the topic "${topicName}" in the course "${subjectName}". 
      
  REQUIRED STRUCTURE:
  1. "summary": Provide a detailed explanation (approx 400 words).
  2. "flashcards": Create 5-8 key concept cards.
  3. "quiz": You MUST generate AT LEAST 10 distinct Multiple Choice Questions (MCQs).
  4. "exam_questions": List 5-7 high-probability theory questions.

  Return strictly valid JSON: 
  {"summary": "...", "flashcards": [{"front": "Q", "back": "A"}], "quiz": [{"question": "Q?", "options": ["A","B","C","D"], "answer": "A", "explanation": "Why?"}], "exam_questions": ["Q1"]}`;

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
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedResult = JSON.parse(cleanJson);

    // Save to Firestore Cache
    await setFirestoreDoc('ai_cache', cacheKey, { result: parsedResult });

    // Update / increment daily usage limit
    await setFirestoreDoc('ai_usage', usageId, {
      userId,
      requestType: "notes",
      requestCount: count + 1,
      date: dateStr,
      createdAt: new Date()
    });

    // Log tracking stats
    const responseTime = Date.now() - startTime;
    const tokens = data.usageMetadata?.totalTokens || 850;
    const logId = `${userId}_notes_${Date.now()}`;
    await setFirestoreDoc('ai_logs', logId, {
      userId,
      requestType: "notes",
      tokens,
      responseTime,
      timestamp: new Date()
    });

    return res.status(200).json({ success: true, cached: false, data: parsedResult });
  } catch (err) {
    console.error("Server API Notes generation failed:", err);
    return res.status(500).json({
      success: false,
      message: "AI generation failed. Check console logs."
    });
  }
}
