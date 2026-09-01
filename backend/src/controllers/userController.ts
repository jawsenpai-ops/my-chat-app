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

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT id AS _id, name, email, phone, avatar, bio, createdAt FROM users WHERE id = ?",
      [req.userId]
    );
    if (users.length === 0) return res.status(404).json({ message: "User not found" });
    return res.json(users[0]);
  } catch (error) {
    return next(error);
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const bio = typeof req.body.bio === "string" ? req.body.bio.trim() : null;
    if (bio === null || bio.length > 500) {
      return res.status(400).json({ message: "Bio must be a string of 500 characters or fewer" });
    }
    await db.query("UPDATE users SET bio = ? WHERE id = ?", [bio, req.userId]);
    return getProfile(req, res, next);
  } catch (error) {
    return next(error);
  }
}