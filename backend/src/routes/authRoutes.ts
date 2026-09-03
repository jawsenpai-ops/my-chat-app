import { Router } from "express";
import { register, login, getMe } from "../controllers/authController";
import { protectRoute } from "../middleware/auth";
import { authRateLimiter, loginRateLimiter, registerRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.get("/me", protectRoute, authRateLimiter, getMe);

export default router;