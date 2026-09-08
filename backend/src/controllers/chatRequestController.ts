import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "../config/database";
import { notifyUser } from "../utils/socket";

export async function getRequests(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT r.id, r.sender_id AS senderId, r.recipient_id AS recipientId, r.status, r.created_at AS createdAt,
              u.name, u.email, u.avatar
       FROM chat_requests r JOIN users u ON u.id = r.sender_id
       WHERE r.recipient_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`, [req.userId],
    );
    return res.json(rows.map((row) => ({ _id: row.id, status: row.status, createdAt: row.createdAt, sender: { _id: row.senderId, name: row.name, email: row.email, avatar: row.avatar } })));
  } catch (error) { return next(error); }
}

export async function createRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const recipientId = Number(req.params.recipientId);
    if (!Number.isSafeInteger(recipientId) || recipientId < 1 || recipientId === Number(req.userId)) return res.status(400).json({ message: "Invalid recipient" });
    const [existing] = await db.query<RowDataPacket[]>("SELECT id, status, blocked_until AS blockedUntil FROM chat_requests WHERE sender_id = ? AND recipient_id = ?", [req.userId, recipientId]);
    if (existing.length && existing[0].status === "rejected" && existing[0].blockedUntil && new Date(existing[0].blockedUntil).getTime() > Date.now()) return res.status(403).json({ message: "You cannot contact this user for one hour." });
    if (existing.length && existing[0].status === "pending") return res.json({ message: "Request already pending" });
    if (existing.length) await db.query("UPDATE chat_requests SET status = 'pending', blocked_until = NULL WHERE id = ?", [existing[0].id]);
    else await db.query("INSERT INTO chat_requests (sender_id, recipient_id) VALUES (?, ?)", [req.userId, recipientId]);
    notifyUser(recipientId, { type: "chat-request", message: "You have a new chat request." });
    return res.status(201).json({ message: "Request sent" });
  } catch (error) { return next(error); }
}

export async function respondToRequest(req: AuthRequest, res: Response, next: NextFunction) {
  const connection = await db.getConnection();
  try {
    const requestId = Number(req.params.requestId);
    const accept = req.body?.action === "accept";
    await connection.beginTransaction();
    const [requests] = await connection.query<RowDataPacket[]>("SELECT * FROM chat_requests WHERE id = ? AND recipient_id = ? AND status = 'pending' FOR UPDATE", [requestId, req.userId]);
    if (!requests.length) { await connection.rollback(); return res.status(404).json({ message: "Request not found" }); }
    const request = requests[0];
    if (accept) {
      const [existing] = await connection.query<RowDataPacket[]>(`SELECT cp.chatId FROM chat_participants cp JOIN chat_participants other ON other.chatId = cp.chatId WHERE cp.userId = ? AND other.userId = ? LIMIT 1`, [request.sender_id, request.recipient_id]);
      let chatId = existing[0]?.chatId;
      if (!chatId) {
        const [chat] = await connection.query<ResultSetHeader>("INSERT INTO chats () VALUES ()");
        chatId = chat.insertId;
        await connection.query("INSERT INTO chat_participants (chatId, userId) VALUES (?, ?), (?, ?)", [chatId, request.sender_id, chatId, request.recipient_id]);
      }
      await connection.query("UPDATE chat_requests SET status = 'accepted', blocked_until = NULL WHERE id = ?", [requestId]);
      await connection.commit();
      notifyUser(request.sender_id, { type: "chat-request-accepted", message: "Your chat request was accepted." });
      return res.json({ accepted: true, chatId });
    }
    await connection.query("UPDATE chat_requests SET status = 'rejected', blocked_until = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?", [requestId]);
    await connection.commit();
    notifyUser(request.sender_id, { type: "chat-request-rejected", message: "Your chat request was rejected." });
    return res.json({ accepted: false });
  } catch (error) { await connection.rollback(); return next(error); }
  finally { connection.release(); }
}