import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { getFeedback, getStats, listFeedback, listUsers, updateFeedback } from "../controllers/adminController";

const router = Router();
router.use(protectRoute, requireAdmin);
router.get("/feedback", listFeedback);
router.get("/feedback/:id", getFeedback);
router.patch("/feedback/:id", updateFeedback);
router.get("/stats", getStats);
router.get("/users", listUsers);
export default router;
