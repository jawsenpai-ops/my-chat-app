import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";
import { normalizeEmail, isValidPassword } from "../utils/validation";
import { createRawToken, hashToken } from "../utils/tokens";
import { sendVerificationEmail } from "../utils/mail";

export async function changeEmail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: "Please provide a valid email address." });
    if (typeof req.body?.currentPassword !== "string") return res.status(400).json({ message: "Current password is required." });
    const [accounts] = await db.query<RowDataPacket[]>("SELECT password FROM users WHERE id = ? AND deleted_at IS NULL", [req.userId]);
    if (accounts.length === 0 || !(await bcrypt.compare(req.body.currentPassword, accounts[0].password))) return res.status(401).json({ message: "Unauthorized." });
    try {
      await db.query("UPDATE users SET email = ?, email_verified = 0 WHERE id = ? AND deleted_at IS NULL", [email, req.userId]);
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") return res.status(409).json({ message: "An account with this email already exists." });
      throw error;
    }
    const rawToken = createRawToken();
    await db.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [req.userId]);
    await db.query("INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))", [req.userId, hashToken(rawToken)]);
    await sendVerificationEmail(email, rawToken).catch(() => console.warn("Verification email delivery failed"));
    return res.json({ message: "Email updated. Please verify your new address." });
  } catch (error) {
    return next(error);
  }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const currentPassword = req.body?.currentPassword;
    const newPassword = req.body?.newPassword;
    if (typeof currentPassword !== "string" || !isValidPassword(newPassword)) return res.status(400).json({ message: "Password is invalid." });
    const [users] = await db.query<RowDataPacket[]>("SELECT password FROM users WHERE id = ? AND deleted_at IS NULL", [req.userId]);
    if (users.length === 0 || !(await bcrypt.compare(currentPassword, users[0].password))) return res.status(401).json({ message: "Unauthorized." });
    await db.query("UPDATE users SET password = ?, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?", [await bcrypt.hash(newPassword, 12), req.userId]);
    return res.json({ message: "Password changed successfully." });
  } catch (error) {
    return next(error);
  }
}

export async function deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.body?.confirmation !== "DELETE") return res.status(400).json({ message: "Confirmation is required." });
    const [result] = await db.query("UPDATE users SET deleted_at = NOW(), token_version = COALESCE(token_version, 0) + 1 WHERE id = ? AND deleted_at IS NULL", [req.userId]);
    if ((result as { affectedRows?: number }).affectedRows !== 1) return res.status(404).json({ message: "User not found" });
    console.info("Account deleted", { userId: req.userId });
    return res.json({ message: "Account deleted successfully." });
  } catch (error) {
    return next(error);
  }
}
