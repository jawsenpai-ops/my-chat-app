import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend", ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
  path.resolve(__dirname, "..", ".env"),
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

export const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "chatdb",
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
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