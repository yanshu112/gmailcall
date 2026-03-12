// ============================================
// pages/ProfilePage.js
// User profile + Block List + Approved Callers management
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Navbar from '../components/Navbar';
import './ProfilePage.css';

const ProfilePage = ({ onBack }) => {
  const { user, logout } = useAuth();
  const { connected, blockUser } = useSocket();
  const [activeTab, setActiveTab] = useState('profile'); // profile|blocked|approved
  const [blockedList, setBlockedList] = useState([]);
  const [approvedList, setApprovedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const token = localStorage.getItem('gc_token');

  const fetchBlockedList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/safety/blocked`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setBlockedList(data.blocked);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  const fetchApprovedList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/safety/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setApprovedList(data.approved);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (activeTab === 'blocked') fetchBlockedList();
    if (activeTab === 'approved') fetchApprovedList();
  }, [activeTab, fetchBlockedList, fetchApprovedList]);

  const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3500); };

  const handleUnblock = async (email) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/safety/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetEmail: email }),
      });
      setBlockedList(prev => prev.filter(u => u.email !== email));
      showMsg(`✅ ${email} has been unblocked.`);
    } catch (e) { console.error(e); }
  };

  const handleRevokePermission = async (email) => {
    if (!window.confirm(`Revoke call permission for ${email}?\nThey will need to send a new request to call you.`)) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/safety/permissions/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetEmail: email }),
      });
      setApprovedList(prev => prev.filter(u => u.email !== email));
      showMsg(`🔒 Permission revoked for ${email}.`);
    } catch (e) { console.error(e); }
  };

  const handleBlockFromApproved = async (email) => {
    if (!window.confirm(`Block ${email}?\nThis also revokes their call permission.`)) return;
    blockUser(email);
    await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/safety/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetEmail: email }),
    });
    setApprovedList(prev => prev.filter(u => u.email !== email));
    showMsg(`🚫 ${email} has been blocked.`);
    // Refresh blocked list if on that tab
    if (activeTab === 'blocked') fetchBlockedList();
  };

  if (!user) return null;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'blocked', label: 'Blocked', icon: '🚫' },
    { id: 'approved', label: 'Approved', icon: '✅' },
  ];

  return (
    <div className="dashboard-layout">
      <Navbar onProfileClick={onBack} />

      <main className="profile-main">
        <div className="profile-container" style={{ animation: 'fadeInUp 0.4s ease' }}>
          <button className="btn btn-ghost back-btn" onClick={onBack}>← Back to Dashboard</button>

          {/* Tabs */}
          <div className="profile-tabs card glass">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Action message */}
          {actionMsg && <div className="action-msg">{actionMsg}</div>}

          {/* ── PROFILE TAB ─────────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <>
              <div className="profile-header card glass">
                <div className="profile-avatar-wrap">
                  <div className="profile-avatar" style={{ background: user.avatarColor }}>
                    {user.avatarInitial}
                  </div>
                  <div className={`profile-status-badge ${connected ? 'online' : 'offline'}`}>
                    {connected ? '🟢' : '⚫'}
                  </div>
                </div>
                <div className="profile-info">
                  <h2 className="profile-username">{user.username}</h2>
                  <div className="profile-email">{user.email}</div>
                  <div className="profile-status-text">{connected ? 'Online · Available for calls' : 'Offline'}</div>
                </div>
              </div>

              <div className="profile-details card glass">
                <h3 className="section-title">Account Details</h3>
                <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value mono">{user.email}</span></div>
                <div className="detail-row"><span className="detail-label">Username</span><span className="detail-value">@{user.username}</span></div>
                <div className="detail-row">
                  <span className="detail-label">Member since</span>
                  <span className="detail-value">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Today'}</span>
                </div>
                <div className="detail-row"><span className="detail-label">Auth</span><span className="detail-value">🔐 OTP Verified</span></div>
              </div>

              <div className="security-card card glass">
                <h3 className="section-title">🛡️ Privacy & Security</h3>
                <div className="security-items">
                  {[
                    ['🔒', 'End-to-end encrypted', 'All calls use WebRTC encryption'],
                    ['✋', 'Permission required', 'New callers need your approval first'],
                    ['🚫', 'Block system', 'Blocked users can never reach you'],
                    ['🗑️', 'Auto-delete sessions', 'No call history stored'],
                    ['📵', 'No recordings', 'Audio never written to disk'],
                  ].map(([icon, title, desc]) => (
                    <div className="security-item" key={title}>
                      <span className="security-icon">{icon}</span>
                      <div><div className="security-title">{title}</div><div className="security-desc">{desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="btn logout-btn" onClick={logout}>🚪 Sign out of GmailCall</button>
            </>
          )}

          {/* ── BLOCKED TAB ─────────────────────────────────────────────── */}
          {activeTab === 'blocked' && (
            <div className="safety-tab-content card glass">
              <div className="tab-header">
                <div>
                  <h3>Blocked Users</h3>
                  <p>Blocked users cannot send call requests or call you.</p>
                </div>
                <span className="tab-count">{blockedList.length}</span>
              </div>

              {loading ? (
                <div className="tab-loading"><span className="spinner" /> Loading...</div>
              ) : blockedList.length === 0 ? (
                <div className="tab-empty">
                  <div className="empty-icon">🚫</div>
                  <div>No blocked users</div>
                  <div className="empty-sub">You haven't blocked anyone yet.</div>
                </div>
              ) : (
                <div className="safety-user-list">
                  {blockedList.map(u => (
                    <div className="safety-user-item" key={u.email}>
                      <div className="safety-avatar" style={{ background: u.avatarColor }}>
                        {u.avatarInitial}
                      </div>
                      <div className="safety-user-info">
                        <div className="safety-user-name">{u.username}</div>
                        <div className="safety-user-email">{u.email}</div>
                      </div>
                      <div className="safety-user-actions">
                        <button className="safety-btn unblock-btn" onClick={() => handleUnblock(u.email)}>
                          ✅ Unblock
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── APPROVED TAB ────────────────────────────────────────────── */}
          {activeTab === 'approved' && (
            <div className="safety-tab-content card glass">
              <div className="tab-header">
                <div>
                  <h3>Approved Callers</h3>
                  <p>These users have permission to call you directly.</p>
                </div>
                <span className="tab-count">{approvedList.length}</span>
              </div>

              {loading ? (
                <div className="tab-loading"><span className="spinner" /> Loading...</div>
              ) : approvedList.length === 0 ? (
                <div className="tab-empty">
                  <div className="empty-icon">✅</div>
                  <div>No approved callers yet</div>
                  <div className="empty-sub">When you accept a call request, the caller appears here.</div>
                </div>
              ) : (
                <div className="safety-user-list">
                  {approvedList.map(u => (
                    <div className="safety-user-item" key={u.email}>
                      <div className="safety-avatar" style={{ background: u.avatarColor }}>
                        {u.avatarInitial}
                      </div>
                      <div className="safety-user-info">
                        <div className="safety-user-name">{u.username}</div>
                        <div className="safety-user-email">{u.email}</div>
                      </div>
                      <div className="safety-user-actions">
                        <button className="safety-btn revoke-btn" onClick={() => handleRevokePermission(u.email)} title="Revoke call permission">
                          🔒 Revoke
                        </button>
                        <button className="safety-btn block-btn-sm" onClick={() => handleBlockFromApproved(u.email)} title="Block this user">
                          🚫
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
