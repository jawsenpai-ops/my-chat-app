import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { clearPushToken, getProfile, getPublicProfile, getUsers, savePushToken, updateProfile } from "../controllers/userController";
import { userRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.use(protectRoute, userRateLimiter);
router.get("/", getUsers);
router.get("/me", getProfile);
router.put("/push-token", savePushToken);
router.delete("/push-token", clearPushToken);
router.get("/:userId", getPublicProfile);
router.patch("/me", updateProfile);

export default router;