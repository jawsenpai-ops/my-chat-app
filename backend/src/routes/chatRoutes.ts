import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { getChats, getOrCreateChat } from "../controllers/chatController";
import { chatRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.use(protectRoute);
router.use(chatRateLimiter);
router.get("/", getChats);
router.post("/with/:participantId", getOrCreateChat);

export default router;