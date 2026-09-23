const nodemailer = require("nodemailer");

// "to" defaults to ADMIN_EMAIL so existing calls (contact form alerts)
// keep working unchanged. Pass an explicit "to" to email a specific user
// (e.g. email verification links).
const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Raja Bus" <${process.env.EMAIL_USER}>`,
    to: to || process.env.ADMIN_EMAIL,
    subject,
    html,
  });
};

module.exports = sendEmail;
