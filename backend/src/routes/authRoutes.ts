import { Router } from "express";
import { register, login, getMe, verifyEmail, resendVerification, forgotPassword, resetPassword, sendCode, verifyCode } from "../controllers/authController";
import { protectRoute } from "../middleware/auth";
import { authRateLimiter, forgotPasswordRateLimiter, loginRateLimiter, registerRateLimiter, resendVerificationRateLimiter, resetPasswordRateLimiter, sendCodeRateLimiter } from "../middleware/rateLimit";

const router = Router();
router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.post("/send-code", sendCodeRateLimiter, sendCode);
router.post("/verify-code", verifyCode);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPassword);
router.post("/reset-password", resetPasswordRateLimiter, resetPassword);
router.get("/me", protectRoute, authRateLimiter, getMe);
router.post("/resend-verification", protectRoute, resendVerificationRateLimiter, resendVerification);

export default router;