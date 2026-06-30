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

  const { subjectName, topicName } = req.body;
  if (!subjectName || !topicName) {
    return res.status(400).json({ success: false, message: "Missing subjectName or topicName" });
  }

  const cacheKey = `flashcards_${subjectName.replace(/\s+/g, '_')}_${topicName.replace(/\s+/g, '_')}`;

  // 1. Check cache first
  const cached = await getFirestoreDoc('ai_cache', cacheKey);
  if (cached && cached.result) {
    return res.status(200).json({ success: true, cached: true, data: cached.result });
  }

  // 2. Check limits (Flashcards: 10/day)
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const usageId = `${userId}_flashcards_${dateStr}`;

  const usageRecord = await getFirestoreDoc('ai_usage', usageId);
  const countUsage = usageRecord ? usageRecord.requestCount || 0 : 0;
  if (countUsage >= 10) {
    return res.status(429).json({ success: false, message: "You have reached today's beta limit." });
  }

  // 3. Call Gemini (Max 20s)
  const startTime = Date.now();
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCWP8hv7qD7xmO2ko-5imGigY8GpQTMVpw";
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `Create 5 high-quality conceptual flashcards for the topic "${topicName}" in "${subjectName}". 
  Return strictly a valid JSON array matching this exact schema:
  [{"front": "Question?", "back": "Detailed answer explanation."}]`;

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

    // Save cache
    await setFirestoreDoc('ai_cache', cacheKey, { result: parsed });

    // Save usage count
    await setFirestoreDoc('ai_usage', usageId, {
      userId,
      requestType: "flashcards",
      requestCount: countUsage + 1,
      date: dateStr,
      createdAt: new Date()
    });

    // Log stats
    const responseTime = Date.now() - startTime;
    const tokens = data.usageMetadata?.totalTokens || 480;
    const logId = `${userId}_flashcards_${Date.now()}`;
    await setFirestoreDoc('ai_logs', logId, {
      userId,
      requestType: "flashcards",
      tokens,
      responseTime,
      timestamp: new Date()
    });

    return res.status(200).json({ success: true, cached: false, data: parsed });
  } catch (err) {
    console.error("Server API generate-flashcards failed:", err);
    const fallbackList = [
      { front: `What is the core objective of ${topicName}?`, back: `Understanding the design constraints of ${subjectName}.` },
      { front: `Detail one design trade-off.`, back: `Balancing local latency offsets with backend API quotas.` }
    ];
    return res.status(200).json({ success: false, message: "AI service temporarily unavailable", data: fallbackList });
  }
}
