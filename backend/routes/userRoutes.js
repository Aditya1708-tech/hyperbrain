import express from 'express';
import User from '../models/User.js';
import { AiUsage } from '../models/AiLog.js';
import { verifyAuth, requireAuth } from '../middleware/auth.js';

const router = express.Router();

const BETA_LIMITS = {
  chat: 50,
  notes: 20,
  flashcards: 30,
  exams: 15,
  study_plan: 10
};

// GET /api/users/profile/:userId
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({
      $or: [{ uid: userId }, { _id: userId.match(/^[0-9a-fA-F]{24}$/) ? userId : null }]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      profile: {
        uid: user.uid,
        name: user.name,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        isPro: user.isPro,
        status: user.status,
        preferences: user.preferences,
        studyStats: user.studyStats,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/users/profile
router.put('/profile', verifyAuth, requireAuth, async (req, res) => {
  try {
    const { name, displayName, preferences, studyStats } = req.body;
    const user = await User.findOne({
      $or: [{ uid: req.user.uid }, { _id: req.user.id }]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (displayName) user.displayName = displayName;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    if (studyStats) user.studyStats = { ...user.studyStats, ...studyStats };

    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated',
      user: {
        uid: user.uid,
        name: user.name,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
        studyStats: user.studyStats
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/users/status (update online status)
router.post('/status', verifyAuth, async (req, res) => {
  try {
    const { userId, isOnline } = req.body;
    const targetId = userId || req.user?.uid;
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    await User.updateOne(
      { $or: [{ uid: targetId }, { _id: targetId.match(/^[0-9a-fA-F]{24}$/) ? targetId : null }] },
      { isOnline: !!isOnline, lastActive: new Date() }
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/users/limit/:userId/:requestType
router.get('/limit/:userId/:requestType', async (req, res) => {
  try {
    const { userId, requestType } = req.params;
    const limit = BETA_LIMITS[requestType] || 100;
    const today = new Date().toISOString().split('T')[0];
    const docId = `${userId}_${requestType}_${today}`;

    const usage = await AiUsage.findOne({ docId });
    const current = usage ? usage.requestCount : 0;

    return res.json({
      success: true,
      allowed: current < limit,
      current,
      limit
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/users/increment-usage
router.post('/increment-usage', async (req, res) => {
  try {
    const { userId, requestType } = req.body;
    if (!userId || !requestType) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const today = new Date().toISOString().split('T')[0];
    const docId = `${userId}_${requestType}_${today}`;

    await AiUsage.findOneAndUpdate(
      { docId },
      {
        $inc: { requestCount: 1 },
        $setOnInsert: { userId, requestType, date: today }
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
