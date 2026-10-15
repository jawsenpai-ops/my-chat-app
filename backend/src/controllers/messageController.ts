import { encryptText } from "../utils/crypto";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import { db } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
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

    const query = `
      SELECT 
        m.id AS _id,
        m.text,
        m.createdAt,
        m.pinned_at AS pinnedAt,
        m.reply_to_id AS replyToId,
        m.client_message_id AS clientMessageId,
        replied.text AS replyText,
        replyUser.name AS replySenderName,
        m.chatId AS chat,
        u.id AS sender_id,
        u.name AS sender_name,
        u.avatar AS sender_avatar
      FROM messages m
      JOIN users u ON m.senderId = u.id
      LEFT JOIN messages replied ON replied.id = m.reply_to_id
      LEFT JOIN users replyUser ON replyUser.id = replied.senderId
      WHERE m.chatId = ? AND m.deleted_at IS NULL
      ORDER BY m.createdAt ASC
    `;

    const [rows] = await db.query<RowDataPacket[]>(query, [chatId]);

    const formattedMessages = rows.map((row) => ({
      _id: row._id,
      clientMessageId: row.clientMessageId || undefined,
      chat: row.chat,
      text: decryptText(row.text), // DB က ရလာတဲ့ Encrypted Text ကို Decrypt ပြန်လုပ်ပေးခြင်း
      createdAt: row.createdAt,
      pinned: Boolean(row.pinnedAt),
      replyTo: row.replyToId ? { _id: row.replyToId, text: decryptText(row.replyText), senderName: row.replySenderName } : null,
      sender: {
        _id: row.sender_id,
        name: row.sender_name,
        avatar: row.sender_avatar,
      },
    }));

    return res.json(formattedMessages);
  } catch (error) {
    return next(error);
  }
}

export async function getChatReadState(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const chatId = Number(req.params.chatId);
    if (!Number.isSafeInteger(chatId) || chatId < 1) return res.status(400).json({ message: "Invalid chat ID" });

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT cp.lastReadAt, cp.lastReadMessageId, cp.lastViewedMessageId,
        (
          SELECT unread_m.id
          FROM messages unread_m
          WHERE unread_m.chatId = cp.chatId
            AND unread_m.senderId != cp.userId
            AND unread_m.deleted_at IS NULL
            AND (
              (cp.lastReadMessageId IS NOT NULL AND unread_m.id > cp.lastReadMessageId)
              OR (cp.lastReadMessageId IS NULL AND (cp.lastReadAt IS NULL OR unread_m.createdAt > cp.lastReadAt))
            )
          ORDER BY unread_m.createdAt ASC, unread_m.id ASC
          LIMIT 1
        ) AS firstUnreadMessageId
      FROM chat_participants cp
      WHERE cp.chatId = ? AND cp.userId = ?`,
      [chatId, req.userId],
    );

    if (rows.length === 0) return res.status(404).json({ message: "Chat not found" });
    return res.json({
      lastReadAt: rows[0].lastReadAt,
      lastReadMessageId: rows[0].lastReadMessageId,
      lastViewedMessageId: rows[0].lastViewedMessageId,
      firstUnreadMessageId: rows[0].firstUnreadMessageId,
    });
  } catch (error) {
    return next(error);
  }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const chatId = Number(req.params.chatId);
    const { text, replyToId, clientMessageId } = req.body ?? {};

    if (!Number.isSafeInteger(chatId) || chatId < 1) return res.status(400).json({ message: "Invalid chat ID" });
    if (typeof text !== "string" || text.trim().length === 0 || text.length > 4_000) return res.status(400).json({ message: "Invalid message" });
    if (clientMessageId !== undefined && (typeof clientMessageId !== "string" || clientMessageId.length < 1 || clientMessageId.length > 100)) return res.status(400).json({ message: "Invalid message ID" });

    const replyToIdNumber = replyToId !== undefined && replyToId !== null ? Number(replyToId) : null;
    if (replyToIdNumber !== null && (!Number.isSafeInteger(replyToIdNumber) || replyToIdNumber < 1)) return res.status(400).json({ message: "Invalid reply message ID" });

    const [chatAccess] = await db.query<RowDataPacket[]>(
      "SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?",
      [chatId, req.userId],
    );
    if (chatAccess.length === 0) return res.status(404).json({ message: "Chat not found" });

    if (replyToIdNumber !== null) {
      const [replyAccess] = await db.query<RowDataPacket[]>(
        "SELECT m.id FROM messages m JOIN chat_participants cp ON cp.chatId = m.chatId AND cp.userId = ? WHERE m.id = ? AND m.chatId = ? AND m.deleted_at IS NULL",
        [req.userId, replyToIdNumber, chatId],
      );
      if (replyAccess.length === 0) return res.status(400).json({ message: "Reply message not found" });
    }

    const encryptedText = encryptText(text);
    const [msgResult] = await db.query<ResultSetHeader>(
      `INSERT INTO messages (chatId, senderId, reply_to_id, text, client_message_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [chatId, req.userId, replyToIdNumber, encryptedText, clientMessageId || null],
    );

    const messageId = msgResult.insertId;
    if (msgResult.affectedRows === 1) {
      await db.query("UPDATE chats SET lastMessageAt = NOW(), lastMessageId = ? WHERE id = ?", [messageId, chatId]);
    }

    const [storedMessages] = await db.query<RowDataPacket[]>(
      "SELECT text, createdAt, reply_to_id AS replyToId FROM messages WHERE id = ?",
      [messageId],
    );

    const [sender] = await db.query<RowDataPacket[]>(
      "SELECT id AS _id, name, avatar FROM users WHERE id = ?",
      [req.userId],
    );

    let replyTo = null;
    const storedReplyToId = storedMessages[0]?.replyToId;
    if (storedReplyToId !== null && storedReplyToId !== undefined) {
      const [replyRows] = await db.query<RowDataPacket[]>("SELECT m.id, m.text, u.name AS senderName FROM messages m JOIN users u ON u.id = m.senderId WHERE m.id = ?", [storedReplyToId]);
      if (replyRows.length > 0) replyTo = { _id: replyRows[0].id, text: decryptText(replyRows[0].text), senderName: replyRows[0].senderName };
    }

    const formattedMessage = {
      _id: messageId,
      clientMessageId: clientMessageId || undefined,
      chat: chatId,
      text: decryptText(storedMessages[0].text),
      sender: sender[0],
      createdAt: storedMessages[0].createdAt,
      replyTo,
    };

    return res.status(201).json(formattedMessage);
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

export async function togglePinMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const messageId = Number(req.params.messageId);
    const [messages] = await db.query<RowDataPacket[]>(
      `SELECT m.id, m.chatId, m.pinned_at FROM messages m
       JOIN chat_participants cp ON cp.chatId = m.chatId AND cp.userId = ?
       WHERE m.id = ? AND m.deleted_at IS NULL`, [req.userId, messageId],
    );
    if (messages.length === 0) return res.status(404).json({ message: "Message not found" });
    const pinned = !messages[0].pinned_at;
    await db.query("UPDATE messages SET pinned_at = ? WHERE id = ?", [pinned ? new Date() : null, messageId]);
    return res.json({ pinned });
  } catch (error) { return next(error); }
}