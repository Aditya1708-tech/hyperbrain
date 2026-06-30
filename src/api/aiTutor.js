import aiService from "@/services/aiService";
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

  const { userQuestion } = req.body;
  if (!userQuestion) {
    return res.status(400).json({ success: false, message: "Missing userQuestion parameter" });
  }

  // 1. Check limits (AI Tutor: 50 messages/day)
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const usageId = `${userId}_ai_tutor_${dateStr}`;

  const usageRecord = await getFirestoreDoc('ai_usage', usageId);
  const countUsage = usageRecord ? usageRecord.requestCount || 0 : 0;
  if (countUsage >= 50) {
    return res.status(429).json({ success: false, message: "You have reached today's beta limit." });
  }

  // 2. Call Gemini via aiService
  const startTime = Date.now();
  try {
    const textResult = await aiService.generateTutorResponse(userQuestion);

    // Save usage count
    await setFirestoreDoc('ai_usage', usageId, {
      userId,
      requestType: "ai_tutor",
      requestCount: countUsage + 1,
      date: dateStr,
      createdAt: new Date()
    });

    // Log stats
    const responseTime = Date.now() - startTime;
    const tokens = 120;
    const logId = `${userId}_ai_tutor_${Date.now()}`;
    await setFirestoreDoc('ai_logs', logId, {
      userId,
      requestType: "ai_tutor",
      tokens,
      responseTime,
      timestamp: new Date()
    });

    return res.status(200).json({ success: true, data: textResult });
  } catch (err) {
    console.error("Server API ai-tutor failed:", err);
    return res.status(200).json({ success: false, message: "AI service temporarily unavailable" });
  }
}
