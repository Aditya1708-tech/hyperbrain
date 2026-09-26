import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import errorHandler from './middleware/errorHandler.js';

// Import Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import academicRoutes from './routes/academicRoutes.js';
import notesRoutes from './routes/notesRoutes.js';
import flashcardsRoutes from './routes/flashcardsRoutes.js';
import examsRoutes from './routes/examsRoutes.js';
import studyPlanRoutes from './routes/studyPlanRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import dbRoutes from './routes/dbRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load private environment variables strictly from backend/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB().catch(err => {
  console.warn('[Server] Initial MongoDB connection attempt logged:', err.message);
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger in dev
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[Express API] ${req.method} ${req.url}`);
    next();
  });
}

// Mount Modular Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/flashcards', flashcardsRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/study-plans', studyPlanRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/health', healthRoutes);

// Legacy Route Aliases for 100% Backward Compatibility with existing endpoints
app.use('/api/billing-coupon', (req, res, next) => {
  req.url = '/coupon';
  billingRoutes(req, res, next);
});
app.use('/api/billing-checkout', (req, res, next) => {
  req.url = '/checkout';
  billingRoutes(req, res, next);
});
app.use('/api/billing-webhook', (req, res, next) => {
  req.url = '/webhook';
  billingRoutes(req, res, next);
});
app.use('/api/billing-invoice', (req, res, next) => {
  req.url = '/invoices';
  billingRoutes(req, res, next);
});
app.use('/api/billing-admin', (req, res, next) => {
  req.url = '/admin';
  billingRoutes(req, res, next);
});
app.use('/api/send-email', (req, res, next) => {
  req.url = '/send';
  emailRoutes(req, res, next);
});
app.use('/api/welcome', (req, res, next) => {
  req.url = '/send';
  emailRoutes(req, res, next);
});
app.use('/api/ai-tutor', (req, res, next) => {
  req.url = '/tutor';
  aiRoutes(req, res, next);
});
app.use('/api/generate-notes', (req, res, next) => {
  req.url = '/generate-notes';
  aiRoutes(req, res, next);
});
app.use('/api/generate-flashcards', (req, res, next) => {
  req.url = '/generate-flashcards';
  aiRoutes(req, res, next);
});
app.use('/api/generate-exam', (req, res, next) => {
  req.url = '/generate-exam';
  aiRoutes(req, res, next);
});
app.use('/api/study-plan', (req, res, next) => {
  req.url = '/study-plan';
  aiRoutes(req, res, next);
});

// Centralized error handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` HyperBrain Express Backend Server Running `);
  console.log(` Port: ${PORT}                            `);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=========================================`);
});

export default app;
