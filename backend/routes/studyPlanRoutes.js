import express from 'express';
import StudyPlan from '../models/StudyPlan.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/study-plans
router.get('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    const plans = await StudyPlan.find({ userId }).sort({ createdAt: -1 });
    return res.json({ success: true, plans });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/study-plans
router.post('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.body.userId;
    const { courseName, targetExamDate, dailyHours, weeks } = req.body;

    const plan = new StudyPlan({
      userId,
      courseName,
      targetExamDate,
      dailyHours,
      weeks: weeks || []
    });

    await plan.save();
    return res.status(201).json({ success: true, plan });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/study-plans/:id
router.put('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const plan = await StudyPlan.findByIdAndUpdate(id, updates, { new: true });
    return res.json({ success: true, plan });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
