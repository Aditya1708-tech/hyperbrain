import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  userId: { type: String, default: 'anonymous', index: true },
  userName: { type: String, default: 'Anonymous' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
export default ActivityLog;
