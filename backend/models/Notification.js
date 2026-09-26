import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  isAdmin: { type: Boolean, default: false, index: true },
  title: { type: String, required: true },
  desc: { type: String, required: true },
  type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  emoji: { type: String, default: 'ℹ️' },
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
export default Notification;
