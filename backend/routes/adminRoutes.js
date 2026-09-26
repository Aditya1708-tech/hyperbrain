import express from 'express';
import User from '../models/User.js';
import { Invoice, Subscription, Coupon } from '../models/Billing.js';
import ActivityLog from '../models/ActivityLog.js';
import { AiTelemetryLog } from '../models/AiLog.js';
import { verifyAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/admin/overview
router.get('/overview', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isOnline: true });
    const proUsers = await User.countDocuments({ isPro: true });
    const paidInvoices = await Invoice.find({ status: 'paid' });
    const totalRevenue = paidInvoices.reduce((acc, curr) => acc + (curr.finalAmount || 0), 0);

    const recentLogs = await ActivityLog.find().sort({ timestamp: -1 }).limit(20);
    const aiLogs = await AiTelemetryLog.find().sort({ createdAt: -1 }).limit(20);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        proUsers,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        invoicesCount: paidInvoices.length
      },
      recentLogs,
      aiLogs
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/users
router.get('/users', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/user/:userId/role
router.post('/user/:userId/role', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, isPro, status } = req.body;

    const updates = {};
    if (role) updates.role = role;
    if (isPro !== undefined) updates.isPro = isPro;
    if (status) updates.status = status;

    const user = await User.findOneAndUpdate(
      { $or: [{ uid: userId }, { _id: userId.match(/^[0-9a-fA-F]{24}$/) ? userId : null }] },
      updates,
      { new: true }
    );

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
