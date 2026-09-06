import nodemailer from "nodemailer";

const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
const from = process.env.MAIL_FROM || process.env.MAIL_USER;

const transporter = process.env.MAIL_HOST && from
  ? nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT || 587),
      secure: process.env.MAIL_SECURE === "true",
      auth: process.env.MAIL_USER && process.env.MAIL_PASSWORD
        ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD }
        : undefined,
    })
  : null;

async function sendMail(to: string, subject: string, text: string) {
  if (!transporter || !from) {
    console.warn("Email delivery is not configured", { subject });
    return;
  }
  await transporter.sendMail({ from, to, subject, text });
}

export function sendVerificationEmail(to: string, token: string) {
  return sendMail(
    to,
    "Verify your email address",
    `Verify your email address by opening: ${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
  );
}

export function sendPasswordResetEmail(to: string, token: string) {
  return sendMail(
    to,
    "Reset your password",
    `Reset your password by opening: ${appUrl}/reset-password?token=${encodeURIComponent(token)}`,
  );
}
