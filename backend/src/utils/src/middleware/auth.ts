import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2";

export type AuthRequest = Request & {
  userId?: number;
};

interface JwtPayload {
  userId: number;
  tokenVersion?: number;
}

export const protectRoute = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized - No token" });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "Authentication is not configured." });
    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (!Number.isSafeInteger(decoded.userId) || decoded.userId < 1) {
      return res.status(401).json({ message: "Unauthorized." });
    }
    const [users] = await db.query<RowDataPacket[]>("SELECT token_version, deleted_at FROM users WHERE id = ?", [decoded.userId]);
    if (users.length === 0 || users[0].deleted_at || Number(users[0].token_version || 0) !== Number(decoded.tokenVersion || 0)) {
      return res.status(401).json({ message: "Unauthorized." });
    }
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized." });
  }
};