import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { getChats, getOrCreateChat, updateChatAction } from "../controllers/chatController";
import { chatRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.use(protectRoute);
router.use(chatRateLimiter);
router.get("/", getChats);
router.post("/with/:participantId", getOrCreateChat);
router.post("/:chatId/action", updateChatAction);

export default router;