import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  uid: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    minlength: 6
  },
  name: {
    type: String,
    default: 'Student'
  },
  displayName: {
    type: String,
    default: 'Student'
  },
  photoURL: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['Student', 'Administrator', 'Admin', 'Tutor'],
    default: 'Student'
  },
  isPro: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned'],
    default: 'active'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  preferences: {
    theme: { type: String, default: 'dark' },
    notifications: { type: Boolean, default: true },
    studyReminders: { type: Boolean, default: true },
    academicLevel: { type: String, default: 'Undergraduate' },
    preferredAiTone: { type: String, default: 'Socratic & Concise' }
  },
  studyStats: {
    totalMinutesStudied: { type: Number, default: 0 },
    flashcardsReviewed: { type: Number, default: 0 },
    mockExamsCompleted: { type: Number, default: 0 },
    streakDays: { type: Number, default: 1 }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Auto-assign uid if not provided
UserSchema.pre('save', async function () {
  if (!this.uid) {
    this.uid = this._id.toString();
  }
  if (!this.displayName) {
    this.displayName = this.name;
  }
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;
