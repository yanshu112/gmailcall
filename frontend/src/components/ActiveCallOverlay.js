// ============================================
// components/ActiveCallOverlay.js
// Full-screen active call UI with timer + controls
// ============================================

import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import './ActiveCallOverlay.css';

const formatDuration = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = String(s % 60).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
};

const ActiveCallOverlay = () => {
  const { callState, endCall, blockUser } = useSocket();

  const handleBlockDuringCall = () => {
    if (!window.confirm(`Block ${callState.remoteEmail}?\nThe call will end immediately.`)) return;
    blockUser(callState.remoteEmail);
    endCall();
  };
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  // Duration timer
  useEffect(() => {
    if (callState.status !== 'connected' || !callState.startTime) return;
    const t = setInterval(() => {
      setDuration(Date.now() - callState.startTime);
    }, 1000);
    return () => clearInterval(t);
  }, [callState.status, callState.startTime]);

  const getStatusText = () => {
    if (callState.status === 'calling') return 'Calling...';
    if (callState.status === 'ringing') return 'Ringing...';
    if (callState.status === 'connected') return formatDuration(duration);
    return '';
  };

  const isConnected = callState.status === 'connected';

  return (
    <div className="call-overlay" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="call-overlay-inner">
        {/* Status badge */}
        <div className={`call-badge-top ${callState.status}`}>
          {isConnected ? '🔴 LIVE' : '⏳ Connecting'}
        </div>

        {/* Avatar */}
        <div className="call-avatar-wrap">
          {!isConnected && (
            <>
              <div className="call-ripple r1" />
              <div className="call-ripple r2" />
            </>
          )}
          <div
            className="call-avatar-main"
            style={{ background: callState.remoteAvatarColor || '#00d4ff' }}
          >
            {callState.remoteAvatarInitial || callState.remoteEmail?.[0]?.toUpperCase() || '?'}
          </div>
        </div>

        {/* Info */}
        <div className="call-person-info">
          <div className="call-person-name">
            {callState.remoteUsername || callState.remoteEmail?.split('@')[0]}
          </div>
          <div className="call-person-email">{callState.remoteEmail}</div>
          <div className={`call-duration ${isConnected ? 'active' : 'pending'}`}>
            {getStatusText()}
          </div>
        </div>

        {/* Controls */}
        <div className="call-controls">
          {isConnected && (
            <button
              className={`ctrl-btn ${muted ? 'active-ctrl' : ''}`}
              onClick={() => setMuted(m => !m)}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? '🔇' : '🎙️'}
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>
          )}

          <div className="ctrl-center">
            <button className="btn-end" onClick={endCall} title="End call">
              📵
            </button>
            <span className="ctrl-end-label">End Call</span>
          </div>

          {isConnected && (
            <button className="ctrl-btn" title="Speaker">
              🔊
              <span>Speaker</span>
            </button>
          )}
        </div>

        {/* Security note + block button */}
        <div className="call-security-note">
          🔒 End-to-end encrypted · No recording
        </div>
        {isConnected && (
          <button
            className="call-block-btn"
            onClick={handleBlockDuringCall}
            title="Block this user and end call"
          >
            🚫 Block & End Call
          </button>
        )}
      </div>
    </div>
  );
};

export default ActiveCallOverlay;
