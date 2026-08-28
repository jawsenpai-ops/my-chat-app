import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2";

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    const chatId = parseInt(req.params.chatId, 10);

    const [chatAccess] = await db.query<RowDataPacket[]>(
      "SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?",
      [chatId, userId]
    );

    if (chatAccess.length === 0) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const query = `
      SELECT 
        m.id AS _id,
        m.text,
        m.createdAt,
        m.chatId AS chat,
        u.id AS sender_id,
        u.name AS sender_name,
        u.email AS sender_email,
        u.avatar AS sender_avatar
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.chatId = ?
      ORDER BY m.createdAt ASC
    `;

    const [rows] = await db.query<RowDataPacket[]>(query, [chatId]);

    const formattedMessages = rows.map((row) => ({
      _id: row._id,
      chat: row.chat,
      text: row.text,
      createdAt: row.createdAt,
      sender: {
        _id: row.sender_id,
        name: row.sender_name,
        email: row.sender_email,
        avatar: row.sender_avatar,
      },
    }));

    res.json(formattedMessages);
  } catch (error) {
    next(error);
  }
}