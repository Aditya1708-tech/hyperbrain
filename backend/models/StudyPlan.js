import mongoose from 'mongoose';

const StudyPlanSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  courseName: { type: String, required: true },
  targetExamDate: { type: Date },
  dailyHours: { type: Number, default: 2 },
  weeks: [{
    weekNumber: Number,
    focus: String,
    tasks: [{
      title: String,
      estimatedMinutes: Number,
      completed: { type: Boolean, default: false },
      date: String
    }]
  }],
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  progress: { type: Number, default: 0 }
}, { timestamps: true });

export const StudyPlan = mongoose.models.StudyPlan || mongoose.model('StudyPlan', StudyPlanSchema);
export default StudyPlan;
