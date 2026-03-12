// ============================================
// server.js — GmailCall Backend (v2 with Safety)
// Express + Socket.io + Block + Call Permission
// ============================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const { router: authRouter, tokenStore, userStore } = require('./routes/auth');
const {
  router: safetyRouter,
  blockStore, permissionStore, deniedStore, pendingRequests,
  isBlocked, hasPermission, isDenied
} = require('./routes/safety');
const { sendCallNotificationEmail, sendCallRequestEmail } = require('./services/emailService');

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(cors({ origin: FRONTEND_URL, methods: ['GET', 'POST', 'DELETE'], credentials: true }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'], credentials: true },
});

// Map<email, socketId>
const onlineUsers = new Map();
// Map<callId, { caller, receiver, startTime }>
const activeCalls = new Map();

// ─── Socket Auth Middleware ────────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  const email = tokenStore.get(token);
  if (!email) return next(new Error('Invalid or expired token'));
  socket.userEmail = email;
  next();
});

// ─── Socket Connection Handler ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  const email = socket.userEmail;
  console.log(`🟢 Connected: ${email}`);
  onlineUsers.set(email, socket.id);
  socket.emit('online-status', { online: true, email });

  // Push any pending call requests to user on login
  const incomingRequests = [];
  for (const [reqId, req] of pendingRequests.entries()) {
    if (req.receiverId === email) {
      const callerInfo = userStore.get(req.callerId);
      incomingRequests.push({
        requestId: reqId,
        callerEmail: req.callerId,
        callerUsername: callerInfo?.username || req.callerId.split('@')[0],
        callerAvatarColor: callerInfo?.avatarColor || '#00d4ff',
        callerAvatarInitial: req.callerId[0].toUpperCase(),
        createdAt: req.createdAt,
      });
    }
  }
  if (incomingRequests.length > 0) {
    socket.emit('pending-call-requests', { requests: incomingRequests });
  }

  // ── Check user online status ───────────────────────────────────────────────
  socket.on('check-user-online', ({ targetEmail }) => {
    const isOnline = onlineUsers.has(targetEmail.toLowerCase().trim());
    socket.emit('user-online-status', { email: targetEmail, online: isOnline });
  });

  // ── Initiate Call (with full safety pipeline) ──────────────────────────────
  socket.on('call-user', async ({ targetEmail, offer }) => {
    const target = targetEmail.toLowerCase().trim();
    const callerUser = userStore.get(email);
    console.log(`📞 Call attempt: ${email} → ${target}`);

    // Safety Check 1: target has blocked caller
    if (isBlocked(target, email)) {
      return socket.emit('call-failed', { reason: 'blocked', message: 'This user is not available.' });
    }
    // Safety Check 2: caller has blocked target
    if (isBlocked(email, target)) {
      return socket.emit('call-failed', { reason: 'you_blocked', message: 'You have blocked this user. Unblock them first.' });
    }
    // Safety Check 3: caller was denied by target
    if (isDenied(target, email)) {
      return socket.emit('call-failed', { reason: 'denied', message: 'This user has declined your call request.' });
    }

    // Safety Check 4: caller has no permission yet
    if (!hasPermission(target, email)) {
      // Check for existing pending request
      let existingReqId = null;
      for (const [reqId, req] of pendingRequests.entries()) {
        if (req.callerId === email && req.receiverId === target) { existingReqId = reqId; break; }
      }
      if (existingReqId) {
        return socket.emit('call-failed', {
          reason: 'request_pending', requestId: existingReqId,
          message: `A call request is already pending with ${target}.`,
        });
      }

      // Create new call request
      const requestId = uuidv4();
      pendingRequests.set(requestId, { callerId: email, receiverId: target, createdAt: new Date().toISOString() });
      console.log(`📋 Request created: ${email} → ${target} (${requestId})`);

      // Notify receiver if online
      const targetSock = onlineUsers.get(target);
      if (targetSock) {
        io.to(targetSock).emit('incoming-call-request', {
          requestId, callerEmail: email,
          callerUsername: callerUser?.username || email.split('@')[0],
          callerAvatarColor: callerUser?.avatarColor || '#00d4ff',
          callerAvatarInitial: email[0].toUpperCase(),
          createdAt: new Date().toISOString(),
        });
      }

      // Send call request email
      sendCallRequestEmail(email, target).catch(e => console.error('Call request email err:', e.message));

      return socket.emit('call-request-sent', {
        requestId, targetEmail: target,
        message: `Call permission request sent to ${target}. They will be notified.`,
      });
    }

    // ── Permission exists — proceed with live call ─────────────────────────
    const callId = uuidv4();
    sendCallNotificationEmail(email, target).catch(e => console.error('Call email err:', e.message));

    const targetSock = onlineUsers.get(target);
    if (!targetSock) {
      return socket.emit('call-failed', {
        reason: 'offline',
        message: `${target} is offline. A notification email has been sent.`,
      });
    }

    activeCalls.set(callId, { caller: email, receiver: target, startTime: null, callId });
    io.to(targetSock).emit('incoming-call', {
      callId, callerEmail: email,
      callerUsername: callerUser?.username || email.split('@')[0],
      callerAvatarColor: callerUser?.avatarColor || '#00d4ff',
      callerAvatarInitial: email[0].toUpperCase(),
      offer,
    });
    socket.emit('call-ringing', { callId, targetEmail: target });
    console.log(`🔔 Ringing: ${target}`);
  });

  // ── Respond to a call request (accept or reject) ───────────────────────────
  socket.on('respond-call-request', ({ requestId, action }) => {
    const req = pendingRequests.get(requestId);
    if (!req || req.receiverId !== email) return;

    if (action === 'accept') {
      if (!permissionStore.has(email)) permissionStore.set(email, new Set());
      permissionStore.get(email).add(req.callerId);
      deniedStore.get(email)?.delete(req.callerId);
      console.log(`✅ Accepted: ${req.callerId} can call ${email}`);
      const callerSock = onlineUsers.get(req.callerId);
      if (callerSock) {
        const myInfo = userStore.get(email);
        io.to(callerSock).emit('call-request-accepted', {
          requestId, accepterEmail: email,
          accepterUsername: myInfo?.username || email.split('@')[0],
          accepterAvatarColor: myInfo?.avatarColor || '#10b981',
        });
      }
    } else {
      if (!deniedStore.has(email)) deniedStore.set(email, new Set());
      deniedStore.get(email).add(req.callerId);
      console.log(`❌ Denied: ${req.callerId} cannot call ${email}`);
      const callerSock = onlineUsers.get(req.callerId);
      if (callerSock) io.to(callerSock).emit('call-request-rejected', { requestId, rejecterEmail: email });
    }

    pendingRequests.delete(requestId);
    socket.emit('call-requests-updated');
  });

  // ── Block user via socket (instant, ends active calls) ────────────────────
  socket.on('block-user', ({ targetEmail }) => {
    const target = targetEmail.toLowerCase().trim();
    if (!blockStore.has(email)) blockStore.set(email, new Set());
    blockStore.get(email).add(target);
    permissionStore.get(email)?.delete(target);
    // Cancel any pending requests
    for (const [reqId, req] of pendingRequests.entries()) {
      if ((req.callerId === target && req.receiverId === email) ||
          (req.callerId === email && req.receiverId === target)) {
        pendingRequests.delete(reqId);
      }
    }
    console.log(`🚫 ${email} blocked ${target}`);
    socket.emit('user-blocked', { targetEmail: target });

    // End any active call with this person
    for (const [callId, call] of activeCalls.entries()) {
      if ((call.caller === email && call.receiver === target) ||
          (call.caller === target && call.receiver === email)) {
        const otherEmail = call.caller === email ? call.receiver : call.caller;
        const otherSock = onlineUsers.get(otherEmail);
        if (otherSock) io.to(otherSock).emit('call-ended', { callId, reason: 'blocked' });
        activeCalls.delete(callId);
      }
    }
  });

  // ── Accept / Reject / End call ─────────────────────────────────────────────
  socket.on('accept-call', ({ callId, answer }) => {
    const call = activeCalls.get(callId);
    if (!call) return;
    call.startTime = Date.now();
    activeCalls.set(callId, call);
    const callerSock = onlineUsers.get(call.caller);
    if (callerSock) io.to(callerSock).emit('call-accepted', { callId, answer });
    console.log(`✅ Call connected: ${callId}`);
  });

  socket.on('reject-call', ({ callId }) => {
    const call = activeCalls.get(callId);
    if (!call) return;
    const callerSock = onlineUsers.get(call.caller);
    if (callerSock) io.to(callerSock).emit('call-rejected', { callId });
    activeCalls.delete(callId);
  });

  socket.on('end-call', ({ callId }) => {
    const call = activeCalls.get(callId);
    if (!call) return;
    const otherEmail = call.caller === email ? call.receiver : call.caller;
    const otherSock = onlineUsers.get(otherEmail);
    if (otherSock) io.to(otherSock).emit('call-ended', { callId });
    activeCalls.delete(callId);
    console.log(`📴 Call ended: ${callId}`);
  });

  // ── ICE ────────────────────────────────────────────────────────────────────
  socket.on('ice-candidate', ({ callId, candidate }) => {
    const call = activeCalls.get(callId);
    if (!call) return;
    const targetEmail = call.caller === email ? call.receiver : call.caller;
    const targetSock = onlineUsers.get(targetEmail);
    if (targetSock) io.to(targetSock).emit('ice-candidate', { callId, candidate });
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`🔴 Disconnected: ${email}`);
    onlineUsers.delete(email);
    for (const [callId, call] of activeCalls.entries()) {
      if (call.caller === email || call.receiver === email) {
        const otherEmail = call.caller === email ? call.receiver : call.caller;
        const otherSock = onlineUsers.get(otherEmail);
        if (otherSock) io.to(otherSock).emit('call-ended', { callId, reason: 'disconnected' });
        activeCalls.delete(callId);
      }
    }
  });
});

// ─── REST Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/safety', safetyRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'GmailCall API v2', timestamp: new Date().toISOString(), onlineUsers: onlineUsers.size });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 GmailCall Server v2 on port ${PORT}`);
  console.log(`📡 Frontend: ${FRONTEND_URL}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || '⚠️  NOT CONFIGURED'}`);
  console.log(`🛡️  Safety: Block System + Call Permission enabled\n`);
});
