import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "../config/database";

const maxImageLength = 2_000_000;

function validImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/") && value.length <= maxImageLength;
}

export async function getPosts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT p.id, p.user_id, p.body, p.image_url, p.created_at, p.updated_at,
              u.name, u.email, u.avatar,
              (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
              EXISTS(SELECT 1 FROM post_likes me WHERE me.post_id = p.id AND me.user_id = ?) AS liked_by_me,
              (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count
       FROM posts p INNER JOIN users u ON u.id = p.user_id
       WHERE p.deleted_at IS NULL AND u.deleted_at IS NULL
       ORDER BY p.created_at DESC LIMIT 100`,
      [req.userId],
    );
    return res.json(rows.map((row) => ({
      _id: row.id,
      body: row.body,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: { _id: row.user_id, name: row.name, email: row.email, avatar: row.avatar },
      likeCount: Number(row.like_count || 0),
      likedByMe: Boolean(row.liked_by_me),
      commentCount: Number(row.comment_count || 0),
      isOwner: Number(row.user_id) === Number(req.userId),
    })));
  } catch (error) { return next(error); }
}

export async function createPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const imageUrl = req.body?.imageUrl;
    if (!body && !imageUrl) return res.status(400).json({ message: "Write something or add an image." });
    if (body.length > 5000 || (imageUrl && !validImage(imageUrl))) return res.status(400).json({ message: "Post content is invalid or too large." });
    const [result] = await db.query<ResultSetHeader>("INSERT INTO posts (user_id, body, image_url) VALUES (?, ?, ?)", [req.userId, body, imageUrl || null]);
    return res.status(201).json({ id: result.insertId });
  } catch (error) { return next(error); }
}

export async function updatePost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = Number(req.params.postId);
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const imageUrl = req.body?.imageUrl;
    if (!Number.isSafeInteger(postId) || postId < 1 || (!body && !imageUrl)) return res.status(400).json({ message: "Post content is invalid." });
    if (body.length > 5000 || (imageUrl && !validImage(imageUrl))) return res.status(400).json({ message: "Post content is invalid or too large." });
    const [result] = await db.query<ResultSetHeader>("UPDATE posts SET body = ?, image_url = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL", [body, imageUrl || null, postId, req.userId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Post not found." });
    return res.json({ message: "Post updated." });
  } catch (error) { return next(error); }
}

export async function deletePost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = Number(req.params.postId);
    const [result] = await db.query<ResultSetHeader>("UPDATE posts SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL", [postId, req.userId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Post not found." });
    return res.json({ message: "Post deleted." });
  } catch (error) { return next(error); }
}

export async function toggleLike(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = Number(req.params.postId);
    const [existing] = await db.query<RowDataPacket[]>("SELECT post_id FROM post_likes WHERE post_id = ? AND user_id = ?", [postId, req.userId]);
    if (existing.length > 0) await db.query("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?", [postId, req.userId]);
    else await db.query("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)", [postId, req.userId]);
    const [count] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM post_likes WHERE post_id = ?", [postId]);
    return res.json({ liked: existing.length === 0, likeCount: Number(count[0].total) });
  } catch (error) { return next(error); }
}

export async function getComments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.id AS _id, c.body, c.created_at AS createdAt, u.id AS user_id, u.name, u.avatar
       FROM post_comments c INNER JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? AND u.deleted_at IS NULL ORDER BY c.created_at ASC`,
      [Number(req.params.postId)],
    );
    return res.json(rows.map((row) => ({ _id: row._id, body: row.body, createdAt: row.createdAt, author: { _id: row.user_id, name: row.name, avatar: row.avatar } })));
  } catch (error) { return next(error); }
}

export async function addComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body || body.length > 1000) return res.status(400).json({ message: "Comment must be between 1 and 1000 characters." });
    const [result] = await db.query<ResultSetHeader>("INSERT INTO post_comments (post_id, user_id, body) VALUES (?, ?, ?)", [Number(req.params.postId), req.userId, body]);
    return res.status(201).json({ id: result.insertId });
  } catch (error) { return next(error); }
}