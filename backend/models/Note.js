import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  courseId: { type: String, index: true },
  subjectName: { type: String, required: true },
  topicTitle: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String, default: '' },
  keyTakeaways: [{ type: String }],
  isAiGenerated: { type: Boolean, default: true },
  tags: [{ type: String }]
}, { timestamps: true });

export const Note = mongoose.models.Note || mongoose.model('Note', NoteSchema);
export default Note;
