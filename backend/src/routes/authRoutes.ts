import { Router } from "express";
import { register, login, getMe, verifyEmail, resendVerification } from "../controllers/authController";
import { protectRoute } from "../middleware/auth";
import { authRateLimiter, loginRateLimiter, registerRateLimiter, resendVerificationRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.get("/verify-email", verifyEmail);
router.get("/me", protectRoute, authRateLimiter, getMe);
router.post("/resend-verification", protectRoute, resendVerificationRateLimiter, resendVerification);

export default router;