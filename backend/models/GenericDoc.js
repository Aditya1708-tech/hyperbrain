import mongoose from 'mongoose';

const GenericDocSchema = new mongoose.Schema({
  collectionName: { type: String, required: true, index: true },
  docId: { type: String, required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  strict: false
});

GenericDocSchema.index({ collectionName: 1, docId: 1 }, { unique: true });

export const GenericDoc = mongoose.models.GenericDoc || mongoose.model('GenericDoc', GenericDocSchema);
export default GenericDoc;
