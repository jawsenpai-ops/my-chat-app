import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { feedbackRateLimiter } from "../middleware/rateLimit";
import { createFeedback, getMyFeedback } from "../controllers/feedbackController";

const router = Router();
router.use(protectRoute);
router.post("/", feedbackRateLimiter, createFeedback);
router.get("/mine", getMyFeedback);
export default router;
