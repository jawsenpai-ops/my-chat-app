import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { deleteMessage, getMessages } from "../controllers/messageController";
import { messageRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.get("/chat/:chatId", protectRoute, messageRateLimiter, getMessages);
router.delete("/:messageId", protectRoute, messageRateLimiter, deleteMessage);

export default router;