// ============================================
// components/IncomingCallModal.js
// Incoming call popup with accept/reject
// ============================================

import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import './IncomingCallModal.css';

const IncomingCallModal = () => {
  const { callState, acceptCall, rejectCall } = useSocket();
  const [elapsed, setElapsed] = useState(0);

  // Ringing timer (shows "ringing for Xs")
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="incoming-modal glass" style={{ animation: 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        {/* Ripple animation */}
        <div className="ripple-wrap">
          <div className="ripple r1" />
          <div className="ripple r2" />
          <div className="ripple r3" />
          <div
            className="caller-avatar-incoming"
            style={{ background: callState.remoteAvatarColor || '#00d4ff' }}
          >
            {callState.remoteAvatarInitial || callState.remoteEmail?.[0]?.toUpperCase() || '?'}
          </div>
        </div>

        <div className="incoming-info">
          <div className="incoming-label">Incoming Voice Call</div>
          <div className="incoming-caller">{callState.remoteUsername || callState.remoteEmail?.split('@')[0]}</div>
          <div className="incoming-email">{callState.remoteEmail}</div>
          <div className="incoming-timer">Ringing for {elapsed}s</div>
        </div>

        <div className="incoming-actions">
          <div className="action-group">
            <button className="action-btn reject" onClick={rejectCall}>
              📵
            </button>
            <span className="action-label">Decline</span>
          </div>
          <div className="action-group">
            <button className="action-btn accept" onClick={acceptCall}>
              📞
            </button>
            <span className="action-label">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
