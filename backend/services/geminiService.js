import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const getKeys = () => {
  const keys = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_API_KEY
  ].filter(k => k && k.trim() && !k.includes('ADD_GEMINI') && !k.includes('your_key'));

  return Array.from(new Set(keys));
};

let currentKeyIndex = 0;

export const getNextApiKey = () => {
  const keys = getKeys();
  if (keys.length === 0) {
    return null;
  }
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
};

// Preferred model hierarchy: Gemini 3.6 Flash -> Gemini 3.6 -> Gemini 3.5 Flash -> Gemini 2.5 Flash -> Gemini 2.0 Flash
export const LATEST_GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.6',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash'
];

/**
 * Generate AI content using latest Google GenAI SDK (Gemini 3.6)
 */
export async function generateContent({ prompt, systemInstruction, modelName = 'gemini-3.6-flash', temperature = 0.7, maxOutputTokens = 4096 }) {
  const keys = getKeys();
  if (keys.length === 0) {
    throw new Error('No valid Gemini API keys found. Please set GEMINI_KEY_1 or GEMINI_API_KEY in .env');
  }

  let lastError = null;

  // Try across keys and models
  for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt++) {
    const key = keys[(currentKeyIndex + keyAttempt) % keys.length];
    
    for (const model of [modelName, ...LATEST_GEMINI_MODELS.filter(m => m !== modelName)]) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });

        const contents = [];
        if (typeof prompt === 'string') {
          contents.push({ role: 'user', parts: [{ text: prompt }] });
        } else if (Array.isArray(prompt)) {
          // Format messages
          for (const msg of prompt) {
            contents.push({
              role: msg.role === 'assistant' ? 'model' : msg.role === 'system' ? 'user' : msg.role,
              parts: [{ text: msg.content || msg.text || '' }]
            });
          }
        }

        const config = {
          temperature,
          maxOutputTokens
        };

        if (systemInstruction) {
          config.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        const response = await ai.models.generateContent({
          model,
          contents,
          config
        });

        const text = response.text || '';
        return {
          text,
          model,
          success: true
        };
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini SDK] Attempt with model ${model} failed: ${err.message}. Trying next...`);
        // If error is model not found or quota, keep trying next model/key
      }
    }
  }

  // Fallback direct REST endpoint if SDK client encounters environment discrepancy
  try {
    const fallbackKey = keys[0];
    const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${fallbackKey}`;
    const restRes = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: typeof prompt === 'string' ? prompt : JSON.stringify(prompt) }] }]
      })
    });

    if (restRes.ok) {
      const data = await restRes.json();
      const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        text: outputText,
        model: 'gemini-3.6-flash (REST)',
        success: true
      };
    }
  } catch (restErr) {
    console.error('[Gemini REST Fallback] Failed:', restErr.message);
  }

  throw new Error(`All Gemini generation attempts failed: ${lastError?.message || 'Unknown error'}`);
}

export default {
  generateContent,
  getNextApiKey,
  LATEST_GEMINI_MODELS
};
