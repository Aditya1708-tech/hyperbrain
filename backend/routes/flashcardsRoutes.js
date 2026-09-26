import express from 'express';
import Flashcard from '../models/Flashcard.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/flashcards
router.get('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    const { topicTitle, subjectName } = req.query;

    const query = { userId };
    if (topicTitle) query.topicTitle = topicTitle;
    if (subjectName) query.subjectName = subjectName;

    const flashcards = await Flashcard.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, flashcards });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/flashcards (bulk create or single)
router.post('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.body.userId;
    const { cards, topicTitle, subjectName } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    if (Array.isArray(cards) && cards.length > 0) {
      const docs = cards.map(c => ({
        userId,
        topicTitle: topicTitle || c.topicTitle || 'General',
        subjectName: subjectName || c.subjectName || '',
        front: c.front,
        back: c.back,
        difficulty: c.difficulty || 'Medium',
        state: 'new'
      }));
      const created = await Flashcard.insertMany(docs);
      return res.status(201).json({ success: true, flashcards: created });
    } else {
      const { front, back, difficulty } = req.body;
      const flashcard = new Flashcard({
        userId,
        topicTitle: topicTitle || 'General',
        subjectName: subjectName || '',
        front,
        back,
        difficulty: difficulty || 'Medium'
      });
      await flashcard.save();
      return res.status(201).json({ success: true, flashcard });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/flashcards/:id (update review state)
router.put('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { state, repetitionCount } = req.body;

    const card = await Flashcard.findByIdAndUpdate(
      id,
      {
        state,
        $inc: { repetitionCount: repetitionCount !== undefined ? repetitionCount : 1 },
        lastReviewed: new Date()
      },
      { new: true }
    );

    return res.json({ success: true, flashcard: card });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/flashcards/:id
router.delete('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await Flashcard.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Flashcard deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
