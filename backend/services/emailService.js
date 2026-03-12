const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (email, otp) => {
  await resend.emails.send({
    from: 'GmailCall <onboarding@resend.dev>',
    to: email,
    subject: 'Your GmailCall Verification Code',
    html: `<h2>Your OTP: <strong>${otp}</strong></h2><p>Expires in 10 minutes.</p>`
  });
};

const sendCallNotificationEmail = async (callerEmail, receiverEmail) => {
  await resend.emails.send({
    from: 'GmailCall <onboarding@resend.dev>',
    to: receiverEmail,
    subject: `${callerEmail} is calling you`,
    html: `<p>${callerEmail} tried to call you on GmailCall.</p>`
  });
};

const sendCallRequestEmail = async (callerEmail, receiverEmail) => {
  await resend.emails.send({
    from: 'GmailCall <onboarding@resend.dev>',
    to: receiverEmail,
    subject: `${callerEmail} wants to call you`,
    html: `<p>${callerEmail} has requested permission to call you on GmailCall.</p>`
  });
};

module.exports = { sendOTPEmail, sendCallNotificationEmail, sendCallRequestEmail };
