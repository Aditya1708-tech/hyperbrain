import express from 'express';
import User from '../models/User.js';
import { generateToken, verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const user = new User({
      email: email.toLowerCase().trim(),
      password,
      name: name || email.split('@')[0],
      displayName: name || email.split('@')[0],
      role: email.toLowerCase() === 'aditya@hyperbrain.ai' ? 'Administrator' : 'Student',
      isOnline: true,
      lastActive: new Date()
    });

    await user.save();

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        uid: user.uid || user._id,
        id: user._id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        role: user.role,
        isPro: user.isPro,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/admin-login (Secure server-side admin authentication)
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const expectedUsername = (process.env.ADMIN_USERNAME || 'Aditya').trim();
    const expectedPassword = process.env.ADMIN_PASSWORD || 'HelloWorld!';

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    if (username.trim() !== expectedUsername || password !== expectedPassword) {
      return res.status(401).json({ success: false, message: 'Invalid administrator credentials' });
    }

    const adminUser = {
      _id: 'admin_master',
      uid: 'admin_master',
      email: 'aditya@hyperbrain.ai',
      role: 'Administrator',
      name: expectedUsername,
      displayName: expectedUsername,
      isPro: true
    };

    const token = generateToken(adminUser);

    return res.json({
      success: true,
      message: 'Admin authorization granted',
      token,
      user: {
        uid: adminUser.uid,
        name: adminUser.name,
        role: adminUser.role,
        isPro: true
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        uid: user.uid || user._id,
        id: user._id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        role: user.role,
        isPro: user.isPro,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { email, displayName, photoURL, uid } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required for Google Sign-In' });
    }

    let user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      user = new User({
        uid: uid || undefined,
        email: email.toLowerCase().trim(),
        name: displayName || email.split('@')[0],
        displayName: displayName || email.split('@')[0],
        photoURL: photoURL || '',
        role: email.toLowerCase() === 'aditya@hyperbrain.ai' ? 'Administrator' : 'Student',
        isOnline: true,
        lastActive: new Date()
      });
      await user.save();
    } else {
      user.isOnline = true;
      user.lastActive = new Date();
      if (displayName) user.displayName = displayName;
      if (photoURL) user.photoURL = photoURL;
      await user.save();
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      token,
      user: {
        uid: user.uid || user._id,
        id: user._id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        role: user.role,
        isPro: user.isPro,
        photoURL: user.photoURL,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/me
router.get('/me', verifyAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await User.findOne({
      $or: [{ uid: req.user.uid }, { _id: req.user.id }, { email: req.user.email }]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      user: {
        uid: user.uid || user._id,
        id: user._id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        role: user.role,
        isPro: user.isPro,
        status: user.status,
        preferences: user.preferences,
        studyStats: user.studyStats
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/logout
router.post('/logout', verifyAuth, async (req, res) => {
  try {
    if (req.user) {
      await User.updateOne(
        { $or: [{ uid: req.user.uid }, { email: req.user.email }] },
        { isOnline: false, lastActive: new Date() }
      );
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
