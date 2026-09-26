import { Server as SocketServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { db } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { decryptText, encryptText } from "./crypto"; // 👈 ၁။ encryptText Import ထည့်ထားပါသည်
import { rateLimitStore } from "../middleware/rateLimit";
import { sendExpoPush } from "./pushService";

export const onlineUsers: Map<string, string> = new Map();
let socketIo: SocketServer | null = null;
export const emitUserEvent = (userId: number | string, event: string, payload: unknown) => {
  socketIo?.to(`user:${userId}`).emit(event, payload);
};
type NotificationPayload = {
  type: string;
  message: string;
  entityId?: number;
  senderId?: number | string;
};

export const notifyUser = async (userId: number | string, payload: NotificationPayload) => {
  const persistableTypes = ["FRIEND_REQ", "FRIEND_ACCEPT", "COMMENT", "LIKE"];
  if (persistableTypes.includes(payload.type) && payload.senderId !== undefined && payload.entityId !== undefined) {
    try {
      await db.query(
        "INSERT INTO notifications (recipientId, senderId, type, entityId, message) VALUES (?, ?, ?, ?, ?)",
        [userId, payload.senderId, payload.type, payload.entityId, payload.message],
      );
    } catch (error) {
      console.error("Failed to persist notification", error instanceof Error ? error.message : "Unknown database error");
    }
  }
  socketIo?.to(`user:${userId}`).emit("notification", payload);
};

const SOCKET_ERROR_MESSAGE = "Too many requests. Please try again later.";

const consumeSocketLimit = (
  socket: Socket,
  userId: string,
  event: string,
  limit: number,
  windowMs: number,
) => {
  const result = rateLimitStore.consume(`socket:${userId}:${event}`, limit, windowMs);
  if (!result.allowed) {
    socket.emit("socket-error", {
      message: SOCKET_ERROR_MESSAGE,
      retryAfterSeconds: result.retryAfterSeconds,
    });
    return false;
  }
  return true;
};

export const initializeSocket = (httpServer: HttpServer) => {
  const io = new SocketServer(httpServer, { cors: { origin: "*" } });
  socketIo = io;

  io.use(async (socket, next) => {
    const connectionLimit = rateLimitStore.consume(
      `socket-connection:ip:${socket.handshake.address}`,
      20,
      15 * 60_000,
    );
    if (!connectionLimit.allowed) return next(new Error(SOCKET_ERROR_MESSAGE));

    const token = socket.handshake.auth.token;

    if (!token) return next(new Error("Authentication error"));

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error("Authentication error"));
      const decoded = jwt.verify(token, secret) as { userId: number };
      
      const [users] = await db.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL",
        [decoded.userId]
      );

      if (users.length === 0) return next(new Error("User not found"));

      socket.data.userId = decoded.userId.toString();
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.emit("online-users", { userIds: Array.from(onlineUsers.keys()) });
    const wasOnline = onlineUsers.has(userId);
    onlineUsers.set(userId, socket.id);
    if (!wasOnline) socket.broadcast.emit("user-online", { userId });

    socket.join(`user:${userId}`);

    socket.on("join-chat", async (chatId: string) => {
      if (!consumeSocketLimit(socket, userId, "join-chat", 30, 60_000)) return;
      if (typeof chatId !== "string" || !/^\d+$/.test(chatId) || chatId.length > 64) return;
      try {
        const [access] = await db.query<RowDataPacket[]>("SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?", [chatId, userId]);
        if (access.length > 0) socket.join(`chat:${chatId}`);
      } catch (error) {
        socket.emit("socket-error", { message: "Unable to join chat" });
      }
    });

    socket.on("leave-chat", async (chatId: string) => {
      if (!consumeSocketLimit(socket, userId, "leave-chat", 60, 60_000)) return;
      if (typeof chatId !== "string" || !/^\d+$/.test(chatId) || chatId.length > 64) return;
      socket.leave(`chat:${chatId}`);
    });

    socket.on("delete-message", async (messageId: string) => {
      if (!consumeSocketLimit(socket, userId, "delete-message", 20, 60_000)) return;
      if (typeof messageId !== "string" || !/^\d+$/.test(messageId)) return;
      try {
        const [messages] = await db.query<RowDataPacket[]>(
          `SELECT m.id, m.chatId, m.senderId
           FROM messages m JOIN chat_participants cp ON cp.chatId = m.chatId AND cp.userId = ?
           WHERE m.id = ? AND m.deleted_at IS NULL`,
          [userId, messageId],
        );
        if (messages.length === 0 || String(messages[0].senderId) !== String(userId)) {
          socket.emit("socket-error", { message: "Forbidden." });
          return;
        }
        await db.query("UPDATE messages SET deleted_at = NOW() WHERE id = ? AND senderId = ? AND deleted_at IS NULL", [messageId, userId]);
        io.to(`chat:${messages[0].chatId}`).emit("message-deleted", { messageId });
      } catch (error) {
        socket.emit("socket-error", { message: "Failed to delete message" });
      }
    });

    socket.on("chat-read", async (chatId: string) => {
      if (!consumeSocketLimit(socket, userId, "chat-read", 60, 60_000)) return;
      if (typeof chatId !== "string" || !/^\d+$/.test(chatId)) return;
      try {
        const [chatAccess] = await db.query<RowDataPacket[]>(
          "SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?",
          [chatId, userId],
        );
        if (chatAccess.length === 0) return;
        await db.query(
          "UPDATE chat_participants SET lastReadAt = NOW() WHERE chatId = ? AND userId = ?",
          [chatId, userId],
        );
        socket.emit("chat-read", { chatId });
      } catch (error) {
        // Reading a chat should not interrupt the conversation.
      }
    });

    socket.on("send-message", async (
      data: { chatId: string; text: string; replyToId?: string | number | null; clientMessageId?: string },
      acknowledge?: (result: { ok: boolean; message?: Record<string, unknown>; error?: string }) => void,
    ) => {
      if (!consumeSocketLimit(socket, userId, "send-message", 30, 60_000)) {
        acknowledge?.({ ok: false, error: SOCKET_ERROR_MESSAGE });
        return;
      }
      try {
        if (
          !data ||
          typeof data.chatId !== "string" ||
          data.chatId.length === 0 ||
          data.chatId.length > 64 ||
          typeof data.text !== "string" ||
          data.text.trim().length === 0 ||
          data.text.length > 4_000
        ) {
          socket.emit("socket-error", { message: "Invalid message" });
          acknowledge?.({ ok: false, error: "Invalid message" });
          return;
        }

        const { chatId, text, clientMessageId } = data;
        if (clientMessageId !== undefined && (typeof clientMessageId !== "string" || clientMessageId.length < 1 || clientMessageId.length > 100)) {
          socket.emit("socket-error", { message: "Invalid message ID" });
          acknowledge?.({ ok: false, error: "Invalid message ID" });
          return;
        }
        const replyToId = data.replyToId ? Number(data.replyToId) : null;

        const [chatAccess] = await db.query<RowDataPacket[]>(
          "SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?",
          [chatId, userId]
        );

        if (chatAccess.length === 0) {
          socket.emit("socket-error", { message: "Chat not found" });
          acknowledge?.({ ok: false, error: "Chat not found" });
          return;
        }

        const [blockedRequests] = await db.query<RowDataPacket[]>(
          `SELECT r.id FROM chat_requests r
           JOIN chat_participants other ON other.chatId = ? AND other.userId != ?
           WHERE r.sender_id = ? AND r.recipient_id = other.userId AND r.status = 'rejected' AND r.blocked_until > NOW()`,
          [chatId, userId, userId],
        );
        if (blockedRequests.length > 0) {
          const error = "You cannot message this user for one hour.";
          socket.emit("socket-error", { message: error });
          acknowledge?.({ ok: false, error });
          return;
        }

        if (replyToId !== null) {
          const [replyAccess] = await db.query<RowDataPacket[]>(
            "SELECT m.id FROM messages m JOIN chat_participants cp ON cp.chatId = m.chatId AND cp.userId = ? WHERE m.id = ? AND m.chatId = ? AND m.deleted_at IS NULL",
            [userId, replyToId, chatId],
          );
          if (replyAccess.length === 0) {
            socket.emit("socket-error", { message: "Reply message not found" });
            acknowledge?.({ ok: false, error: "Reply message not found" });
            return;
          }
        }

        const encryptedText = encryptText(text);

        const [msgResult] = await db.query<ResultSetHeader>(
          `INSERT INTO messages (chatId, senderId, reply_to_id, text, client_message_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
          [chatId, userId, replyToId, encryptedText, clientMessageId || null],
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
          [userId]
        );

        let replyTo = null;
        const storedReplyToId = storedMessages[0]?.replyToId;
        if (storedReplyToId !== null && storedReplyToId !== undefined) {
          const [replyRows] = await db.query<RowDataPacket[]>("SELECT m.id, m.text, u.name AS senderName FROM messages m JOIN users u ON u.id = m.senderId WHERE m.id = ?", [storedReplyToId]);
          if (replyRows.length > 0) replyTo = { _id: replyRows[0].id, text: decryptText(replyRows[0].text), senderName: replyRows[0].senderName };
        }
        const formattedMessage = {
          _id: messageId,
          chat: chatId,
          text: decryptText(storedMessages[0].text),
          sender: sender[0],
          createdAt: storedMessages[0].createdAt,
          replyTo,
          ...(clientMessageId ? { clientMessageId } : {}),
        };

        io.to(`chat:${chatId}`).emit("new-message", formattedMessage);

        acknowledge?.({ ok: true, message: formattedMessage });

        const [participants] = await db.query<RowDataPacket[]>(
          `SELECT u.id AS userId, u.pushToken
           FROM chat_participants cp JOIN users u ON u.id = cp.userId
           WHERE cp.chatId = ?`,
          [chatId]
        );

        for (const p of participants) {
          io.to(`user:${p.userId}`).emit("new-message", formattedMessage);
          if (String(p.userId) !== userId && typeof p.pushToken === "string" && p.pushToken) {
            const recipientSockets = await io.in(`user:${p.userId}`).fetchSockets();
            if (recipientSockets.length === 0) {
              const preview = formattedMessage.text.length > 120 ? `${formattedMessage.text.slice(0, 117)}...` : formattedMessage.text;
              const senderAvatar = typeof sender[0]?.avatar === "string" && sender[0].avatar.startsWith("https://") && sender[0].avatar.length <= 500
                ? sender[0].avatar
                : "";
              void sendExpoPush(p.pushToken, sender[0]?.name || "New message", preview, {
                type: "chat-message",
                chatId: String(chatId),
                senderId: String(userId),
                senderName: String(sender[0]?.name || "Chat"),
                senderAvatar,
                message: preview,
              });
            }
          }
        }
      } catch (error) {
        socket.emit("socket-error", { message: "Failed to send message" });
        acknowledge?.({ ok: false, error: "Failed to send message" });
      }
    });

    socket.on("typing", async (data: { chatId: string; isTyping: boolean }) => {
      if (!consumeSocketLimit(socket, userId, "typing", 30, 10_000)) return;
      if (
        !data ||
        typeof data.chatId !== "string" ||
        data.chatId.length === 0 ||
        data.chatId.length > 64 ||
        typeof data.isTyping !== "boolean"
      ) return;

      try {
        const [access] = await db.query<RowDataPacket[]>("SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?", [data.chatId, userId]);
        if (access.length === 0) return;
      } catch (error) {
        return;
      }

      const typingPayload = {
        userId,
        chatId: data.chatId,
        isTyping: data.isTyping,
      };

      socket.to(`chat:${data.chatId}`).emit("typing", typingPayload);

      try {
        const [other] = await db.query<RowDataPacket[]>(
          "SELECT userId FROM chat_participants WHERE chatId = ? AND userId != ?",
          [data.chatId, userId]
        );
        if (other.length > 0) {
          socket.to(`user:${other[0].userId}`).emit("typing", typingPayload);
        }
      } catch (error) {
        // silent error
      }
    });

    socket.on("disconnect", () => {
      if (onlineUsers.get(userId) !== socket.id) return;
      onlineUsers.delete(userId);
      socket.broadcast.emit("user-offline", { userId });
    });
  });

  return io;
};