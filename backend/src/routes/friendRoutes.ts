import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { acceptFriendRequest, cancelFriendRequest, declineFriendRequest, getFriends, getIncomingRequests, getOutgoingRequests, getRelationshipStatus, removeFriend, sendFriendRequest } from "../controllers/friendController";

const router = Router();
router.use(protectRoute);
router.get("/", getFriends);
router.get("/requests/incoming", getIncomingRequests);
router.get("/requests/outgoing", getOutgoingRequests);
router.get("/status/:userId", getRelationshipStatus);
router.post("/request/:userId", sendFriendRequest);
router.delete("/request/:userId", cancelFriendRequest);
router.post("/request/:requestId/accept", acceptFriendRequest);
router.post("/request/:requestId/decline", declineFriendRequest);
router.delete("/:userId", removeFriend);
export default router;