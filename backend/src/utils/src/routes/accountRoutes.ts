import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { accountActionRateLimiter } from "../middleware/rateLimit";
import { changeEmail, changePassword, deleteAccount } from "../controllers/accountController";

const router = Router();
router.use(protectRoute, accountActionRateLimiter);
router.patch("/email", changeEmail);
router.patch("/password", changePassword);
router.delete("/", deleteAccount);
export default router;
