import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}