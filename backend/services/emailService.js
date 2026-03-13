const nodemailer = require('nodemailer');

const createTransporter = () => nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 2525,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendOTPEmail = async (email, otp) => {
  await createTransporter().sendMail({
    from: `GmailCall <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your GmailCall Verification Code',
    html: `<h2>Your OTP: <strong>${otp}</strong></h2><p>Expires in 10 minutes.</p>`
  });
};

const sendCallNotificationEmail = async (callerEmail, receiverEmail) => {
  await createTransporter().sendMail({
    from: `GmailCall <${process.env.EMAIL_USER}>`,
    to: receiverEmail,
    subject: `${callerEmail} is calling you`,
    html: `<p>${callerEmail} tried to call you on GmailCall.</p>`
  });
};

const sendCallRequestEmail = async (callerEmail, receiverEmail) => {
  await createTransporter().sendMail({
    from: `GmailCall <${process.env.EMAIL_USER}>`,
    to: receiverEmail,
    subject: `${callerEmail} wants to call you`,
    html: `<p>${callerEmail} has requested permission to call you on GmailCall.</p>`
  });
};

module.exports = { sendOTPEmail, sendCallNotificationEmail, sendCallRequestEmail };
