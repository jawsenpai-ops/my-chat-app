import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2";

export async function getUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;

    const [users] = await db.query<RowDataPacket[]>(
      "SELECT id AS _id, name, email, avatar FROM users WHERE id != ? LIMIT 50",
      [userId]
    );

    res.json(users);
  } catch (error) {
    next(error);
  }
}