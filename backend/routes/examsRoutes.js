import express from 'express';
import MockExam from '../models/Exam.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/exams
router.get('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    const exams = await MockExam.find({ userId }).sort({ createdAt: -1 });
    return res.json({ success: true, exams });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/exams/:id
router.get('/:id', verifyAuth, async (req, res) => {
  try {
    const exam = await MockExam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    return res.json({ success: true, exam });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/exams (save generated or draft exam)
router.post('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.body.userId;
    const { subjectName, topic, difficulty, durationMinutes, totalMarks, questions } = req.body;

    const exam = new MockExam({
      userId,
      subjectName,
      topic: topic || 'Comprehensive',
      difficulty: difficulty || 'Medium',
      durationMinutes: durationMinutes || 30,
      totalMarks: totalMarks || 20,
      questions: questions || []
    });

    await exam.save();
    return res.status(201).json({ success: true, exam });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/exams/:id/submit (submit student answers and auto-grade)
router.post('/:id/submit', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { userAnswers } = req.body;

    const exam = await MockExam.findById(id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    let calculatedScore = 0;
    for (const q of exam.questions) {
      const studentAns = userAnswers[q.id || q._id?.toString()];
      if (studentAns && q.correctAnswer && studentAns.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase()) {
        calculatedScore += q.marks || 1;
      }
    }

    exam.userAnswers = userAnswers;
    exam.scoreObtained = calculatedScore;
    exam.status = 'completed';
    exam.completedAt = new Date();
    await exam.save();

    return res.json({
      success: true,
      scoreObtained: calculatedScore,
      totalMarks: exam.totalMarks,
      exam
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
