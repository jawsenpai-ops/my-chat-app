import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function getChats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;

    const query = `
      SELECT 
        c.id AS _id,
        c.lastMessageAt,
        c.createdAt,
        u.id AS participant_id,
        u.name AS participant_name,
        u.email AS participant_email,
        u.avatar AS participant_avatar,
        m.id AS message_id,
        m.text AS message_text,
        m.createdAt AS message_createdAt
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chatId
      JOIN chat_participants cp_other ON c.id = cp_other.chatId AND cp_other.userId != ?
      JOIN users u ON cp_other.userId = u.id
      LEFT JOIN messages m ON c.lastMessageId = m.id
      WHERE cp.userId = ?
      ORDER BY c.lastMessageAt DESC
    `;

    const [rows] = await db.query<RowDataPacket[]>(query, [userId, userId]);

    const formattedChats = rows.map((row) => ({
      _id: row._id,
      participant: {
        _id: row.participant_id,
        name: row.participant_name,
        email: row.participant_email,
        avatar: row.participant_avatar,
      },
      lastMessage: row.message_id ? {
        _id: row.message_id,
        text: row.message_text,
        createdAt: row.message_createdAt
      } : null,
      lastMessageAt: row.lastMessageAt,
      createdAt: row.createdAt,
    }));

    res.json(formattedChats);
  } catch (error) {
    next(error);
  }
}

export async function getOrCreateChat(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const participantId = parseInt(req.params.participantId, 10);

    if (isNaN(participantId)) {
      return res.status(400).json({ message: "Invalid participant ID" });
    }

    if (userId === participantId) {
      return res.status(400).json({ message: "Cannot create chat with yourself" });
    }

    const [existing] = await db.query<RowDataPacket[]>(
      `SELECT chatId FROM chat_participants 
       WHERE userId IN (?, ?) 
       GROUP BY chatId 
       HAVING COUNT(DISTINCT userId) = 2`,
      [userId, participantId]
    );

    let chatId: number;

    if (existing.length > 0) {
      chatId = existing[0].chatId;
    } else {
      const [newChat] = await db.query<ResultSetHeader>("INSERT INTO chats () VALUES ()");
      chatId = newChat.insertId;

      await db.query(
        "INSERT INTO chat_participants (chatId, userId) VALUES (?, ?), (?, ?)",
        [chatId, userId, chatId, participantId]
      );
    }

    const [participantRows] = await db.query<RowDataPacket[]>(
      "SELECT id AS _id, name, email, avatar FROM users WHERE id = ?",
      [participantId]
    );

    const [chatRows] = await db.query<RowDataPacket[]>(
      "SELECT id AS _id, lastMessageAt, createdAt FROM chats WHERE id = ?",
      [chatId]
    );

    res.json({
      _id: chatRows[0]._id,
      participant: participantRows[0] || null,
      lastMessage: null,
      lastMessageAt: chatRows[0].lastMessageAt,
      createdAt: chatRows[0].createdAt,
    });
  } catch (error) {
    next(error);
  }
}