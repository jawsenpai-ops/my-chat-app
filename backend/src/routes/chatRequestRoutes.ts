import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { createRequest, getRequests, respondToRequest } from "../controllers/chatRequestController";

const router = Router();
router.use(protectRoute);
router.get("/", getRequests);
router.post("/with/:recipientId", createRequest);
router.post("/:requestId/respond", respondToRequest);
export default router;