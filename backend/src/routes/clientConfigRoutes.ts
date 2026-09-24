import { Router } from "express";
import { getClientInit } from "../controllers/clientConfigController";

const router = Router();
router.get("/client-init", getClientInit);

export default router;