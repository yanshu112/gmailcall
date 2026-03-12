const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendOTPEmail = async (email, otp) => {
  await sgMail.send({
    from: 'blocknex.0555@gmail.com',
    to: email,
    subject: 'Your GmailCall Verification Code',
    html: `<h2>Your OTP: <strong>${otp}</strong></h2><p>Expires in 10 minutes.</p>`
  });
};

const sendCallNotificationEmail = async (callerEmail, receiverEmail) => {
  await sgMail.send({
    from: 'blocknex.0555@gmail.com',
    to: receiverEmail,
    subject: `${callerEmail} is calling you`,
    html: `<p>${callerEmail} tried to call you on GmailCall.</p>`
  });
};

const sendCallRequestEmail = async (callerEmail, receiverEmail) => {
  await sgMail.send({
    from: 'blocknex.0555@gmail.com',
    to: receiverEmail,
    subject: `${callerEmail} wants to call you`,
    html: `<p>${callerEmail} has requested permission to call you on GmailCall.</p>`
  });
};

module.exports = { sendOTPEmail, sendCallNotificationEmail, sendCallRequestEmail };
