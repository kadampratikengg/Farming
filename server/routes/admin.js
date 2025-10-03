const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const twilio = require('twilio');
const { body, validationResult } = require('express-validator');

console.log('Admin routes loaded'); // Debug log

// Initialize Twilio client with error handling
let client;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized successfully');
  } else {
    console.warn('Twilio credentials invalid or missing. WhatsApp functionality will be disabled.');
  }
} catch (err) {
  console.error('Failed to initialize Twilio client:', err.message);
}

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Login
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, password } = req.body;
      const user = await User.findOne({ username });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user._id, role: 'admin' }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Register new admin user (no authentication required)
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('Username is required').matches(/^\S+@\S+\.\S+$/).withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('contactNumber').matches(/\+[0-9]{10,15}/).withMessage('Valid phone number with country code is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, password, contactNumber } = req.body;
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const user = new User({ username, password, contactNumber });
      await user.save();
      res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
      console.error('Error creating user:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Forgot password
router.post(
  '/forgot-password',
  [body('username').notEmpty().withMessage('Username is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username } = req.body;
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.resetCode = resetCode;
      user.resetCodeExpires = Date.now() + 3600000; // 1 hour expiry
      await user.save();

      // Send reset code via WhatsApp if Twilio is configured
      if (client) {
        await client.messages.create({
          body: `Your password reset code is ${resetCode}. It expires in 1 hour.`,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${user.contactNumber}`,
        });
        res.json({ message: 'Reset code sent to your WhatsApp number' });
      } else {
        res.json({ message: 'Reset code generated but WhatsApp not configured. Code: ' + resetCode });
      }
    } catch (err) {
      console.error('Error in forgot-password:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Reset password
router.post(
  '/reset-password',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('code').notEmpty().withMessage('Reset code is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, code, newPassword } = req.body;
      const user = await User.findOne({ username, resetCode: code });
      if (!user || user.resetCodeExpires < Date.now()) {
        return res.status(400).json({ error: 'Invalid or expired reset code' });
      }

      user.password = newPassword;
      user.resetCode = undefined;
      user.resetCodeExpires = undefined;
      await user.save();

      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;