import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const [existingUsers] = await db.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 1. Password ကို Salt 10 ဖြင့် Hash (Encrypt) လုပ်ခြင်း
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;

    // 2. Hashed Password ကို Database ထဲ သို့ သိမ်းဆည်းခြင်း
    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO users (name, email, password, phone, avatar) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashedPassword, phone, avatar]
    );

    const userId = result.insertId;
    const token = jwt.sign({ userId }, process.env.JWT_SECRET || "secret", { expiresIn: "30d" });

    return res.status(201).json({
      token,
      user: { _id: userId, name, email, phone, avatar, bio: "" },
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const [users] = await db.query<RowDataPacket[]>(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = users[0];
    
    // 3. Encrypted Password ကို တိုက်စစ်ခြင်း
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "secret", { expiresIn: "30d" });

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
    const userId = req.userId;
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT id AS _id, name, email, phone, avatar, bio, createdAt FROM users WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(users[0]);
  } catch (error) {
    return next(error);
  }
}