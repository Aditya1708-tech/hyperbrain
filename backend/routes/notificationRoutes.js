import express from 'express';
import Notification from '../models/Notification.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notifications
router.get('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    const isAdmin = req.query.isAdmin === 'true';

    let query = {};
    if (isAdmin) {
      query = { isAdmin: true };
    } else if (userId) {
      query = { $or: [{ userId }, { isAdmin: false, userId: null }] };
    }

    const notifications = await Notification.find(query).sort({ timestamp: -1 }).limit(50);
    return res.json({ success: true, notifications });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/notifications
router.post('/', verifyAuth, async (req, res) => {
  try {
    const { userId, title, desc, type, emoji, isAdmin } = req.body;
    const notif = new Notification({
      userId: userId || null,
      isAdmin: !!isAdmin,
      title,
      desc,
      type: type || 'info',
      emoji: emoji || 'ℹ️'
    });
    await notif.save();
    return res.status(201).json({ success: true, notification: notif });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { read: true });
    return res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
