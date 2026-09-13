import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2";

const feedbackTypes = new Set(["bug", "feature", "problem", "general"]);

export async function createFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const type = typeof req.body?.type === "string" ? req.body.type : "";
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!feedbackTypes.has(type) || subject.length < 1 || subject.length > 255 || message.length < 1 || message.length > 5000) {
      return res.status(400).json({ message: "Feedback type, subject, or message is invalid." });
    }
    const [result] = await db.query("INSERT INTO feedback (user_id, type, subject, message) VALUES (?, ?, ?, ?)", [req.userId, type, subject, message]);
    return res.status(201).json({ id: (result as { insertId: number }).insertId, message: "Feedback submitted." });
  } catch (error) {
    return next(error);
  }
}

export async function getMyFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, type, subject, message, status, admin_reply, created_at, updated_at FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 100", [req.userId]);
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}
