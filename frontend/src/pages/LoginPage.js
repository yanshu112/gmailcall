// ============================================
// pages/LoginPage.js
// Gmail address entry + OTP request
// ============================================

import React, { useState } from 'react';
import './LoginPage.css';

const LoginPage = ({ onOTPSent }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.toLowerCase().endsWith('@gmail.com')) {
      setError('Please enter a valid Gmail address (must end in @gmail.com)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const data = await res.json();

      if (data.success) {
        onOTPSent(email.toLowerCase().trim());
      } else {
        setError(data.message || 'Failed to send OTP. Try again.');
      }
    } catch {
      setError('Connection error. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page login-page">
      {/* Background grid */}
      <div className="login-grid" aria-hidden="true" />

      <div className="login-container" style={{ animation: 'fadeInUp 0.5s ease forwards' }}>
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="url(#grad)" strokeWidth="2"/>
              <path d="M10 12l6 5 6-5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 20V12l8 7 8-7v8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="logo-name">GmailCall</h1>
            <p className="logo-tagline">Secure Gmail-to-Gmail Voice Calls</p>
          </div>
        </div>

        {/* Card */}
        <div className="login-card card glass">
          <div className="login-card-header">
            <h2>Sign in to continue</h2>
            <p>Enter your Gmail address to receive a verification code</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">Gmail Address</label>
              <div className="input-wrapper">
                <span className="input-icon">✉️</span>
                <input
                  id="email"
                  type="email"
                  className="input-field"
                  placeholder="yourname@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  style={{ paddingLeft: '44px' }}
                />
              </div>
            </div>

            {error && (
              <div className="error-banner">
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading || !email}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Sending OTP...
                </>
              ) : (
                <>
                  Send Verification Code →
                </>
              )}
            </button>
          </form>

          <div className="login-features">
            <div className="feature-item">
              <span>🔐</span>
              <span>End-to-end encrypted calls</span>
            </div>
            <div className="feature-item">
              <span>🌐</span>
              <span>Works over any Wi-Fi or internet</span>
            </div>
            <div className="feature-item">
              <span>🚫</span>
              <span>No recordings stored</span>
            </div>
          </div>
        </div>

        <p className="login-footer-text">
          By signing in, you agree to our terms of service
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
