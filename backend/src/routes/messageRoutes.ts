import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { deleteMessage, getChatReadState, getMessages, sendMessage, togglePinMessage } from "../controllers/messageController";
import { messageRateLimiter } from "../middleware/rateLimit";

const router = Router();

router.get("/chat/:chatId/read-state", protectRoute, messageRateLimiter, getChatReadState);
router.get("/chat/:chatId", protectRoute, messageRateLimiter, getMessages);
router.post("/chat/:chatId", protectRoute, messageRateLimiter, sendMessage);
router.delete("/:messageId", protectRoute, messageRateLimiter, deleteMessage);
router.post("/:messageId/pin", protectRoute, messageRateLimiter, togglePinMessage);

export default router;