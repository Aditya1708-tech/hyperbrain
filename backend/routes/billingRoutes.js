import express from 'express';
import jwt from 'jsonwebtoken';
import { Invoice, Subscription, Coupon } from '../models/Billing.js';
import User from '../models/User.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

const PLANS_PRICING = {
  student_pro: {
    name: 'Student Pro',
    monthly: { amount: 9.99, amountINR: 499 },
    quarterly: { amount: 24.99, amountINR: 1299 },
    annual: { amount: 79.99, amountINR: 3999 }
  },
  student_pro_plus: {
    name: 'Student Pro+',
    monthly: { amount: 19.99, amountINR: 999 },
    quarterly: { amount: 49.99, amountINR: 2499 },
    annual: { amount: 149.99, amountINR: 7999 }
  }
};

// POST /api/billing/coupon (validate coupon)
router.post('/coupon', async (req, res) => {
  try {
    const { code, planId, billingPeriod, useINR } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code required' });
    }

    const cleanCode = code.toUpperCase().trim();
    const coupon = await Coupon.findOne({ code: cleanCode, isActive: true });

    if (!coupon && cleanCode !== 'HYPERBRAIN20' && cleanCode !== 'PRO50') {
      return res.status(400).json({ success: false, valid: false, message: 'Invalid or expired coupon' });
    }

    const plan = PLANS_PRICING[planId];
    const base = plan ? (useINR ? plan[billingPeriod]?.amountINR : plan[billingPeriod]?.amount) || 10 : 10;
    
    let discountAmount = 0;
    if (coupon) {
      discountAmount = coupon.discountType === 'percentage' 
        ? (base * coupon.discountValue) / 100 
        : coupon.discountValue;
    } else if (cleanCode === 'HYPERBRAIN20') {
      discountAmount = Math.round(base * 0.20 * 100) / 100;
    } else if (cleanCode === 'PRO50') {
      discountAmount = Math.round(base * 0.50 * 100) / 100;
    }

    return res.json({
      success: true,
      valid: true,
      couponCode: cleanCode,
      discountAmount,
      message: `Coupon ${cleanCode} applied successfully!`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/billing/checkout
router.post('/checkout', verifyAuth, async (req, res) => {
  try {
    const { userId, email, userName, planId, billingPeriod, gateway = 'stripe', couponCode, useINR } = req.body;

    if (!userId || !email || !planId || !billingPeriod) {
      return res.status(400).json({ success: false, message: 'Missing checkout parameters' });
    }

    const plan = PLANS_PRICING[planId];
    if (!plan || !plan[billingPeriod]) {
      return res.status(400).json({ success: false, message: 'Invalid plan or billing period' });
    }

    const isINR = gateway === 'razorpay' || useINR;
    const basePrice = isINR ? plan[billingPeriod].amountINR : plan[billingPeriod].amount;
    const currency = isINR ? 'INR' : 'USD';

    let discountAmount = 0;
    if (couponCode) {
      const clean = couponCode.toUpperCase().trim();
      if (clean === 'HYPERBRAIN20') discountAmount = Math.round(basePrice * 0.20 * 100) / 100;
      if (clean === 'PRO50') discountAmount = Math.round(basePrice * 0.50 * 100) / 100;
    }

    const taxableAmount = Math.max(0, basePrice - discountAmount);
    const taxAmount = Math.round(taxableAmount * 0.18 * 100) / 100;
    const finalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const invoice = new Invoice({
      id: transactionId,
      userId,
      userName: userName || email.split('@')[0],
      userEmail: email,
      planId,
      billingPeriod,
      baseAmount: basePrice,
      discountAmount,
      taxableAmount,
      taxAmount,
      finalAmount,
      currency,
      status: 'pending',
      gateway,
      couponApplied: couponCode || null
    });

    await invoice.save();

    // Simulated / Instant Success link for seamless experience
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:5173';
    const simulatedUrl = `${protocol}://${host}/profile?billing=success&gateway=${gateway}&session_id=mock_sess_${Date.now()}&txn_id=${transactionId}&planId=${planId}&billingPeriod=${billingPeriod}&amount=${finalAmount}&currency=${currency}`;

    return res.json({
      success: true,
      gateway,
      checkoutUrl: simulatedUrl,
      transactionId,
      amount: finalAmount,
      currency
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/billing/webhook
router.post('/webhook', async (req, res) => {
  try {
    const { txn_id, planId, billingPeriod, userId, gateway, status = 'paid' } = req.body;

    if (txn_id) {
      await Invoice.findOneAndUpdate(
        { id: txn_id },
        { status: 'paid', paidAt: new Date() }
      );
    }

    if (userId) {
      const expiresAt = new Date();
      if (billingPeriod === 'annual') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else if (billingPeriod === 'quarterly') {
        expiresAt.setMonth(expiresAt.getMonth() + 3);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      await Subscription.findOneAndUpdate(
        { userId },
        {
          planId: planId || 'student_pro',
          planName: planId === 'student_pro_plus' ? 'Student Pro+' : 'Student Pro',
          billingPeriod: billingPeriod || 'monthly',
          status: 'active',
          startDate: new Date(),
          expiresAt,
          gateway: gateway || 'simulated'
        },
        { upsert: true, new: true }
      );

      // Upgrade user isPro
      await User.updateOne(
        { $or: [{ uid: userId }, { _id: userId.match(/^[0-9a-fA-F]{24}$/) ? userId : null }] },
        { isPro: true }
      );
    }

    return res.json({ success: true, message: 'Subscription and invoice updated' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/billing/invoices
router.get('/invoices', verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    const query = userId ? { userId } : {};
    const invoices = await Invoice.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, invoices });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/billing/subscription/:userId
router.get('/subscription/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sub = await Subscription.findOne({ userId });
    return res.json({ success: true, subscription: sub });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/billing/admin or /api/billing-admin
router.post('/admin', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    let isAuthorized = false;

    // 1. Verify Bearer token if present
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hyperbrain_jwt_super_secret_key_2026');
        if (decoded && (decoded.role === 'Administrator' || decoded.role === 'admin' || decoded.uid === 'admin_master')) {
          isAuthorized = true;
        }
      } catch (e) {
        // Bearer verify failed
      }
    }

    // 2. Verify Basic auth against server environment variables
    if (!isAuthorized && authHeader.startsWith('Basic ')) {
      const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('ascii');
      const [u, p] = credentials.split(':');
      const expectedUsername = (process.env.ADMIN_USERNAME || 'Aditya').trim();
      const expectedPassword = process.env.ADMIN_PASSWORD || 'HelloWorld!';
      if (u === expectedUsername && p === expectedPassword) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Unauthorized administrative access' });
    }

    const { action } = req.body;

    if (action === 'get_billing_data') {
      const [subs, users, invoices, coupons] = await Promise.all([
        Subscription.find().lean(),
        User.find({}, 'uid email name displayName role isPro status createdAt').lean(),
        Invoice.find().sort({ createdAt: -1 }).lean(),
        Coupon.find().lean()
      ]);

      return res.json({
        success: true,
        subs: subs || [],
        users: users || [],
        invoices: invoices || [],
        history: invoices || [],
        coupons: coupons || []
      });
    }

    if (action === 'override_sub') {
      const { userId, planId, billingPeriod, status = 'active' } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await Subscription.findOneAndUpdate(
        { userId },
        { planId, billingPeriod, status, expiresAt },
        { upsert: true, new: true }
      );
      await User.updateOne({ $or: [{ uid: userId }, { _id: userId.match(/^[0-9a-fA-F]{24}$/) ? userId : null }] }, { isPro: status === 'active' });

      return res.json({ success: true, message: 'Subscription successfully updated' });
    }

    if (action === 'extend_sub') {
      const { userId, days = 30 } = req.body;
      const sub = await Subscription.findOne({ userId });
      const currentExp = sub?.expiresAt ? new Date(sub.expiresAt) : new Date();
      currentExp.setDate(currentExp.getDate() + Number(days));

      await Subscription.findOneAndUpdate(
        { userId },
        { expiresAt: currentExp, status: 'active' },
        { upsert: true }
      );
      await User.updateOne({ $or: [{ uid: userId }, { _id: userId.match(/^[0-9a-fA-F]{24}$/) ? userId : null }] }, { isPro: true });

      return res.json({ success: true, message: `Subscription extended by ${days} days` });
    }

    if (action === 'refund_sub') {
      const { transactionId } = req.body;
      await Invoice.findOneAndUpdate({ id: transactionId }, { status: 'refunded' });
      return res.json({ success: true, message: 'Transaction refunded' });
    }

    if (action === 'create_coupon') {
      const { code, type, value, maxRedemptions, expirationDate, currency } = req.body;
      if (!code) return res.status(400).json({ success: false, message: 'Coupon code required' });

      const coupon = new Coupon({
        code: code.toUpperCase().trim(),
        discountType: type || 'percentage',
        discountValue: Number(value) || 10,
        maxRedemptions: Number(maxRedemptions) || 100,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        currency: currency || 'USD',
        isActive: true
      });
      await coupon.save();

      return res.json({ success: true, message: 'Coupon created successfully', coupon });
    }

    if (action === 'deactivate_coupon') {
      const { code } = req.body;
      await Coupon.findOneAndUpdate({ code: code?.toUpperCase().trim() }, { isActive: false });
      return res.json({ success: true, message: 'Coupon deactivated' });
    }

    return res.status(400).json({ success: false, message: 'Unrecognized action' });
  } catch (error) {
    console.error('Billing admin error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
