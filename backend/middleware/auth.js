import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hyperbrain_jwt_super_secret_key_2026';

export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.uid,
      uid: user.uid || user._id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

export const verifyAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // If token invalid/expired, still continue as unauthenticated
    req.user = null;
    next();
  }
};

export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'Administrator' && req.user.role !== 'Admin')) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Administrator privileges required.'
    });
  }
  next();
};
