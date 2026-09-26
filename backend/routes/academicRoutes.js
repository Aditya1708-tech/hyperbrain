import express from 'express';
import { Program, Subject, Topic, CourseWorkspace } from '../models/Academic.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/academic/programs
router.get('/programs', async (req, res) => {
  try {
    const programs = await Program.find({ status: 'published' }).sort({ displayName: 1 });
    return res.json({ success: true, programs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/academic/subjects/:programId
router.get('/subjects/:programId', async (req, res) => {
  try {
    const { programId } = req.params;
    const subjects = await Subject.find({ programId }).sort({ semesterNumber: 1, displayName: 1 });
    return res.json({ success: true, subjects });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/academic/topics/:subjectId
router.get('/topics/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const topics = await Topic.find({ subjectId }).sort({ unitNumber: 1, chapterNumber: 1 });
    return res.json({ success: true, topics });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/academic/workspaces
router.get('/workspaces', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const workspaces = await CourseWorkspace.find({ userId, isArchived: false }).sort({ updatedAt: -1 });
    return res.json({ success: true, workspaces });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/academic/workspaces
router.post('/workspaces', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.body.userId;
    const { subject_name, program, chapters, notes, files } = req.body;

    if (!userId || !subject_name) {
      return res.status(400).json({ success: false, message: 'User ID and subject_name are required' });
    }

    const workspace = new CourseWorkspace({
      userId,
      subject_name,
      program: program || '',
      chapters: chapters || [],
      notes: notes || '',
      files: files || []
    });

    await workspace.save();
    return res.status(201).json({ success: true, workspace });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/academic/workspaces/:id
router.put('/workspaces/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const workspace = await CourseWorkspace.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    );

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    return res.json({ success: true, workspace });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/academic/workspaces/:id
router.delete('/workspaces/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await CourseWorkspace.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Workspace deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
