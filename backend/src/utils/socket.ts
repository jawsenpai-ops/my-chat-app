import { Server as SocketServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { db } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { encryptText } from "./crypto"; // 👈 ၁။ encryptText Import ထည့်ထားပါသည်
import { rateLimitStore } from "../middleware/rateLimit";

export const onlineUsers: Map<string, string> = new Map();

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

    socket.on("send-message", async (data: { chatId: string; text: string }) => {
      if (!consumeSocketLimit(socket, userId, "send-message", 30, 60_000)) return;
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
          return;
        }

        const { chatId, text } = data;

        const [chatAccess] = await db.query<RowDataPacket[]>(
          "SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?",
          [chatId, userId]
        );

        if (chatAccess.length === 0) {
          socket.emit("socket-error", { message: "Chat not found" });
          return;
        }

        // 👈 ၂။ DB ထဲ မသိမ်းမီ Plain text ကို Encrypt လုပ်ပါသည်
        const encryptedText = encryptText(text);

        const [msgResult] = await db.query<ResultSetHeader>(
          "INSERT INTO messages (chatId, senderId, text) VALUES (?, ?, ?)",
          [chatId, userId, encryptedText] // 👈 Encrypted text ကို DB ထဲ သို့ ထည့်သည်
        );

        const messageId = msgResult.insertId;

        await db.query(
          "UPDATE chats SET lastMessageAt = NOW(), lastMessageId = ? WHERE id = ?",
          [messageId, chatId]
        );

        const [sender] = await db.query<RowDataPacket[]>(
          "SELECT id AS _id, name, avatar FROM users WHERE id = ?",
          [userId]
        );

        // 👈 ၃။ Socket မှတစ်ဆင့် Mobile App များကို ပို့သည့်အခါ Screen ပေါ်ချက်ချင်းပေါ်စေရန် Plain text တိုင်း ပို့ပေးပါသည်
        const formattedMessage = {
          _id: messageId,
          chat: chatId,
          text: text, 
          sender: sender[0],
          createdAt: new Date().toISOString(),
        };

        io.to(`chat:${chatId}`).emit("new-message", formattedMessage);

        const [participants] = await db.query<RowDataPacket[]>(
          "SELECT userId FROM chat_participants WHERE chatId = ?",
          [chatId]
        );

        for (const p of participants) {
          io.to(`user:${p.userId}`).emit("new-message", formattedMessage);
        }
      } catch (error) {
        socket.emit("socket-error", { message: "Failed to send message" });
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