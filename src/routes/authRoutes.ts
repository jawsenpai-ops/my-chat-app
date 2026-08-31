import { Router } from "express";
import { register, login, getMe } from "../controllers/authController";
import { protectRoute } from "../middleware/auth";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", protectRoute, getMe);

export default router;