import '../config/env.js';
import nodemailer from 'nodemailer';

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

export async function sendOTPEmail(to, code) {
  const t = getTransporter();

  if (!t) {
    // Dev fallback — log OTP to console when SMTP is not configured
    console.log(`\n📧 [OTP] ${to} → ${code}\n`);
    return;
  }

  await t.sendMail({
    from: `"FinScope Security" <${process.env.SMTP_USER}>`,
    to,
    subject: 'FinScope — Verification Code',
    html: `
      <div style="background:#0f172a;padding:40px 32px;font-family:system-ui,sans-serif;
                  border-radius:12px;max-width:460px;margin:0 auto">
        <h2 style="color:#3b82f6;margin:0 0 4px;font-size:22px">FinScope</h2>
        <p style="color:#64748b;margin:0 0 28px;font-size:13px">Security Verification</p>
        <p style="color:#e2e8f0;font-size:15px;margin:0 0 20px">Your verification code:</p>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;
                    padding:28px;text-align:center;margin:0 0 24px">
          <span style="color:#3b82f6;font-size:42px;font-weight:900;
                       letter-spacing:16px;font-family:monospace">${code}</span>
        </div>
        <p style="color:#475569;font-size:13px;margin:0 0 8px">
          This code expires in <strong style="color:#94a3b8">5 minutes</strong>.
        </p>
        <p style="color:#334155;font-size:12px;margin:0">
          If you did not request this, please review your account security immediately.
        </p>
      </div>
    `,
  });
}

export default { sendOTPEmail };
