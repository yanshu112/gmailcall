// ============================================
// services/emailService.js
// OTP emails, live call notifications, call request emails
// ============================================

const nodemailer = require('nodemailer');

const createTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  secure: true,
});

// ─── OTP Email ─────────────────────────────────────────────────────────────────
const sendOTPEmail = async (toEmail, otp) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"GmailCall" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 Your GmailCall Verification Code',
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body{font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0f;margin:0}
      .c{max-width:520px;margin:40px auto;background:#12121a;border-radius:16px;border:1px solid #1e1e2e}
      .h{background:linear-gradient(135deg,#00d4ff,#7c3aed);padding:32px;text-align:center}
      .h h1{color:#fff;margin:0;font-size:28px}.h p{color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px}
      .b{padding:40px 32px}.otp{background:#1a1a2e;border:2px solid #00d4ff;border-radius:12px;text-align:center;padding:28px;margin:24px 0}
      .code{font-size:48px;font-weight:800;letter-spacing:12px;color:#00d4ff;font-family:monospace}
      .lbl{color:#6b7280;font-size:13px;margin-top:8px}.info{color:#9ca3af;font-size:14px;line-height:1.6}
      .warn{background:#1f1620;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:20px 0;color:#f59e0b;font-size:13px}
      .f{padding:20px 32px;border-top:1px solid #1e1e2e;text-align:center;color:#4b5563;font-size:12px}
    </style></head><body><div class="c">
      <div class="h"><h1>📞 GmailCall</h1><p>Secure Gmail-to-Gmail Voice Calling</p></div>
      <div class="b">
        <p class="info">Your verification code for <strong style="color:#00d4ff">GmailCall</strong>:</p>
        <div class="otp"><div class="code">${otp}</div><div class="lbl">Expires in ${process.env.OTP_EXPIRY_MINUTES||10} minutes</div></div>
        <div class="warn">⚠️ Never share this code with anyone.</div>
      </div>
      <div class="f">© ${new Date().getFullYear()} GmailCall · If you didn't request this, ignore it.</div>
    </div></body></html>`
  });
  console.log(`✅ OTP sent to ${toEmail}`);
  return { success: true };
};

// ─── Live Call Notification Email ──────────────────────────────────────────────
const sendCallNotificationEmail = async (callerEmail, receiverEmail) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"GmailCall" <${process.env.EMAIL_USER}>`,
      to: receiverEmail,
      subject: `📞 Incoming call from ${callerEmail} on GmailCall`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body{font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0f;margin:0}
        .c{max-width:520px;margin:40px auto;background:#12121a;border-radius:16px;border:1px solid #1e1e2e}
        .h{background:linear-gradient(135deg,#10b981,#0891b2);padding:32px;text-align:center}
        .h h1{color:#fff;margin:0;font-size:28px}.badge{background:rgba(255,255,255,.15);border-radius:50px;display:inline-block;padding:6px 18px;margin-top:10px;color:#fff;font-size:13px}
        .b{padding:40px 32px}.card{background:#1a1a2e;border:1px solid #10b981;border-radius:12px;padding:24px;text-align:center;margin:20px 0}
        .name{color:#f9fafb;font-size:22px;font-weight:700}.email{color:#6b7280;font-size:14px;margin-top:4px}
        .info{color:#9ca3af;font-size:14px;line-height:1.7}
        .cta{background:linear-gradient(135deg,#10b981,#0891b2);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;display:inline-block;margin:20px 0;font-weight:600;font-size:16px}
        .f{padding:20px 32px;border-top:1px solid #1e1e2e;text-align:center;color:#4b5563;font-size:12px}
      </style></head><body><div class="c">
        <div class="h"><h1>📞 Incoming Call</h1><div class="badge">🔴 LIVE · GmailCall</div></div>
        <div class="b">
          <div class="card"><div class="name">${callerEmail.split('@')[0]}</div><div class="email">${callerEmail}</div></div>
          <p class="info"><strong style="color:#f9fafb">${callerEmail}</strong> is calling you on GmailCall.</p>
          <div style="text-align:center"><a href="${process.env.FRONTEND_URL||'http://localhost:3000'}" class="cta">Open GmailCall →</a></div>
        </div>
        <div class="f">© ${new Date().getFullYear()} GmailCall · No recordings stored.</div>
      </div></body></html>`
    });
    console.log(`✅ Call notification sent to ${receiverEmail}`);
    return { success: true };
  } catch (e) {
    console.error('Call notification failed:', e.message);
    return { success: false };
  }
};

// ─── Call REQUEST Email (permission system) ─────────────────────────────────────
const sendCallRequestEmail = async (callerEmail, receiverEmail) => {
  try {
    const transporter = createTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    await transporter.sendMail({
      from: `"GmailCall" <${process.env.EMAIL_USER}>`,
      to: receiverEmail,
      subject: `🔔 ${callerEmail} wants permission to call you on GmailCall`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body{font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0f;margin:0}
        .c{max-width:520px;margin:40px auto;background:#12121a;border-radius:16px;border:1px solid #1e1e2e}
        .h{background:linear-gradient(135deg,#7c3aed,#00d4ff);padding:32px;text-align:center}
        .h h1{color:#fff;margin:0;font-size:26px}.badge{background:rgba(255,255,255,.15);border-radius:50px;display:inline-block;padding:6px 18px;margin-top:10px;color:#fff;font-size:13px}
        .b{padding:40px 32px}.card{background:#1a1a2e;border:1px solid rgba(124,58,237,0.4);border-radius:12px;padding:24px;text-align:center;margin:20px 0}
        .name{color:#f9fafb;font-size:22px;font-weight:700}.email{color:#6b7280;font-size:14px;margin-top:4px;font-family:monospace}
        .info{color:#9ca3af;font-size:14px;line-height:1.7}
        .acts{display:flex;gap:12px;justify-content:center;margin:24px 0;flex-wrap:wrap}
        .btn-a{background:linear-gradient(135deg,#10b981,#0891b2);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;display:inline-block;font-weight:700;font-size:15px}
        .btn-o{background:rgba(255,255,255,0.05);color:#d1d5db;text-decoration:none;padding:12px 28px;border-radius:8px;display:inline-block;font-weight:600;font-size:15px;border:1px solid rgba(255,255,255,0.1)}
        .sec{background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.15);border-radius:8px;padding:14px;margin-top:20px;font-size:13px;color:#9ca3af}
        .f{padding:20px 32px;border-top:1px solid #1e1e2e;text-align:center;color:#4b5563;font-size:12px}
      </style></head><body><div class="c">
        <div class="h"><h1>📋 Call Permission Request</h1><div class="badge">✋ Approval Required · GmailCall</div></div>
        <div class="b">
          <p class="info">Someone wants permission to call you on <strong style="color:#00d4ff">GmailCall</strong>:</p>
          <div class="card">
            <div style="font-size:40px;margin-bottom:12px">👤</div>
            <div class="name">${callerEmail.split('@')[0]}</div>
            <div class="email">${callerEmail}</div>
          </div>
          <p class="info">GmailCall requires your approval before anyone can call you. Accept to allow calls from this person, or ignore/reject to decline.</p>
          <div class="acts">
            <a href="${frontendUrl}" class="btn-a">✅ Review in GmailCall</a>
            <a href="${frontendUrl}" class="btn-o">Open App</a>
          </div>
          <div class="sec">🔒 You're always in control. You can block anyone and revoke permissions at any time.</div>
        </div>
        <div class="f">
          <p>© ${new Date().getFullYear()} GmailCall · You received this because ${callerEmail} wants to call you.</p>
          <p>Open GmailCall to manage this request and your safety settings.</p>
        </div>
      </div></body></html>`
    });
    console.log(`✅ Call request email sent to ${receiverEmail}`);
    return { success: true };
  } catch (e) {
    console.error('Call request email failed:', e.message);
    return { success: false };
  }
};

module.exports = { sendOTPEmail, sendCallNotificationEmail, sendCallRequestEmail };
