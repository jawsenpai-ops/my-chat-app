import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "chat_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function connectDB() {
  try {
    const connection = await db.getConnection();
    console.log("MySQL Database Connected Successfully.");
    connection.release();
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NOT NULL DEFAULT ''");
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500) NOT NULL DEFAULT ''");
    await db.query("ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS lastReadAt DATETIME NULL");
    await db.query("ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS pinned TINYINT(1) NOT NULL DEFAULT 0");
    await db.query("ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS muted TINYINT(1) NOT NULL DEFAULT 0");
    await db.query("ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS hidden_at DATETIME NULL");
    await db.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at DATETIME NULL");
    await db.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INT NULL");
    await db.query(`CREATE TABLE IF NOT EXISTS chat_requests (id INT AUTO_INCREMENT PRIMARY KEY, sender_id INT NOT NULL, recipient_id INT NOT NULL, status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending', blocked_until DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uq_chat_request_pair (sender_id, recipient_id), INDEX idx_chat_requests_recipient (recipient_id, status), CONSTRAINT fk_chat_requests_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_chat_requests_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB`);
      await db.query(`CREATE TABLE IF NOT EXISTS friend_requests (id INT AUTO_INCREMENT PRIMARY KEY, senderId INT NOT NULL, receiverId INT NOT NULL, status ENUM('pending', 'accepted', 'declined', 'cancelled') NOT NULL DEFAULT 'pending', createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE, UNIQUE KEY unique_friend_request_pair (senderId, receiverId), INDEX idx_friend_requests_receiver_status (receiverId, status), INDEX idx_friend_requests_sender_status (senderId, status)) ENGINE=InnoDB`);
      await db.query(`CREATE TABLE IF NOT EXISTS friendships (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, friendId INT NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (friendId) REFERENCES users(id) ON DELETE CASCADE, UNIQUE KEY unique_friendship (userId, friendId), CONSTRAINT chk_friendship_order CHECK (userId < friendId)) ENGINE=InnoDB`);
      await db.query(`CREATE TABLE IF NOT EXISTS blocked_users (blockerId INT NOT NULL, blockedId INT NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (blockerId, blockedId), FOREIGN KEY (blockerId) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (blockedId) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB`);
    await verifySecuritySchema();
  } catch (error) {
    console.error("Database startup check failed:", error instanceof Error ? error.message : "Unknown database error");
    process.exit(1);
  }
}

async function verifySecuritySchema() {
  const requiredColumns = ["email_verified", "role", "deleted_at", "token_version"];
  const [columns] = await db.query<(RowDataPacket & { Field: string })[]>("SHOW COLUMNS FROM users");
  const availableColumns = new Set(columns.map((column) => column.Field));
  const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));

  const [tables] = await db.query<(RowDataPacket & { TABLE_NAME: string })[]>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?, ?, ?)",
    ["email_verification_tokens", "feedback", "posts", "post_likes", "post_comments"],
  );
  const availableTables = new Set(tables.map((table) => table.TABLE_NAME));
  const missingTables = ["email_verification_tokens", "feedback", "posts", "post_likes", "post_comments"]
    .filter((table) => !availableTables.has(table));

  if (missingColumns.length > 0 || missingTables.length > 0) {
    throw new Error(
      `Database migration required. Missing users columns: ${missingColumns.join(", ") || "none"}; missing tables: ${missingTables.join(", ") || "none"}. Apply migrations/001_security_accounts_feedback.sql and migrations/004_posts.sql before starting the service.`,
    );
  }
}