const apiKey = (typeof process !== 'undefined' && process.env ? process.env.VITE_GROQ_API_KEY : undefined) || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GROQ_API_KEY : undefined);

export const AI_CONFIG = {
  apiKey: apiKey,
  model: "llama-3.3-70b-versatile"
};
