import mongoose from 'mongoose';

const FlashcardSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  courseId: { type: String, index: true },
  topicTitle: { type: String, required: true },
  subjectName: { type: String, default: '' },
  front: { type: String, required: true },
  back: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  state: { type: String, enum: ['new', 'learning', 'mastered'], default: 'new' },
  repetitionCount: { type: Number, default: 0 },
  lastReviewed: { type: Date }
}, { timestamps: true });

export const Flashcard = mongoose.models.Flashcard || mongoose.model('Flashcard', FlashcardSchema);
export default Flashcard;
