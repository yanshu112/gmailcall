// ============================================
// components/Navbar.js
// Top navigation bar
// ============================================

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './Navbar.css';

const Navbar = ({ onProfileClick }) => {
  const { user } = useAuth();
  const { connected } = useSocket();

  return (
    <nav className="navbar glass">
      <div className="navbar-inner">
        {/* Logo */}
        <div className="nav-logo">
          <div className="nav-logo-icon">📞</div>
          <span className="nav-logo-text">GmailCall</span>
        </div>

        {/* Right side */}
        <div className="nav-right">
          <div className="nav-connection">
            <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
            <span className="nav-connection-label">{connected ? 'Online' : 'Offline'}</span>
          </div>

          <button className="nav-avatar-btn" onClick={onProfileClick} title="View profile">
            <div className="nav-avatar" style={{ background: user?.avatarColor }}>
              {user?.avatarInitial}
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
