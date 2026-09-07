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