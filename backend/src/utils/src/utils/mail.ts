import { spawn } from "child_process";

const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
const sendmailPath = process.env.SENDMAIL_PATH || "/usr/sbin/sendmail";

export class MailDeliveryError extends Error {
  readonly statusCode = 503;

  constructor() {
    super("Email delivery is temporarily unavailable.");
    this.name = "MailDeliveryError";
  }
}

async function sendMail(to: string, subject: string, text: string) {
  const from = process.env.MAIL_FROM || "no-reply@ikiyadm.com";
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    text,
    "",
  ].join("\r\n");

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const child = spawn(sendmailPath, ["-t", "-i", "-f", from], { stdio: ["pipe", "ignore", "ignore"] });
    const fail = () => {
      if (!settled) {
        settled = true;
        reject(new MailDeliveryError());
      }
    };
    child.once("error", fail);
    child.once("close", (code) => {
      if (code === 0 && !settled) {
        settled = true;
        resolve();
      } else if (code !== 0) {
        fail();
      }
    });
    child.stdin.once("error", fail);
    child.stdin.end(message);
  });
}

export function sendVerificationEmail(to: string, token: string) {
  return sendMail(
    to,
    "Verify your email address",
    `Verify your email address by opening: ${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
  );
}

