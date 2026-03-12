# 📞 GmailCall — Secure Gmail-to-Gmail Voice Calling

A full-stack WebRTC voice calling platform that lets Gmail users call each other securely over the internet. Features OTP authentication, automatic email call notifications, and end-to-end encrypted calls.

---

## 🏗️ Project Structure

```
gmailcall/
├── backend/
│   ├── server.js              # Express + Socket.io server
│   ├── routes/
│   │   └── auth.js            # OTP request, verify, logout, /me
│   ├── services/
│   │   └── emailService.js    # Nodemailer: OTP + call notifications
│   ├── package.json
│   └── .env.example           # Copy to .env and fill in values
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js             # Root component + page routing
    │   ├── index.js           # React entry
    │   ├── index.css          # Global design system + CSS vars
    │   ├── context/
    │   │   ├── AuthContext.js # User auth state (token, user)
    │   │   └── SocketContext.js # Socket.io + WebRTC call logic
    │   ├── pages/
    │   │   ├── LoginPage.js/css    # Gmail entry
    │   │   ├── OTPPage.js/css      # 6-digit OTP verification
    │   │   ├── DashboardPage.js/css # Call initiation + status
    │   │   └── ProfilePage.js/css  # User profile + security info
    │   └── components/
    │       ├── Navbar.js/css             # Top nav bar
    │       ├── IncomingCallModal.js/css  # Incoming call popup
    │       └── ActiveCallOverlay.js/css  # Full-screen call UI
    └── package.json
```

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 OTP Authentication | 6-digit code sent to Gmail, auto-expires in 10 min |
| 📞 WebRTC Voice Calls | Peer-to-peer, encrypted, no server relay |
| 📧 Call Notifications | Email sent to receiver even if not registered |
| 🟢 Online Status | Real-time online/offline indicator per user |
| 📵 Incoming Call UI | Animated popup with accept/reject buttons |
| 🔴 Active Call Screen | Live timer, mute, end call controls |
| 🛡️ Privacy First | No recordings, no call history, sessions auto-deleted |
| 📱 Responsive | Works on mobile and desktop |

---

## ⚙️ Prerequisites

- **Node.js** v18+ ([download](https://nodejs.org))
- **npm** v9+
- **A Gmail account** with App Password enabled (for sending emails)

---

## 🔑 Step 1: Gmail App Password Setup

> ⚠️ You MUST use an App Password — NOT your regular Gmail password.

1. Go to [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (if not already on)
3. Search for **"App passwords"** in the search bar
4. Click **App passwords**
5. Select app: **Mail** → Select device: **Other (custom name)** → type `GmailCall`
6. Click **Generate** — copy the 16-character password shown
7. Use this in your `.env` as `EMAIL_PASS`

---

## 🚀 Step 2: Backend Setup

```bash
# Navigate to backend folder
cd gmailcall/backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Edit `.env` with your values:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Your Gmail address
EMAIL_USER=your-actual-gmail@gmail.com

# The 16-char App Password from Step 1 (no spaces)
EMAIL_PASS=abcdabcdabcdabcd

OTP_EXPIRY_MINUTES=10
SESSION_SECRET=pick-a-long-random-string-here
```

### Start the backend:

```bash
# Development mode (auto-restarts on file changes)
npm run dev

# OR production mode
npm start
```

✅ You should see:
```
🚀 GmailCall Server running on port 5000
📡 Frontend URL: http://localhost:3000
📧 Email: your-gmail@gmail.com
✅ Ready to accept connections
```

---

## 🎨 Step 3: Frontend Setup

```bash
# Open a NEW terminal tab/window
cd gmailcall/frontend

# Install dependencies
npm install

# Start the React dev server
npm start
```

✅ React will open at `http://localhost:3000`

---

## 🧪 Step 4: Testing the Full Flow

### Test OTP Login:
1. Open `http://localhost:3000`
2. Enter a **real Gmail address** that you have access to
3. Click **Send Verification Code**
4. Check that Gmail inbox — you'll get a stylized OTP email
5. Enter the 6-digit code (or paste it — auto-submits!)
6. You're in the dashboard ✅

### Test Gmail-to-Gmail Calling:
1. Open **two separate browser windows** (or use incognito for the second)
2. Log in with **User A's Gmail** in window 1
3. Log in with **User B's Gmail** in window 2
4. In window 1, type User B's Gmail and click **Start Voice Call**
5. Allow microphone access in both browsers when prompted
6. Window 2 shows the **incoming call popup** with Accept/Reject
7. Click **Accept** in window 2
8. Both users are now connected in a live voice call ✅

### Test Call Notification Email:
1. Call a Gmail address that is NOT logged in / offline
2. The system automatically sends them an email notification
3. Check the receiver's inbox — they'll get a styled call notification
4. The caller sees "offline — email notification sent" ✅

---

## 🔧 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Backend port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `FRONTEND_URL` | Yes | React app URL (CORS) |
| `EMAIL_USER` | Yes | Your Gmail address |
| `EMAIL_PASS` | Yes | Gmail App Password (16 chars) |
| `OTP_EXPIRY_MINUTES` | No | OTP validity period (default: 10) |
| `SESSION_SECRET` | Yes | Random secret string for tokens |

---

## 🔒 Security Features

- **WebRTC DTLS/SRTP**: All audio is encrypted in transit at the protocol level
- **OTP Brute-force Protection**: Max 5 attempts, then OTP is invalidated
- **OTP Rate Limiting**: Can only request new OTP every 60 seconds
- **Token Expiry**: Auth tokens auto-expire after 24 hours
- **No Persistent Storage**: Call sessions deleted on end/disconnect
- **No Recordings**: Audio streams are never written to disk
- **CORS Restricted**: Backend only accepts requests from configured frontend URL

---

## 🌐 Production Deployment Notes

For deploying to production:

1. **Backend**: Deploy to Railway, Render, Fly.io, or a VPS
2. **Frontend**: Deploy to Vercel, Netlify, or Cloudflare Pages
3. **HTTPS Required**: WebRTC requires HTTPS in production browsers
4. **Update `.env`**:
   ```env
   FRONTEND_URL=https://your-frontend.vercel.app
   NODE_ENV=production
   ```
5. **Update `frontend/.env`** (create this file):
   ```env
   REACT_APP_BACKEND_URL=https://your-backend.railway.app
   ```
6. **TURN Server**: For calls behind strict NATs, add a TURN server to `ICE_SERVERS` in `SocketContext.js`. Free option: [Metered TURN](https://www.metered.ca/tools/openrelay/)

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| "Connection error" on OTP | Make sure backend is running on port 5000 |
| OTP email not arriving | Check spam folder; verify App Password in `.env` |
| "Email sending failed" | Re-generate App Password; make sure 2FA is enabled |
| Microphone not working | Allow mic permission in browser; check OS permissions |
| Call doesn't connect | Both users must be on the same network or have TURN configured |
| CORS error | Ensure `FRONTEND_URL` in backend `.env` matches your React URL |

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Create React App) |
| Styling | Pure CSS with CSS Variables |
| Real-time | Socket.io client |
| Voice Calls | WebRTC (browser native API) |
| Backend | Node.js + Express |
| Signaling | Socket.io server |
| Email | Nodemailer + Gmail SMTP |
| Auth | OTP via email + UUID tokens |
| Storage | In-memory (Map) — no database needed |

---

## 📝 License

MIT — Free to use and modify.
