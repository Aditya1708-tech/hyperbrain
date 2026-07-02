import { AI_CONFIG } from "../src/config/aiConfig.js";
import Groq from "groq-sdk";
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
    const text = await res.text();
    if (!text) {
      throw new Error("Empty response from server");
    }
    const data = JSON.parse(text);
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

// Centralized config used via aiService

export default async function handler(req, res) {
  console.log("REQUEST BODY:", req.body);
  console.log("ENV:", {
    hasGroq: !!AI_CONFIG.apiKey
  });

  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const userId = req.headers['x-user-id'] || 'anonymous';
    const { topic, course, topicName, subjectName } = req.body;
    
    const finalTopic = topicName || topic;
    const finalCourse = subjectName || course;

    if (!finalTopic || !finalCourse) {
      return res.status(400).json({
        success: false,
        message: "Missing topic or course parameter"
      });
    }

    const cacheKey = `notes_${finalCourse.replace(/\s+/g, '_')}_${finalTopic.replace(/\s+/g, '_')}`;

    // 1. Check Cache
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

    // 3. Verify Groq initialization:
    const API_KEY = process.env.VITE_GROQ_API_KEY || AI_CONFIG.apiKey;
    if (!API_KEY) {
      throw new Error("Groq API key missing in server environment");
    }

    const groq = new Groq({
      apiKey: API_KEY
    });

    const prompt = `Create comprehensive study content for the topic "${finalTopic}" in the course "${finalCourse}". 
    REQUIRED STRUCTURE:
    1. "summary": Provide a detailed explanation (approx 400 words).
    2. "flashcards": Create 5-8 key concept cards.
    3. "quiz": You MUST generate AT LEAST 10 distinct Multiple Choice Questions (MCQs).
    4. "exam_questions": List 5-7 high-probability theory questions.
    Return strictly valid JSON: 
    {"summary": "...", "flashcards": [{"front": "Q", "back": "A"}], "quiz": [{"question": "Q?", "options": ["A","B","C","D"], "answer": "A", "explanation": "Why?"}], "exam_questions": ["Q1"]}`;

    console.log("Starting generateNotes");
    console.log("Topic:", finalTopic);
    console.log("Course:", finalCourse);
    console.log("Prompt:", prompt);

    // 4. Wrap Groq call:
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 2000
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        throw new Error("Empty response from Groq");
      }

      console.log("Generated text:", text);
      console.log("AI generation success");

      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedResult = JSON.parse(cleanJson);

      // Save to Cache
      await setFirestoreDoc('ai_cache', cacheKey, { result: parsedResult });

      // Increment Usage
      await setFirestoreDoc('ai_usage', usageId, {
        userId,
        requestType: "notes",
        requestCount: count + 1,
        date: dateStr,
        createdAt: new Date()
      });

      return res.status(200).json({
        success: true,
        data: text
      });
    } catch (error) {
      console.error("Groq full error:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
        stack: error.stack
      });
    }
  } catch (error) {
    console.error("Generate notes API error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
