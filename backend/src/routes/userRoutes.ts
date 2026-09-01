import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { getProfile, getUsers, updateProfile } from "../controllers/userController";

const router = Router();
router.get("/", protectRoute, getUsers);
router.get("/me", protectRoute, getProfile);
router.patch("/me", protectRoute, updateProfile);

export default router;