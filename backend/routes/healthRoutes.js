import express from 'express';
import { getDBStatus } from '../config/db.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { LATEST_GEMINI_MODELS } from '../services/geminiService.js';

const router = express.Router();

// GET /api/health
router.get('/', async (req, res) => {
  const dbStatus = getDBStatus();
  
  let userCount = 0;
  try {
    if (dbStatus.isConnected) {
      userCount = await User.countDocuments();
    }
  } catch (e) {
    // Non-blocking
  }

  return res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      type: 'MongoDB',
      ...dbStatus
    },
    ai: {
      provider: 'Google Gemini',
      latestModels: LATEST_GEMINI_MODELS,
      defaultModel: LATEST_GEMINI_MODELS[0],
      isConfigured: !!(process.env.GEMINI_KEY_1 || process.env.GEMINI_KEY_2 || process.env.GEMINI_API_KEY)
    },
    metrics: {
      totalUsers: userCount
    }
  });
});

export default router;
