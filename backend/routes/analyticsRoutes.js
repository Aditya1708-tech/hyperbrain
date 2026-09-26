import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/analytics/event
router.post('/event', verifyAuth, async (req, res) => {
  try {
    const { type, metadata, userName } = req.body;
    const userId = req.user?.uid || req.body.userId || 'anonymous';

    const log = new ActivityLog({
      type: type || 'custom_event',
      userId,
      userName: userName || req.user?.email || 'Anonymous Student',
      metadata: metadata || {}
    });

    await log.save();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/analytics/events
router.get('/events', verifyAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const events = await ActivityLog.find().sort({ timestamp: -1 }).limit(limit);
    return res.json({ success: true, events });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
