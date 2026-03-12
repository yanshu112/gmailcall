// ============================================
// routes/safety.js
// Block System + Call Permission System
// ============================================

const express = require('express');
const router = express.Router();
const { tokenStore, userStore } = require('./auth');

// ─── In-Memory Safety Stores ──────────────────────────────────────────────────

// Block store: Map<blockerEmail, Set<blockedEmail>>
// "I have blocked these people"
const blockStore = new Map();

// Permission store: Map<receiverEmail, Set<callerEmail>>
// "These callers are allowed to call me"
const permissionStore = new Map();

// Permission denied store: Map<receiverEmail, Set<callerEmail>>
// "These callers were explicitly rejected and cannot call me"
const deniedStore = new Map();

// Pending call requests: Map<requestId, { callerId, receiverId, createdAt }>
const pendingRequests = new Map();

// ─── Auth Middleware ───────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  const email = tokenStore.get(token);
  if (!email) return res.status(401).json({ success: false, message: 'Invalid token.' });
  req.userEmail = email;
  next();
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

const isBlocked = (blockerEmail, targetEmail) => {
  return blockStore.get(blockerEmail)?.has(targetEmail) || false;
};

const hasPermission = (receiverEmail, callerEmail) => {
  return permissionStore.get(receiverEmail)?.has(callerEmail) || false;
};

const isDenied = (receiverEmail, callerEmail) => {
  return deniedStore.get(receiverEmail)?.has(callerEmail) || false;
};

// ─── BLOCK ROUTES ─────────────────────────────────────────────────────────────

// POST /api/safety/block — block a Gmail address
router.post('/block', requireAuth, (req, res) => {
  const { targetEmail } = req.body;
  if (!targetEmail) return res.status(400).json({ success: false, message: 'targetEmail required.' });

  const me = req.userEmail;
  const target = targetEmail.toLowerCase().trim();

  if (me === target) return res.status(400).json({ success: false, message: "You can't block yourself." });

  if (!blockStore.has(me)) blockStore.set(me, new Set());
  blockStore.get(me).add(target);

  // Also revoke any call permission from this person
  permissionStore.get(me)?.delete(target);

  console.log(`🚫 ${me} blocked ${target}`);
  res.json({ success: true, message: `${target} has been blocked.` });
});

// POST /api/safety/unblock — unblock a Gmail address
router.post('/unblock', requireAuth, (req, res) => {
  const { targetEmail } = req.body;
  if (!targetEmail) return res.status(400).json({ success: false, message: 'targetEmail required.' });

  const me = req.userEmail;
  const target = targetEmail.toLowerCase().trim();

  blockStore.get(me)?.delete(target);
  deniedStore.get(me)?.delete(target); // also clear denial so they can request again

  console.log(`✅ ${me} unblocked ${target}`);
  res.json({ success: true, message: `${target} has been unblocked.` });
});

// GET /api/safety/blocked — get my block list
router.get('/blocked', requireAuth, (req, res) => {
  const me = req.userEmail;
  const blocked = Array.from(blockStore.get(me) || []).map(email => ({
    email,
    username: userStore.get(email)?.username || email.split('@')[0],
    avatarColor: userStore.get(email)?.avatarColor || '#6b7280',
    avatarInitial: email[0].toUpperCase(),
  }));
  res.json({ success: true, blocked });
});

// ─── PERMISSION ROUTES ────────────────────────────────────────────────────────

// GET /api/safety/permissions — get approved callers list
router.get('/permissions', requireAuth, (req, res) => {
  const me = req.userEmail;
  const approved = Array.from(permissionStore.get(me) || []).map(email => ({
    email,
    username: userStore.get(email)?.username || email.split('@')[0],
    avatarColor: userStore.get(email)?.avatarColor || '#6b7280',
    avatarInitial: email[0].toUpperCase(),
  }));
  res.json({ success: true, approved });
});

// POST /api/safety/permissions/revoke — revoke call permission from a user
router.post('/permissions/revoke', requireAuth, (req, res) => {
  const { targetEmail } = req.body;
  const me = req.userEmail;
  const target = targetEmail?.toLowerCase().trim();
  permissionStore.get(me)?.delete(target);
  console.log(`🔒 ${me} revoked call permission from ${target}`);
  res.json({ success: true, message: `Call permission revoked for ${target}.` });
});

// ─── CALL REQUEST ROUTES ──────────────────────────────────────────────────────

// GET /api/safety/requests/incoming — get pending call requests sent TO me
router.get('/requests/incoming', requireAuth, (req, res) => {
  const me = req.userEmail;
  const incoming = [];

  for (const [reqId, req] of pendingRequests.entries()) {
    if (req.receiverId === me) {
      const callerInfo = userStore.get(req.callerId);
      incoming.push({
        requestId: reqId,
        callerEmail: req.callerId,
        callerUsername: callerInfo?.username || req.callerId.split('@')[0],
        callerAvatarColor: callerInfo?.avatarColor || '#00d4ff',
        callerAvatarInitial: req.callerId[0].toUpperCase(),
        createdAt: req.createdAt,
      });
    }
  }

  res.json({ success: true, requests: incoming });
});

// GET /api/safety/requests/outgoing — get my pending outgoing requests
router.get('/requests/outgoing', requireAuth, (req, res) => {
  const me = req.userEmail;
  const outgoing = [];

  for (const [reqId, req] of pendingRequests.entries()) {
    if (req.callerId === me) {
      const receiverInfo = userStore.get(req.receiverId);
      outgoing.push({
        requestId: reqId,
        receiverEmail: req.receiverId,
        receiverUsername: receiverInfo?.username || req.receiverId.split('@')[0],
        createdAt: req.createdAt,
        status: 'pending',
      });
    }
  }

  res.json({ success: true, requests: outgoing });
});

// POST /api/safety/requests/respond — accept or reject a call request
router.post('/requests/respond', requireAuth, (req, res) => {
  const { requestId, action } = req.body; // action: 'accept' | 'reject'
  const me = req.userEmail;

  if (!requestId || !['accept', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'requestId and action (accept/reject) required.' });
  }

  const request = pendingRequests.get(requestId);
  if (!request) return res.status(404).json({ success: false, message: 'Request not found or already handled.' });
  if (request.receiverId !== me) return res.status(403).json({ success: false, message: 'Not your request.' });

  if (action === 'accept') {
    // Grant call permission
    if (!permissionStore.has(me)) permissionStore.set(me, new Set());
    permissionStore.get(me).add(request.callerId);
    deniedStore.get(me)?.delete(request.callerId); // clear any previous denial
    console.log(`✅ ${me} accepted call request from ${request.callerId}`);
  } else {
    // Store denial — they cannot request again unless unblocked/reset
    if (!deniedStore.has(me)) deniedStore.set(me, new Set());
    deniedStore.get(me).add(request.callerId);
    console.log(`❌ ${me} rejected call request from ${request.callerId}`);
  }

  pendingRequests.delete(requestId);
  res.json({ success: true, action, callerId: request.callerId });
});

// POST /api/safety/requests/cancel — caller cancels their pending request
router.post('/requests/cancel', requireAuth, (req, res) => {
  const { requestId } = req.body;
  const me = req.userEmail;

  const request = pendingRequests.get(requestId);
  if (!request || request.callerId !== me) {
    return res.status(404).json({ success: false, message: 'Request not found.' });
  }

  pendingRequests.delete(requestId);
  res.json({ success: true, message: 'Call request cancelled.' });
});

// ─── CALL CHECK (used by server.js before initiating any call) ────────────────

// POST /api/safety/check-call — pre-call safety check
// Returns: { allowed: bool, reason, requestId? }
router.post('/check-call', requireAuth, (req, res) => {
  const { targetEmail } = req.body;
  const me = req.userEmail;
  const target = targetEmail?.toLowerCase().trim();

  if (!target) return res.status(400).json({ success: false, message: 'targetEmail required.' });

  // 1. Check if target has blocked me
  if (isBlocked(target, me)) {
    return res.json({ allowed: false, reason: 'blocked', message: 'This user is not available.' });
  }

  // 2. Check if I have blocked target (UX: prevent calling blocked people)
  if (isBlocked(me, target)) {
    return res.json({ allowed: false, reason: 'you_blocked', message: 'You have blocked this user. Unblock them first.' });
  }

  // 3. Check if caller has been denied by target
  if (isDenied(target, me)) {
    return res.json({ allowed: false, reason: 'denied', message: 'This user has declined your call request. They must manually allow you to call them.' });
  }

  // 4. Check if permission exists
  if (hasPermission(target, me)) {
    return res.json({ allowed: true, reason: 'permitted' });
  }

  // 5. Check if there's already a pending request
  for (const [reqId, request] of pendingRequests.entries()) {
    if (request.callerId === me && request.receiverId === target) {
      return res.json({ allowed: false, reason: 'request_pending', requestId: reqId, message: 'A call request is already pending. Waiting for their response.' });
    }
  }

  // 6. No permission — need to send a call request
  const { v4: uuidv4 } = require('uuid');
  const requestId = uuidv4();
  pendingRequests.set(requestId, {
    callerId: me,
    receiverId: target,
    createdAt: new Date().toISOString(),
  });

  console.log(`📋 Call request created: ${me} → ${target} (${requestId})`);
  return res.json({ allowed: false, reason: 'request_sent', requestId, message: `Call request sent to ${target}. They will be notified.` });
});

// Export stores for use in server.js socket handler
module.exports = {
  router,
  blockStore,
  permissionStore,
  deniedStore,
  pendingRequests,
  isBlocked,
  hasPermission,
  isDenied,
};
