import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import chatRoutes from "./routes/chatRoutes";
import messageRoutes from "./routes/messageRoutes";
import userRoutes from "./routes/userRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { apiRateLimiter } from "./middleware/rateLimit";
import helmet from "helmet";
import accountRoutes from "./routes/accountRoutes";
import feedbackRoutes from "./routes/feedbackRoutes";
import adminRoutes from "./routes/adminRoutes";
import postRoutes from "./routes/postRoutes";

const app = express();
app.set("trust proxy", process.env.TRUST_PROXY === "true");
const allowedOrigins = (process.env.FRONTEND_URL || "").split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(helmet());
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
  credentials: allowedOrigins.length > 0,
}));
app.use("/api", apiRateLimiter);
app.use(express.json({ limit: "3mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/posts", postRoutes);
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.use(errorHandler);

export default app;