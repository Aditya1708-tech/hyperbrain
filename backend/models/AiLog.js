import mongoose from 'mongoose';

// Track daily AI usage quotas per user per task
const AiUsageSchema = new mongoose.Schema({
  docId: { type: String, unique: true, index: true }, // e.g. userId_requestType_dateStr
  userId: { type: String, required: true, index: true },
  requestType: { type: String, required: true },
  requestCount: { type: Number, default: 0 },
  date: { type: String, required: true, index: true }
}, { timestamps: true });

// Cache AI answers to avoid redundant Gemini tokens
const AiCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true, index: true },
  prompt: { type: String, required: true },
  response: { type: String, required: true },
  model: { type: String, default: 'gemini-3.6-flash' },
  tokensUsed: { type: Number, default: 0 }
}, { timestamps: true });

// Telemetry logs for AI latency, error rate, model performance
const AiTelemetryLogSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  taskType: { type: String, required: true },
  prompt: { type: String },
  model: { type: String, default: 'gemini-3.6-flash' },
  latencyMs: { type: Number, default: 0 },
  tokensUsed: { type: Number, default: 0 },
  success: { type: Boolean, default: true },
  error: { type: String, default: '' }
}, { timestamps: true });

export const AiUsage = mongoose.models.AiUsage || mongoose.model('AiUsage', AiUsageSchema);
export const AiCache = mongoose.models.AiCache || mongoose.model('AiCache', AiCacheSchema);
export const AiTelemetryLog = mongoose.models.AiTelemetryLog || mongoose.model('AiTelemetryLog', AiTelemetryLogSchema);
