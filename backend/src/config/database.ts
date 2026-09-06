import mysql from "mysql2/promise";
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
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}