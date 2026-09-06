import { encryptText } from "../utils/crypto";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2";
import { decryptText } from "../utils/crypto";

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    const chatId = parseInt(req.params.chatId, 10);

    if (!Number.isSafeInteger(chatId) || chatId < 1) {
      return res.status(400).json({ message: "Invalid chat ID" });
    }

    const [chatAccess] = await db.query<RowDataPacket[]>(
      "SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?",
      [chatId, userId]
    );

    if (chatAccess.length === 0) {
      return res.status(404).json({ message: "Chat not found" });
    }

    await db.query(
      "UPDATE chat_participants SET lastReadAt = NOW() WHERE chatId = ? AND userId = ?",
      [chatId, userId],
    );

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
      WHERE m.chatId = ? AND m.deleted_at IS NULL
      ORDER BY m.createdAt ASC
    `;

    const [rows] = await db.query<RowDataPacket[]>(query, [chatId]);

    const formattedMessages = rows.map((row) => ({
      _id: row._id,
      chat: row.chat,
      text: decryptText(row.text), // DB က ရလာတဲ့ Encrypted Text ကို Decrypt ပြန်လုပ်ပေးခြင်း
      createdAt: row.createdAt,
      sender: {
        _id: row.sender_id,
        name: row.sender_name,
        email: row.sender_email,
        avatar: row.sender_avatar,
      },
    }));

    return res.json(formattedMessages);
  } catch (error) {
    return next(error);
  }
}

export async function deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const messageId = Number(req.params.messageId);
    if (!Number.isSafeInteger(messageId) || messageId < 1) return res.status(400).json({ message: "Invalid message ID" });
    const [messages] = await db.query<RowDataPacket[]>(
      `SELECT m.id, m.chatId, m.senderId
       FROM messages m JOIN chat_participants cp ON cp.chatId = m.chatId AND cp.userId = ?
       WHERE m.id = ?`,
      [req.userId, messageId],
    );
    if (messages.length === 0) return res.status(404).json({ message: "Message not found" });
    if (Number(messages[0].senderId) !== Number(req.userId)) return res.status(403).json({ message: "Forbidden." });
    await db.query("UPDATE messages SET deleted_at = NOW() WHERE id = ? AND senderId = ? AND deleted_at IS NULL", [messageId, req.userId]);
    return res.json({ message: "Message deleted." });
  } catch (error) {
    return next(error);
  }
}