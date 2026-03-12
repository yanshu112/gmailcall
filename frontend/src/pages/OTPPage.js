// ============================================
// pages/OTPPage.js
// 6-digit OTP entry with auto-advance inputs
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './OTPPage.css';

const OTPPage = ({ email, onBack }) => {
  const { login } = useAuth();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleDigitChange = (index, value) => {
    const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = sanitized;
    setDigits(newDigits);
    setError('');

    // Auto-advance to next input
    if (sanitized && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (sanitized && index === 5) {
      const full = [...newDigits.slice(0, 5), sanitized].join('');
      if (full.length === 6) verifyOTP(full);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      verifyOTP(pasted);
    }
  };

  const verifyOTP = async (code) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();

      if (data.success) {
        login(data.token, data.user);
      } else {
        setError(data.message || 'Incorrect code. Please try again.');
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setResendCooldown(60);
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(data.message);
      }
    } catch {
      setError('Failed to resend. Try again.');
    } finally {
      setResending(false);
    }
  };

  const otp = digits.join('');

  return (
    <div className="page otp-page">
      <div className="otp-container" style={{ animation: 'fadeInUp 0.5s ease forwards' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 40 }}>📧</span>
          <h1 className="logo-name" style={{ textAlign: 'center', marginTop: 8 }}>Check your inbox</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
            We sent a 6-digit code to<br />
            <strong style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: 15 }}>{email}</strong>
          </p>
        </div>

        <div className="otp-card card glass">
          {/* OTP inputs */}
          <div className="otp-inputs" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className={`otp-input ${d ? 'filled' : ''} ${error ? 'error' : ''}`}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading}
              />
            ))}
          </div>

          {error && (
            <div className="error-banner" style={{ marginTop: 12 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
              <span className="spinner" style={{ marginRight: 8 }} />
              Verifying your code...
            </div>
          )}

          <button
            className="btn btn-primary w-full"
            style={{ marginTop: 20 }}
            onClick={() => verifyOTP(otp)}
            disabled={otp.length !== 6 || loading}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <div className="otp-actions">
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Didn't receive it?</span>
            <button
              className="btn-link"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
            >
              {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>
        </div>

        <button className="btn btn-ghost" style={{ alignSelf: 'center' }} onClick={onBack}>
          ← Change email
        </button>
      </div>
    </div>
  );
};

export default OTPPage;
