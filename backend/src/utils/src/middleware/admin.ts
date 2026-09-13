import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2";

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT role, deleted_at FROM users WHERE id = ?",
      [req.userId],
    );
    if (users.length === 0 || users[0].deleted_at || users[0].role !== "admin") {
      return res.status(403).json({ message: "Forbidden." });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
