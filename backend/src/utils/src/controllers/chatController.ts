import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { decryptText } from "../utils/crypto";

export async function getChats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    const query = `
      SELECT 
        c.id AS _id,
        c.lastMessageAt,
        c.createdAt,
        cp.pinned,
        cp.muted,
        u.id AS participant_id,
        u.name AS participant_name,
        u.email AS participant_email,
        u.avatar AS participant_avatar,
        m.id AS message_id,
        m.text AS message_text,
        m.createdAt AS message_createdAt,
        (
          SELECT COUNT(*)
          FROM messages unread_m
          WHERE unread_m.chatId = c.id
            AND unread_m.senderId != ?
            AND (cp.lastReadAt IS NULL OR unread_m.createdAt > cp.lastReadAt)
        ) AS unread_count
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chatId
      JOIN chat_participants cp_other ON c.id = cp_other.chatId AND cp_other.userId != ?
      JOIN users u ON cp_other.userId = u.id
      LEFT JOIN messages m ON c.lastMessageId = m.id AND m.deleted_at IS NULL
      WHERE cp.userId = ? AND cp.hidden_at IS NULL
      ORDER BY cp.pinned DESC, c.lastMessageAt DESC
    `;

    const [rows] = await db.query<RowDataPacket[]>(query, [userId, userId, userId]);

    const formattedChats = rows.map((row) => ({
      _id: row._id,
      unreadCount: Number(row.unread_count || 0),
      pinned: Boolean(row.pinned),
      muted: Boolean(row.muted),
      participant: {
        _id: row.participant_id,
        name: row.participant_name,
        email: row.participant_email,
        avatar: row.participant_avatar,
      },
      lastMessage: row.message_id ? {
        _id: row.message_id,
        text: row.message_text ? decryptText(row.message_text) : "",
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
    let isNew = false;

    if (existing.length > 0) {
      chatId = existing[0].chatId;
    } else {
      isNew = true;
      const [newChat] = await db.query<ResultSetHeader>("INSERT INTO chats () VALUES ()");
      chatId = newChat.insertId;

      await db.query(
        "INSERT INTO chat_participants (chatId, userId) VALUES (?, ?), (?, ?)",
        [chatId, userId, chatId, participantId]
      );
    }

    const [participantRows] = await db.query<RowDataPacket[]>(
      "SELECT id AS _id, name, email, avatar FROM users WHERE id = ? AND deleted_at IS NULL",
      [participantId]
    );

    if (participantRows.length === 0) return res.status(404).json({ message: "User not found" });

    const [chatRows] = await db.query<RowDataPacket[]>(
      "SELECT id AS _id, lastMessageAt, createdAt FROM chats WHERE id = ?",
      [chatId]
    );

    res.json({
      _id: chatRows[0]._id,
      participant: participantRows[0] || null,
      lastMessage: null,
      isNew,
      lastMessageAt: chatRows[0].lastMessageAt,
      createdAt: chatRows[0].createdAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateChatAction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const chatId = Number(req.params.chatId);
    const action = req.body?.action;
    if (!Number.isSafeInteger(chatId) || !["pin", "mute", "delete"].includes(action)) return res.status(400).json({ message: "Invalid chat action" });
    const [access] = await db.query<RowDataPacket[]>("SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?", [chatId, req.userId]);
    if (!access.length) return res.status(404).json({ message: "Chat not found" });
    const column = action === "pin" ? "pinned" : action === "mute" ? "muted" : "hidden_at";
    if (action === "delete") await db.query("UPDATE chat_participants SET hidden_at = NOW() WHERE chatId = ? AND userId = ?", [chatId, req.userId]);
    else await db.query(`UPDATE chat_participants SET ${column} = NOT ${column} WHERE chatId = ? AND userId = ?`, [chatId, req.userId]);
    return res.json({ action, message: "Chat updated" });
  } catch (error) { return next(error); }
}