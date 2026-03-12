// ============================================
// context/SocketContext.js
// Socket.io + WebRTC + Safety System (Block + Permissions)
// ============================================

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();

  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  const [connected, setConnected] = useState(false);

  // ─── Call state ──────────────────────────────────────────────────────────
  const [callState, setCallState] = useState({
    status: 'idle', // idle|calling|ringing|connected|ended|request_sent
    callId: null,
    remoteEmail: null,
    remoteUsername: null,
    remoteAvatarColor: null,
    remoteAvatarInitial: null,
    direction: null,
    startTime: null,
    offer: null,
    endReason: null,
  });

  // ─── Safety state ─────────────────────────────────────────────────────────
  // Incoming call requests (other users want permission to call me)
  const [callRequests, setCallRequests] = useState([]);
  // Notification when our call request was accepted/rejected
  const [requestNotification, setRequestNotification] = useState(null);

  const remoteAudioRef = useRef(null);

  const resetCallState = () => ({
    status: 'idle', callId: null, remoteEmail: null, remoteUsername: null,
    remoteAvatarColor: null, remoteAvatarInitial: null, direction: null,
    startTime: null, offer: null, endReason: null,
  });

  const cleanupCall = useCallback(() => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
  }, []);

  // ─── Connect Socket ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => { setConnected(true); });
    socket.on('disconnect', () => { setConnected(false); });

    // ── LIVE call events ─────────────────────────────────────────────────────
    socket.on('incoming-call', ({ callId, callerEmail, callerUsername, callerAvatarColor, callerAvatarInitial, offer }) => {
      setCallState({
        status: 'ringing', callId, remoteEmail: callerEmail, remoteUsername: callerUsername,
        remoteAvatarColor: callerAvatarColor, remoteAvatarInitial: callerAvatarInitial,
        direction: 'incoming', startTime: null, offer,
      });
    });

    socket.on('call-accepted', async ({ callId, answer }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
      setCallState(prev => ({ ...prev, status: 'connected', startTime: Date.now() }));
    });

    socket.on('call-rejected', () => {
      cleanupCall();
      setCallState(prev => ({ ...prev, status: 'ended', endReason: 'Call was declined.' }));
      setTimeout(() => setCallState(resetCallState()), 4000);
    });

    socket.on('call-ended', ({ reason }) => {
      cleanupCall();
      const msg = reason === 'blocked' ? 'Call ended — user was blocked.' :
                  reason === 'disconnected' ? 'Other user disconnected.' : 'Call ended.';
      setCallState(prev => ({ ...prev, status: 'ended', endReason: msg }));
      setTimeout(() => setCallState(resetCallState()), 4000);
    });

    socket.on('call-ringing', ({ callId, targetEmail }) => {
      setCallState(prev => ({ ...prev, status: 'calling', callId }));
    });

    socket.on('call-failed', ({ reason, message }) => {
      cleanupCall();
      setCallState(prev => ({ ...prev, status: 'ended', endReason: message }));
      setTimeout(() => setCallState(resetCallState()), 6000);
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      if (peerRef.current && candidate) {
        try { await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.error('ICE error:', e); }
      }
    });

    // ── SAFETY: Call Permission Request events ───────────────────────────────

    // Someone wants permission to call me
    socket.on('incoming-call-request', (request) => {
      setCallRequests(prev => {
        if (prev.find(r => r.requestId === request.requestId)) return prev;
        return [request, ...prev];
      });
    });

    // Server pushes all pending requests on connect
    socket.on('pending-call-requests', ({ requests }) => {
      setCallRequests(requests);
    });

    // My request was accepted — they said yes
    socket.on('call-request-accepted', ({ requestId, accepterEmail, accepterUsername, accepterAvatarColor }) => {
      setRequestNotification({
        type: 'accepted',
        email: accepterEmail,
        username: accepterUsername,
        avatarColor: accepterAvatarColor,
        message: `${accepterEmail} accepted your call request! You can now call them.`,
      });
      setTimeout(() => setRequestNotification(null), 8000);
    });

    // My request was rejected
    socket.on('call-request-rejected', ({ rejecterEmail }) => {
      setRequestNotification({
        type: 'rejected',
        email: rejecterEmail,
        message: `${rejecterEmail} declined your call request.`,
      });
      setTimeout(() => setRequestNotification(null), 6000);
    });

    // My call request was sent successfully
    socket.on('call-request-sent', ({ requestId, targetEmail, message }) => {
      setCallState(prev => ({
        ...prev,
        status: 'ended',
        endReason: message,
      }));
      setTimeout(() => setCallState(resetCallState()), 8000);
    });

    // Requests updated (after I responded to one)
    socket.on('call-requests-updated', () => {
      // Re-fetch from server (or just remove handled ones)
    });

    // I blocked someone
    socket.on('user-blocked', ({ targetEmail }) => {
      // Remove any pending requests from them
      setCallRequests(prev => prev.filter(r => r.callerEmail !== targetEmail));
    });

    return () => {
      socket.disconnect();
      cleanupCall();
    };
  }, [token]); // eslint-disable-line

  // ─── Create WebRTC Peer ────────────────────────────────────────────────────
  const createPeerConnection = useCallback((callId) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', { callId, candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        cleanupCall();
        setCallState(prev => ({ ...prev, status: 'ended', endReason: 'Connection lost.' }));
        setTimeout(() => setCallState(resetCallState()), 3000);
      }
    };

    return peer;
  }, [cleanupCall]);

  // ─── Start Outgoing Call ───────────────────────────────────────────────────
  const startCall = useCallback(async (targetEmail) => {
    if (!socketRef.current || !user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const callId = `call_${Date.now()}`;
      const peer = createPeerConnection(callId);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      setCallState({
        status: 'calling', callId, remoteEmail: targetEmail,
        remoteUsername: targetEmail.split('@')[0],
        remoteAvatarColor: '#00d4ff', remoteAvatarInitial: targetEmail[0].toUpperCase(),
        direction: 'outgoing', startTime: null, offer: null,
      });

      socketRef.current.emit('call-user', { targetEmail, offer });
    } catch (error) {
      console.error('Failed to start call:', error);
      cleanupCall();
      if (error.name === 'NotAllowedError') {
        alert('Microphone permission denied. Please allow microphone access.');
      }
    }
  }, [user, createPeerConnection, cleanupCall]);

  // ─── Accept Incoming Call ──────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!socketRef.current || !callState.offer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const peer = createPeerConnection(callState.callId);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      await peer.setRemoteDescription(new RTCSessionDescription(callState.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socketRef.current.emit('accept-call', { callId: callState.callId, answer });
      setCallState(prev => ({ ...prev, status: 'connected', startTime: Date.now() }));
    } catch (error) {
      console.error('Failed to accept call:', error);
      rejectCall();
    }
  }, [callState, createPeerConnection]); // eslint-disable-line

  const rejectCall = useCallback(() => {
    if (!socketRef.current || !callState.callId) return;
    socketRef.current.emit('reject-call', { callId: callState.callId });
    setCallState(resetCallState());
  }, [callState.callId]);

  const endCall = useCallback(() => {
    if (socketRef.current && callState.callId) {
      socketRef.current.emit('end-call', { callId: callState.callId });
    }
    cleanupCall();
    setCallState(resetCallState());
  }, [callState.callId, cleanupCall]);

  // ─── Safety Actions ────────────────────────────────────────────────────────
  const respondToCallRequest = useCallback((requestId, action) => {
    if (!socketRef.current) return;
    socketRef.current.emit('respond-call-request', { requestId, action });
    setCallRequests(prev => prev.filter(r => r.requestId !== requestId));
  }, []);

  const blockUser = useCallback((targetEmail) => {
    if (!socketRef.current) return;
    socketRef.current.emit('block-user', { targetEmail });
    setCallRequests(prev => prev.filter(r => r.callerEmail !== targetEmail));
  }, []);

  const checkUserOnline = useCallback((targetEmail) => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve(false);
      socketRef.current.emit('check-user-online', { targetEmail });
      socketRef.current.once('user-online-status', ({ email, online }) => {
        if (email.toLowerCase() === targetEmail.toLowerCase()) resolve(online);
      });
      setTimeout(() => resolve(false), 3000);
    });
  }, []);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      callState,
      callRequests, setCallRequests,
      requestNotification, setRequestNotification,
      remoteAudioRef,
      startCall, acceptCall, rejectCall, endCall,
      checkUserOnline,
      respondToCallRequest,
      blockUser,
    }}>
      {children}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
