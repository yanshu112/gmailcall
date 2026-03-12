// ============================================
// pages/DashboardPage.js
// Dashboard with Call, Safety requests, Block button
// ============================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import IncomingCallModal from '../components/IncomingCallModal';
import ActiveCallOverlay from '../components/ActiveCallOverlay';
import CallRequestsPanel from '../components/CallRequestsPanel';
import RequestNotificationToast from '../components/RequestNotificationToast';
import Navbar from '../components/Navbar';
import './DashboardPage.css';

const DashboardPage = ({ onProfileClick }) => {
  const { user } = useAuth();
  const { connected, callState, startCall, checkUserOnline, blockUser, callRequests } = useSocket();
  const [targetEmail, setTargetEmail] = useState('');
  const [targetStatus, setTargetStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [callError, setCallError] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [blockSuccess, setBlockSuccess] = useState('');

  const isInCall = ['calling', 'ringing', 'connected'].includes(callState.status);
  const validTarget = targetEmail && targetEmail.toLowerCase().endsWith('@gmail.com') &&
                      targetEmail.toLowerCase().trim() !== user?.email;

  // Live check of target's online status
  useEffect(() => {
    if (!validTarget) { setTargetStatus(null); return; }
    const t = setTimeout(async () => {
      setChecking(true);
      const online = await checkUserOnline(targetEmail.toLowerCase().trim());
      setTargetStatus(online ? 'online' : 'offline');
      setChecking(false);
    }, 800);
    return () => clearTimeout(t);
  }, [targetEmail, checkUserOnline, validTarget]);

  const handleCall = () => {
    setCallError('');
    if (!validTarget) {
      setCallError('Please enter a valid Gmail address (different from yours).');
      return;
    }
    startCall(targetEmail.toLowerCase().trim());
  };

  const handleBlock = async () => {
    if (!validTarget) return;
    const target = targetEmail.toLowerCase().trim();
    if (!window.confirm(`Block ${target}?\n\nThey won't be able to send call requests or call you.`)) return;
    setBlocking(true);
    try {
      blockUser(target); // via socket
      // Also persist via REST
      const token = localStorage.getItem('gc_token');
      await fetch('/api/safety/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetEmail: target }),
      });
      setBlockSuccess(`${target} has been blocked.`);
      setTimeout(() => setBlockSuccess(''), 4000);
      setTargetEmail('');
      setTargetStatus(null);
    } catch (e) {
      console.error('Block error:', e);
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Navbar onProfileClick={onProfileClick} />

      <main className="dashboard-main">
        {/* Welcome */}
        <div className="dashboard-hero" style={{ animation: 'fadeInUp 0.4s ease' }}>
          <div className="user-welcome">
            <div className="user-avatar-lg" style={{ background: user?.avatarColor }}>
              {user?.avatarInitial}
            </div>
            <div>
              <h2 className="welcome-title">
                Good {getTimeOfDay()}, <span className="gradient-text">{user?.username}</span>
              </h2>
              <div className="connection-badge">
                <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
                <span>{connected ? 'Connected · Ready to call' : 'Connecting...'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Call Requests Panel */}
        {callRequests.length > 0 && (
          <CallRequestsPanel />
        )}

        {/* Block success toast */}
        {blockSuccess && (
          <div className="info-banner success-banner">🚫 {blockSuccess}</div>
        )}

        {/* Call Card */}
        <div className="call-card card glass" style={{ animation: 'fadeInUp 0.5s ease 0.1s both' }}>
          <div className="call-card-header">
            <div className="call-card-icon">📞</div>
            <div>
              <h3>New Voice Call</h3>
              <p>Enter a Gmail address — approval required on first call</p>
            </div>
          </div>

          <div className="call-input-section">
            <div className="input-wrapper">
              <span className="input-icon">✉️</span>
              <input
                type="email"
                className="input-field"
                placeholder="recipient@gmail.com"
                value={targetEmail}
                onChange={e => { setTargetEmail(e.target.value); setCallError(''); }}
                disabled={isInCall}
                style={{ paddingLeft: '44px', paddingRight: targetStatus ? '110px' : '16px' }}
                onKeyDown={e => e.key === 'Enter' && !isInCall && handleCall()}
              />
              {validTarget && (
                <div className="target-status-badge">
                  {checking ? (
                    <span className="checking">checking...</span>
                  ) : targetStatus === 'online' ? (
                    <span className="status-online">🟢 Online</span>
                  ) : targetStatus === 'offline' ? (
                    <span className="status-offline">⚫ Offline</span>
                  ) : null}
                </div>
              )}
            </div>

            {callError && <div className="error-banner">⚠️ {callError}</div>}

            {callState.status === 'ended' && callState.endReason && (
              <div className={`info-banner ${callState.endReason.includes('not available') || callState.endReason.includes('blocked') || callState.endReason.includes('declined') ? 'warn-banner' : ''}`}>
                ℹ️ {callState.endReason}
              </div>
            )}

            <div className="call-action-row">
              <button
                className="btn btn-primary call-btn"
                onClick={handleCall}
                disabled={isInCall || !connected || !validTarget}
              >
                {isInCall ? (
                  <><span className="status-dot calling" /> {getCallStatusLabel(callState.status)}</>
                ) : (
                  <>📞 Call</>
                )}
              </button>

              {validTarget && !isInCall && (
                <button
                  className="btn btn-block-inline"
                  onClick={handleBlock}
                  disabled={blocking}
                  title={`Block ${targetEmail}`}
                >
                  🚫 Block
                </button>
              )}
            </div>
          </div>

          {isInCall && (
            <div className="call-progress">
              <CallStatusBar status={callState.status} remoteEmail={callState.remoteEmail} />
            </div>
          )}
        </div>

        {/* Info card explaining the permission system */}
        <div className="safety-info-card card glass" style={{ animation: 'fadeInUp 0.5s ease 0.2s both' }}>
          <div className="safety-info-title">🛡️ How Call Safety Works</div>
          <div className="safety-info-steps">
            <div className="safety-step">
              <span className="step-num">1</span>
              <div>
                <strong>First call = Permission request</strong>
                <span>User B receives a request to approve before you can call them</span>
              </div>
            </div>
            <div className="safety-step">
              <span className="step-num">2</span>
              <div>
                <strong>After approval</strong>
                <span>You can call them directly any time they're online</span>
              </div>
            </div>
            <div className="safety-step">
              <span className="step-num">3</span>
              <div>
                <strong>Block anytime</strong>
                <span>Blocked users cannot send requests or call you. Manage in Profile</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row" style={{ animation: 'fadeInUp 0.5s ease 0.3s both' }}>
          <div className="stat-card card glass">
            <div className="stat-icon">🔒</div>
            <div className="stat-label">Security</div>
            <div className="stat-value">E2E Encrypted</div>
          </div>
          <div className="stat-card card glass">
            <div className="stat-icon">✋</div>
            <div className="stat-label">Access</div>
            <div className="stat-value">Permission-gated</div>
          </div>
          <div className="stat-card card glass">
            <div className="stat-icon">🚫</div>
            <div className="stat-label">Blocked</div>
            <div className="stat-value">Instant Block</div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {callState.status === 'ringing' && callState.direction === 'incoming' && <IncomingCallModal />}
      {['calling', 'connected', 'ringing'].includes(callState.status) && callState.direction === 'outgoing' && <ActiveCallOverlay />}
      {callState.status === 'connected' && callState.direction === 'incoming' && <ActiveCallOverlay />}

      <RequestNotificationToast />
    </div>
  );
};

const CallStatusBar = ({ status, remoteEmail }) => {
  const labels = { calling: `Calling ${remoteEmail}...`, ringing: `Ringing ${remoteEmail}...`, connected: `Connected with ${remoteEmail}` };
  return (
    <div className="call-status-bar">
      <div className={`call-status-dot ${status}`} />
      <span>{labels[status] || status}</span>
    </div>
  );
};

const getCallStatusLabel = (s) => ({ calling: 'Calling...', ringing: 'Ringing...', connected: 'In Call' }[s] || s);
const getTimeOfDay = () => { const h = new Date().getHours(); if (h < 12) return 'morning'; if (h < 17) return 'afternoon'; return 'evening'; };

export default DashboardPage;
