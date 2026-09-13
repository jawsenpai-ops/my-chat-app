import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2";

const statuses = new Set(["new", "reviewing", "in_progress", "resolved", "rejected"]);
const types = new Set(["bug", "feature", "problem", "general"]);

export async function listFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === "string" && statuses.has(req.query.status) ? req.query.status : null;
    const type = typeof req.query.type === "string" && types.has(req.query.type) ? req.query.type : null;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT f.id, f.type, f.subject, f.message, f.status, f.admin_reply, f.created_at, f.updated_at,
              u.id AS user_id, u.name AS user_name, u.email AS user_email
       FROM feedback f JOIN users u ON u.id = f.user_id
       WHERE (? IS NULL OR f.status = ?) AND (? IS NULL OR f.type = ?)
       ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
      [status, status, type, type, limit, offset],
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

export async function getFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [rows] = await db.query<RowDataPacket[]>("SELECT f.id, f.type, f.subject, f.message, f.status, f.admin_reply, f.created_at, f.updated_at, u.id AS user_id, u.name AS user_name, u.email AS user_email FROM feedback f JOIN users u ON u.id = f.user_id WHERE f.id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: "Feedback not found" });
    return res.json(rows[0]);
  } catch (error) {
    return next(error);
  }
}

export async function updateFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const status = typeof req.body?.status === "string" ? req.body.status : "";
    const reply = req.body?.adminReply;
    if (!statuses.has(status) || (reply !== undefined && (typeof reply !== "string" || reply.length > 5000))) return res.status(400).json({ message: "Feedback update is invalid." });
    await db.query("UPDATE feedback SET status = ?, admin_reply = COALESCE(?, admin_reply) WHERE id = ?", [status, reply === undefined ? null : reply.trim(), req.params.id]);
    console.info("Admin updated feedback", { adminId: req.userId, feedbackId: req.params.id, status });
    return res.json({ message: "Feedback updated." });
  } catch (error) {
    return next(error);
  }
}

export async function getStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [[users], [feedback], [messages]] = await Promise.all([
      db.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL"),
      db.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM feedback"),
      db.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM messages"),
    ]);
    return res.json({ users: Number(users[0].count), feedback: Number(feedback[0].count), messages: Number(messages[0].count) });
  } catch (error) {
    return next(error);
  }
}

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, name, email, role, email_verified AS emailVerified, deleted_at, createdAt FROM users ORDER BY createdAt DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}
