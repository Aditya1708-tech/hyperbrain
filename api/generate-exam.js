import aiService from "../src/services/aiService.js";

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
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const userId = req.headers['x-user-id'] || 'anonymous';
    const { subjectName, sectionName, questionType, count, marksPerQuestion, topicsList, customDifficulty } = req.body;

    if (!subjectName || !sectionName || !questionType) {
      return res.status(400).json({
        success: false,
        message: "Missing parameter details"
      });
    }

    const tString = topicsList && topicsList.length > 0
      ? topicsList.map(t => typeof t === 'string' ? t : t.title).join("_")
      : "General";
    const cacheKey = `exam_${subjectName.replace(/\s+/g, '_')}_${sectionName.replace(/\s+/g, '_')}_${questionType}_${tString.replace(/\s+/g, '_').substring(0, 50)}`;

    // 1. Check Cache
    const cached = await getFirestoreDoc('ai_cache', cacheKey);
    if (cached && cached.result) {
      return res.status(200).json({ success: true, cached: true, data: cached.result });
    }

    // 2. Validate usage limits (Exams: 5/day)
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const usageId = `${userId}_mock_exams_${dateStr}`;

    const usageRecord = await getFirestoreDoc('ai_usage', usageId);
    const countUsage = usageRecord ? usageRecord.requestCount || 0 : 0;
    if (countUsage >= 5) {
      return res.status(429).json({ success: false, message: "You have reached today's beta limit." });
    }

    // 3. Call AI Service
    const startTime = Date.now();
    const result = await aiService.generateMockExam(subjectName, sectionName, questionType, count, marksPerQuestion, topicsList, customDifficulty);
    const parsedResult = result.parsed;

    if (!parsedResult || parsedResult.length === 0) {
      throw new Error("AI generation failed. Check console logs.");
    }

    const sliced = parsedResult.slice(0, count);

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
    const tokens = result.totalTokens || 920;
    const logId = `${userId}_mock_exams_${Date.now()}`;
    await setFirestoreDoc('ai_logs', logId, {
      userId,
      requestType: "mock_exams",
      tokens,
      responseTime,
      timestamp: new Date()
    });

    return res.status(200).json({
      success: true,
      data: sliced
    });
  } catch (error) {
    console.error("Generate exam API error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
