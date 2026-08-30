import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { db } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { encryptText } from "./crypto"; // 1. Encryption helper ကို Import လုပ်ပေးထားသည်

export const onlineUsers: Map<string, string> = new Map();

export const initializeSocket = (httpServer: HttpServer) => {
  const io = new SocketServer(httpServer, { cors: { origin: "*" } });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) return next(new Error("Authentication error"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as { userId: number };
      
      const [users] = await db.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE id = ?",
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
    onlineUsers.set(userId, socket.id);
    socket.broadcast.emit("user-online", { userId });

    socket.join(`user:${userId}`);

    socket.on("join-chat", (chatId: string) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on("leave-chat", (chatId: string) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on("send-message", async (data: { chatId: string; text: string }) => {
      try {
        const { chatId, text } = data;

        const [chatAccess] = await db.query<RowDataPacket[]>(
          "SELECT chatId FROM chat_participants WHERE chatId = ? AND userId = ?",
          [chatId, userId]
        );

        if (chatAccess.length === 0) {
          socket.emit("socket-error", { message: "Chat not found" });
          return;
        }

        const encryptedText = encryptText(text);

        const [msgResult] = await db.query<ResultSetHeader>(
          "INSERT INTO messages (chatId, senderId, text) VALUES (?, ?, ?)",
          [chatId, userId, encryptedText]
        );

        const messageId = msgResult.insertId;

        await db.query(
          "UPDATE chats SET lastMessageId = ?, lastMessageAt = NOW() WHERE id = ?",
          [messageId, chatId]
        );

        const [sender] = await db.query<RowDataPacket[]>(
          "SELECT id AS _id, name, avatar FROM users WHERE id = ?",
          [userId]
        );

        const formattedMessage = {
          _id: messageId,
          chat: chatId,
          text: encryptedText,
          displayText: text,
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
      onlineUsers.delete(userId);
      socket.broadcast.emit("user-offline", { userId });
    });
  });

  return io;
};