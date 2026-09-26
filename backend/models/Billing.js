import mongoose from 'mongoose';

// Invoice Schema
export const InvoiceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  userEmail: { type: String, required: true },
  planId: { type: String, required: true },
  billingPeriod: { type: String, required: true },
  baseAmount: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending', index: true },
  gateway: { type: String, required: true },
  couponApplied: { type: String, default: null },
  paidAt: { type: Date }
}, { timestamps: true });

// Subscription Schema
export const SubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  planId: { type: String, required: true },
  planName: { type: String, default: '' },
  billingPeriod: { type: String, default: 'monthly' },
  status: { type: String, enum: ['active', 'cancelled', 'expired', 'past_due'], default: 'active' },
  startDate: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  lastPaymentId: { type: String },
  gateway: { type: String }
}, { timestamps: true });

// Coupon Schema
export const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  discountValue: { type: Number, required: true },
  maxDiscount: { type: Number, default: 0 },
  minAmount: { type: Number, default: 0 },
  validUntil: { type: Date },
  usageLimit: { type: Number, default: 1000 },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
export const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', CouponSchema);
