import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
  id: { type: String },
  type: { type: String, enum: ['mcq', 'short_answer', 'essay'], default: 'mcq' },
  question: { type: String, required: true },
  options: [{ type: String }],
  correctAnswer: { type: String },
  explanation: { type: String, default: '' },
  marks: { type: Number, default: 1 }
});

const MockExamSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  subjectName: { type: String, required: true },
  topic: { type: String, default: 'Comprehensive' },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  durationMinutes: { type: Number, default: 30 },
  totalMarks: { type: Number, default: 20 },
  questions: [QuestionSchema],
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  userAnswers: { type: mongoose.Schema.Types.Mixed, default: {} },
  scoreObtained: { type: Number, default: 0 },
  feedback: { type: String, default: '' },
  completedAt: { type: Date }
}, { timestamps: true });

export const MockExam = mongoose.models.MockExam || mongoose.model('MockExam', MockExamSchema);
export default MockExam;
