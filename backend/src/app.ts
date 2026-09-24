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
import chatRequestRoutes from "./routes/chatRequestRoutes";
import friendRoutes from "./routes/friendRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import clientConfigRoutes from "./routes/clientConfigRoutes";

const app = express();
app.set("trust proxy", process.env.TRUST_PROXY === "true");
const allowedOrigins = (process.env.FRONTEND_URL || "").split(",").map((origin) => origin.trim()).filter(Boolean);
if (allowedOrigins.length === 0 && process.env.NODE_ENV === "production") {
  throw new Error("FRONTEND_URL must contain the allowed application origins in production.");
}
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed."));
  },
  credentials: allowedOrigins.length > 0,
}));
app.use("/api", apiRateLimiter);
app.use(express.json({ limit: "60mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

const gatewayPath = process.env.API_GATEWAY_PATH || "/api/v1";
app.use("/api/v1/config", clientConfigRoutes);
if (gatewayPath !== "/api/v1") app.use(`${gatewayPath}/config`, clientConfigRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/chat-requests", chatRequestRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/notifications", notificationRoutes);
app.use(`${gatewayPath}/auth`, authRoutes);
app.use(`${gatewayPath}/chats`, chatRoutes);
app.use(`${gatewayPath}/messages`, messageRoutes);
app.use(`${gatewayPath}/users`, userRoutes);
app.use(`${gatewayPath}/account`, accountRoutes);
app.use(`${gatewayPath}/feedback`, feedbackRoutes);
app.use(`${gatewayPath}/admin`, adminRoutes);
app.use(`${gatewayPath}/posts`, postRoutes);
app.use(`${gatewayPath}/chat-requests`, chatRequestRoutes);
app.use(`${gatewayPath}/friends`, friendRoutes);
app.use(`${gatewayPath}/notifications`, notificationRoutes);
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.use(errorHandler);

export default app;