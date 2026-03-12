// ============================================
// routes/auth.js
// OTP generation, verification, user management
// ============================================

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { sendOTPEmail } = require('../services/emailService');

// In-memory stores (use Redis/DB in production)
// Map<email, { otp, expiresAt, attempts }>
const otpStore = new Map();

// Map<email, { email, username, avatarColor, createdAt, token }>
const userStore = new Map();

// Map<token, email>
const tokenStore = new Map();

// ─── Utilities ────────────────────────────────────────────────────────────────

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateUsername = (email) => {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
};

const AVATAR_COLORS = [
  '#00d4ff', '#7c3aed', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4',
];

const randomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

// ─── POST /api/auth/request-otp ───────────────────────────────────────────────
// Validates email and sends OTP
router.post('/request-otp', async (req, res) => {
  const { email } = req.body;

  // Basic Gmail validation
  if (!email || !email.toLowerCase().endsWith('@gmail.com')) {
    return res.status(400).json({ success: false, message: 'Please enter a valid Gmail address.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Rate limiting: check if OTP was sent in last 60 seconds
  const existing = otpStore.get(normalizedEmail);
  if (existing && (Date.now() < existing.expiresAt) && existing.sentAt && (Date.now() - existing.sentAt < 60000)) {
    const wait = Math.ceil((60000 - (Date.now() - existing.sentAt)) / 1000);
    return res.status(429).json({ success: false, message: `Please wait ${wait} seconds before requesting a new OTP.` });
  }

  const otp = generateOTP();
  const expiryMs = (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000;

  // Store OTP with expiry
  otpStore.set(normalizedEmail, {
    otp,
    expiresAt: Date.now() + expiryMs,
    sentAt: Date.now(),
    attempts: 0,
  });

  try {
    await sendOTPEmail(normalizedEmail, otp);
    console.log(`📧 OTP sent to ${normalizedEmail}`);
    res.json({ success: true, message: `Verification code sent to ${normalizedEmail}` });
  } catch (error) {
    otpStore.delete(normalizedEmail);
    console.error('OTP send error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to send verification email. Check your email configuration.' });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────
// Verifies OTP and returns auth token + user profile
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
  }

  // Check expiry
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
  }

  // Max 5 attempts
  if (record.attempts >= 5) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
  }

  if (record.otp !== otp.trim()) {
    record.attempts += 1;
    otpStore.set(normalizedEmail, record);
    const remaining = 5 - record.attempts;
    return res.status(400).json({ success: false, message: `Incorrect code. ${remaining} attempt(s) remaining.` });
  }

  // OTP valid — clear it
  otpStore.delete(normalizedEmail);

  // Get or create user profile
  let user = userStore.get(normalizedEmail);
  if (!user) {
    user = {
      email: normalizedEmail,
      username: generateUsername(normalizedEmail),
      avatarColor: randomColor(),
      avatarInitial: normalizedEmail[0].toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    userStore.set(normalizedEmail, user);
  }

  // Generate session token
  const token = uuidv4();
  tokenStore.set(token, normalizedEmail);

  // Auto-expire token after 24 hours
  setTimeout(() => tokenStore.delete(token), 24 * 60 * 60 * 1000);

  console.log(`✅ User authenticated: ${normalizedEmail}`);
  res.json({ success: true, token, user });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    tokenStore.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: 'No token provided.' });

  const email = tokenStore.get(token);
  if (!email) return res.status(401).json({ success: false, message: 'Invalid or expired token.' });

  const user = userStore.get(email);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  res.json({ success: true, user });
});

// Export tokenStore so Socket.io can validate tokens
module.exports = { router, tokenStore, userStore };
