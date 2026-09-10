import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "../config/database";
import { emitUserEvent, notifyUser } from "../utils/socket";

const validId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const pair = (a: number, b: number): [number, number] => a < b ? [a, b] : [b, a];

async function hasBlockedRelationship(userId: number, otherId: number) {
  const [rows] = await db.query<RowDataPacket[]>("SELECT 1 FROM blocked_users WHERE (blockerId = ? AND blockedId = ?) OR (blockerId = ? AND blockedId = ?) LIMIT 1", [userId, otherId, otherId, userId]);
  return rows.length > 0;
}

async function userExists(userId: number) {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
  return rows.length > 0;
}

export async function getRelationshipStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.userId); const otherId = Number(req.params.userId);
    if (!validId(userId) || !validId(otherId) || userId === otherId) return res.status(400).json({ success: false, message: "Invalid user ID" });
    if (await hasBlockedRelationship(userId, otherId)) return res.json({ status: "blocked" });
    const [friends] = await db.query<RowDataPacket[]>("SELECT id FROM friendships WHERE userId = ? AND friendId = ?", [pair(userId, otherId)[0], pair(userId, otherId)[1]]);
    if (friends.length) return res.json({ status: "friends" });
    const [requests] = await db.query<RowDataPacket[]>("SELECT id, senderId, receiverId FROM friend_requests WHERE status = 'pending' AND ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)) LIMIT 1", [userId, otherId, otherId, userId]);
    if (!requests.length) return res.json({ status: "none" });
    return res.json({ status: Number(requests[0].senderId) === userId ? "pending_sent" : "pending_received", requestId: requests[0].id });
  } catch (error) { return next(error); }
}

export async function sendFriendRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const senderId = Number(req.userId); const receiverId = Number(req.params.userId);
    if (!validId(senderId) || !validId(receiverId) || senderId === receiverId) return res.status(400).json({ success: false, message: "You cannot send a friend request to yourself" });
    if (!await userExists(receiverId)) return res.status(404).json({ success: false, message: "User not found" });
    if (await hasBlockedRelationship(senderId, receiverId)) return res.status(403).json({ success: false, message: "Friend requests are blocked between these users" });
    const [friends] = await db.query<RowDataPacket[]>("SELECT id FROM friendships WHERE userId = ? AND friendId = ?", pair(senderId, receiverId));
    if (friends.length) return res.status(409).json({ success: false, message: "Users are already friends" });
    const [opposite] = await db.query<RowDataPacket[]>("SELECT id FROM friend_requests WHERE senderId = ? AND receiverId = ? AND status = 'pending'", [receiverId, senderId]);
    if (opposite.length) return acceptFriendRequestById(Number(opposite[0].id), receiverId, res, next);
    const [existing] = await db.query<RowDataPacket[]>("SELECT id, status FROM friend_requests WHERE senderId = ? AND receiverId = ? LIMIT 1", [senderId, receiverId]);
    if (existing.length && existing[0].status === "pending") return res.status(409).json({ success: false, message: "Friend request already exists" });
    if (existing.length) await db.query("UPDATE friend_requests SET status = 'pending', updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [existing[0].id]);
    else await db.query("INSERT INTO friend_requests (senderId, receiverId) VALUES (?, ?)", [senderId, receiverId]);
    const [[sender]] = await db.query<RowDataPacket[]>("SELECT id AS _id, name, avatar FROM users WHERE id = ?", [senderId]);
    const [[request]] = await db.query<RowDataPacket[]>("SELECT id FROM friend_requests WHERE senderId = ? AND receiverId = ? AND status = 'pending'", [senderId, receiverId]);
    emitUserEvent(receiverId, "friend-request-received", { requestId: request.id, from: sender });
    notifyUser(receiverId, { type: "friend-request", message: `${sender.name} sent you a friend request.`, requestId: request.id });
    return res.status(201).json({ success: true, message: "Friend request sent" });
  } catch (error) { return next(error); }
}

export async function cancelFriendRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const senderId = Number(req.userId); const receiverId = Number(req.params.userId);
    const [result] = await db.query<ResultSetHeader>("UPDATE friend_requests SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP WHERE senderId = ? AND receiverId = ? AND status = 'pending'", [senderId, receiverId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Pending friend request not found" });
    emitUserEvent(receiverId, "friend-request-cancelled", { fromUserId: senderId });
    return res.json({ success: true, message: "Friend request cancelled" });
  } catch (error) { return next(error); }
}

async function acceptFriendRequestById(requestId: number, receiverId: number, res: Response, next: NextFunction) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM friend_requests WHERE id = ? AND receiverId = ? AND status = 'pending' FOR UPDATE", [requestId, receiverId]);
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "Pending friend request not found" }); }
    const request = rows[0]; const [userId, friendId] = pair(Number(request.senderId), Number(request.receiverId));
    await connection.query("INSERT IGNORE INTO friendships (userId, friendId) VALUES (?, ?)", [userId, friendId]);
    await connection.query("UPDATE friend_requests SET status = 'accepted', updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [requestId]);
    await connection.commit();
    const [[receiver]] = await db.query<RowDataPacket[]>("SELECT id AS _id, name, avatar FROM users WHERE id = ?", [receiverId]);
    emitUserEvent(Number(request.senderId), "friend-request-accepted", { by: receiver });
    notifyUser(Number(request.senderId), { type: "friend-request-accepted", message: `${receiver.name} accepted your friend request.` });
    return res.json({ success: true, message: "Friend request accepted" });
  } catch (error) { await connection.rollback(); return next(error); } finally { connection.release(); }
}

export async function acceptFriendRequest(req: AuthRequest, res: Response, next: NextFunction) { return acceptFriendRequestById(Number(req.params.requestId), Number(req.userId), res, next); }

export async function declineFriendRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [result] = await db.query<ResultSetHeader>("UPDATE friend_requests SET status = 'declined', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND receiverId = ? AND status = 'pending'", [Number(req.params.requestId), Number(req.userId)]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Pending friend request not found" });
    const [request] = await db.query<RowDataPacket[]>("SELECT senderId FROM friend_requests WHERE id = ?", [Number(req.params.requestId)]);
    if (request.length) emitUserEvent(Number(request[0].senderId), "friend-request-declined", { requestId: Number(req.params.requestId) });
    return res.json({ success: true, message: "Friend request declined" });
  } catch (error) { return next(error); }
}

export async function removeFriend(req: AuthRequest, res: Response, next: NextFunction) {
  try { const [userId, friendId] = pair(Number(req.userId), Number(req.params.userId)); const [result] = await db.query<ResultSetHeader>("DELETE FROM friendships WHERE userId = ? AND friendId = ?", [userId, friendId]); if (!result.affectedRows) return res.status(404).json({ success: false, message: "Friendship not found" }); return res.json({ success: true, message: "Friend removed" }); } catch (error) { return next(error); }
}

export async function getFriends(req: AuthRequest, res: Response, next: NextFunction) { try { const [rows] = await db.query<RowDataPacket[]>(`SELECT u.id AS _id, u.name, u.email, u.avatar, u.bio, u.createdAt FROM friendships f JOIN users u ON u.id = IF(f.userId = ?, f.friendId, f.userId) WHERE (f.userId = ? OR f.friendId = ?) AND u.deleted_at IS NULL ORDER BY u.name`, [req.userId, req.userId, req.userId]); return res.json(rows); } catch (error) { return next(error); } }

export async function getIncomingRequests(req: AuthRequest, res: Response, next: NextFunction) { try { const [rows] = await db.query<RowDataPacket[]>(`SELECT r.id AS requestId, r.createdAt, u.id AS _id, u.name, u.email, u.avatar, u.bio, u.createdAt AS userCreatedAt FROM friend_requests r JOIN users u ON u.id = r.senderId WHERE r.receiverId = ? AND r.status = 'pending' ORDER BY r.createdAt DESC`, [req.userId]); return res.json(rows.map((row) => ({ requestId: row.requestId, createdAt: row.createdAt, _id: row._id, name: row.name, email: row.email, avatar: row.avatar, bio: row.bio, userCreatedAt: row.userCreatedAt }))); } catch (error) { return next(error); } }

export async function getOutgoingRequests(req: AuthRequest, res: Response, next: NextFunction) { try { const [rows] = await db.query<RowDataPacket[]>(`SELECT r.id AS requestId, r.createdAt, u.id AS _id, u.name, u.email, u.avatar, u.bio, u.createdAt AS userCreatedAt FROM friend_requests r JOIN users u ON u.id = r.receiverId WHERE r.senderId = ? AND r.status = 'pending' ORDER BY r.createdAt DESC`, [req.userId]); return res.json(rows); } catch (error) { return next(error); } }