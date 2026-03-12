// ============================================
// components/CallRequestsPanel.js
// Shows incoming call permission requests with accept/reject
// ============================================

import React from 'react';
import { useSocket } from '../context/SocketContext';
import './CallRequestsPanel.css';

const CallRequestsPanel = () => {
  const { callRequests, respondToCallRequest, blockUser } = useSocket();

  if (callRequests.length === 0) return null;

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="requests-panel card glass" style={{ animation: 'fadeInUp 0.4s ease' }}>
      <div className="requests-header">
        <div className="requests-title">
          <span className="requests-badge">{callRequests.length}</span>
          <h3>Call Permission Requests</h3>
        </div>
        <p className="requests-subtitle">These users want permission to call you</p>
      </div>

      <div className="requests-list">
        {callRequests.map((req) => (
          <div className="request-item" key={req.requestId}>
            <div className="request-avatar" style={{ background: req.callerAvatarColor }}>
              {req.callerAvatarInitial}
            </div>

            <div className="request-info">
              <div className="request-name">{req.callerUsername}</div>
              <div className="request-email">{req.callerEmail}</div>
              <div className="request-time">{formatTime(req.createdAt)}</div>
            </div>

            <div className="request-actions">
              <button
                className="req-btn req-accept"
                onClick={() => respondToCallRequest(req.requestId, 'accept')}
                title="Allow this user to call you"
              >
                ✅ Allow
              </button>
              <button
                className="req-btn req-reject"
                onClick={() => respondToCallRequest(req.requestId, 'reject')}
                title="Decline this call request"
              >
                ✕ Decline
              </button>
              <button
                className="req-btn req-block"
                onClick={() => {
                  if (window.confirm(`Block ${req.callerEmail}? They won't be able to send requests again.`)) {
                    blockUser(req.callerEmail);
                  }
                }}
                title="Block this user"
              >
                🚫 Block
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CallRequestsPanel;
