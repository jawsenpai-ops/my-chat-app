import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "../config/database";

export async function getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [rows] = await db.query<RowDataPacket[]>(`SELECT n.id AS _id, n.type, n.entityId, n.message, n.isRead, n.createdAt, u.id AS senderId, u.name AS senderName, u.avatar AS senderAvatar FROM notifications n JOIN users u ON u.id = n.senderId WHERE n.recipientId = ? ORDER BY n.createdAt DESC LIMIT 100`, [req.userId]);
    return res.json(rows.map((row) => ({ ...row, isRead: Boolean(row.isRead), sender: { _id: row.senderId, name: row.senderName, avatar: row.senderAvatar } })));
  } catch (error) { return next(error); }
}

export async function markNotificationRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [result] = await db.query<ResultSetHeader>("UPDATE notifications SET isRead = TRUE WHERE id = ? AND recipientId = ?", [Number(req.params.notificationId), req.userId]);
    if (!result.affectedRows) return res.status(404).json({ message: "Notification not found" });
    return res.json({ success: true });
  } catch (error) { return next(error); }
}
