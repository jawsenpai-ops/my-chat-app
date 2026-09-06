import { Router } from "express";
import { register, login, getMe, verifyEmail, resendVerification, forgotPassword, resetPassword } from "../controllers/authController";
import { protectRoute } from "../middleware/auth";
import { authRateLimiter, forgotPasswordRateLimiter, loginRateLimiter, registerRateLimiter, resendVerificationRateLimiter, resetPasswordRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPassword);
router.post("/reset-password", resetPasswordRateLimiter, resetPassword);
router.get("/me", protectRoute, authRateLimiter, getMe);
router.post("/resend-verification", protectRoute, resendVerificationRateLimiter, resendVerification);

export default router;