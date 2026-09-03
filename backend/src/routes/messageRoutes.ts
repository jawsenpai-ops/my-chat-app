import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { getMessages } from "../controllers/messageController";
import { messageRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.get("/chat/:chatId", protectRoute, messageRateLimiter, getMessages);

export default router;