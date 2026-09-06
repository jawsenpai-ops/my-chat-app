import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { normalizeEmail, isValidPassword } from "../utils/validation";
import { createRawToken, hashToken } from "../utils/tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/mail";

const genericResetMessage = "If an account exists with that email, a password reset email has been sent.";

function signToken(userId: number, tokenVersion = 0) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Authentication is not configured.");
  return jwt.sign({ userId, tokenVersion }, secret, { expiresIn: "30d" });
}

async function createVerificationToken(userId: number, email: string) {
  const rawToken = createRawToken();
  await db.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [userId]);
  await db.query(
    "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))",
    [userId, hashToken(rawToken)],
  );
  await sendVerificationEmail(email, rawToken).catch(() => console.warn("Verification email delivery failed"));
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!name || name.length > 100 || !email || !isValidPassword(password)) {
      return res.status(400).json({ message: !email ? "Please provide a valid email address." : "Name or password is invalid." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;
    let result: ResultSetHeader;
    try {
      const [insertResult] = await db.query<ResultSetHeader>(
        "INSERT INTO users (name, email, password, phone, avatar) VALUES (?, ?, ?, ?, ?)",
        [name, email, hashedPassword, "", avatar],
      );
      result = insertResult;
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "An account with this email already exists." });
      }
      throw error;
    }

    const userId = result.insertId;
    await createVerificationToken(userId, email);
    const token = signToken(userId);
    return res.status(201).json({ token, user: { _id: userId, name, email, avatar, bio: "" } });
  } catch (error) {
    return next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || typeof password !== "string" || password.length > 128) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT id, name, email, password, phone, avatar, bio, createdAt, COALESCE(token_version, 0) AS token_version, deleted_at FROM users WHERE email = ?",
      [email],
    );
    if (users.length === 0 || users[0].deleted_at || !(await bcrypt.compare(password, users[0].password))) {
      console.warn("Login failed", { emailDomain: email.split("@")[1] });
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const user = users[0];
    const token = signToken(user.id, Number(user.token_version || 0));
    return res.json({
      token,
      user: { _id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, bio: user.bio, createdAt: user.createdAt },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT id AS _id, name, email, phone, avatar, bio, createdAt, email_verified AS emailVerified FROM users WHERE id = ? AND deleted_at IS NULL",
      [req.userId],
    );
    if (users.length === 0) return res.status(404).json({ message: "User not found" });
    return res.json(users[0]);
  } catch (error) {
    return next(error);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ message: "Invalid or expired verification token." });
    const [tokens] = await db.query<RowDataPacket[]>(
      "SELECT id, user_id FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
      [hashToken(token)],
    );
    if (tokens.length === 0) return res.status(400).json({ message: "Invalid or expired verification token." });
    await db.query("UPDATE users SET email_verified = 1 WHERE id = ?", [tokens[0].user_id]);
    await db.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?", [tokens[0].id]);
    return res.json({ message: "Email verified successfully." });
  } catch (error) {
    return next(error);
  }
}

export async function resendVerification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [users] = await db.query<RowDataPacket[]>("SELECT email, email_verified FROM users WHERE id = ? AND deleted_at IS NULL", [req.userId]);
    if (users.length > 0 && !users[0].email_verified) await createVerificationToken(Number(req.userId), users[0].email);
    return res.json({ message: "If your account needs verification, a verification email has been sent." });
  } catch (error) {
    return next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (email) {
      const [users] = await db.query<RowDataPacket[]>("SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL", [email]);
      if (users.length > 0) {
        const rawToken = createRawToken();
        await db.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [users[0].id]);
        await db.query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))", [users[0].id, hashToken(rawToken)]);
        await sendPasswordResetEmail(users[0].email, rawToken).catch(() => console.warn("Password reset email delivery failed"));
      }
    }
    console.info("Password reset requested");
    return res.json({ message: genericResetMessage });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = req.body?.password;
    if (!/^[a-f0-9]{64}$/.test(token) || !isValidPassword(password)) return res.status(400).json({ message: "Invalid or expired reset token." });
    const [tokens] = await db.query<RowDataPacket[]>("SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1", [hashToken(token)]);
    if (tokens.length === 0) return res.status(400).json({ message: "Invalid or expired reset token." });
    const passwordHash = await bcrypt.hash(password, 12);
    await db.query("UPDATE users SET password = ?, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?", [passwordHash, tokens[0].user_id]);
    await db.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [tokens[0].user_id]);
    return res.json({ message: "Password reset successfully." });
  } catch (error) {
    return next(error);
  }
}