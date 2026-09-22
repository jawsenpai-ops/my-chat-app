import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { getNotifications, markNotificationRead } from "../controllers/notificationController";

const router = Router();
router.use(protectRoute);
router.get("/", getNotifications);
router.patch("/:notificationId/read", markNotificationRead);
export default router;
