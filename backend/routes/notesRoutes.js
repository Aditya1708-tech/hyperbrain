import express from 'express';
import Note from '../models/Note.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notes
router.get('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    const { subjectName, courseId } = req.query;

    const query = { userId };
    if (subjectName) query.subjectName = subjectName;
    if (courseId) query.courseId = courseId;

    const notes = await Note.find(query).sort({ updatedAt: -1 });
    return res.json({ success: true, notes });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/notes
router.post('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.body.userId;
    const { subjectName, topicTitle, content, summary, courseId, keyTakeaways, tags } = req.body;

    if (!userId || !subjectName || !topicTitle || !content) {
      return res.status(400).json({ success: false, message: 'Missing required note parameters' });
    }

    const note = await Note.findOneAndUpdate(
      { userId, subjectName, topicTitle },
      {
        content,
        summary: summary || '',
        courseId: courseId || '',
        keyTakeaways: keyTakeaways || [],
        tags: tags || [],
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({ success: true, note });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await Note.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
