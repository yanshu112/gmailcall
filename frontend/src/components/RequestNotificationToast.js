// ============================================
// components/RequestNotificationToast.js
// Shows toast when our call request is accepted or rejected
// ============================================

import React from 'react';
import { useSocket } from '../context/SocketContext';
import './RequestNotificationToast.css';

const RequestNotificationToast = () => {
  const { requestNotification, setRequestNotification } = useSocket();

  if (!requestNotification) return null;

  const isAccepted = requestNotification.type === 'accepted';

  return (
    <div
      className={`req-toast ${isAccepted ? 'toast-accept' : 'toast-reject'}`}
      style={{ animation: 'slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
    >
      <div className="toast-icon">
        {isAccepted ? '✅' : '❌'}
      </div>
      <div className="toast-body">
        <div className="toast-title">
          {isAccepted ? 'Call Request Accepted!' : 'Call Request Declined'}
        </div>
        <div className="toast-msg">{requestNotification.message}</div>
      </div>
      <button
        className="toast-close"
        onClick={() => setRequestNotification(null)}
      >
        ✕
      </button>
    </div>
  );
};

export default RequestNotificationToast;
