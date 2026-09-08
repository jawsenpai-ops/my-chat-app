import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { getProfile, getPublicProfile, getUsers, updateProfile } from "../controllers/userController";
import { userRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.use(protectRoute, userRateLimiter);
router.get("/", getUsers);
router.get("/me", getProfile);
router.get("/:userId", getPublicProfile);
router.patch("/me", updateProfile);

export default router;