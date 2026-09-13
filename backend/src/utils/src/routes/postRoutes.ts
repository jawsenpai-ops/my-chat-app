import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { addComment, createPost, deletePost, getComments, getPosts, toggleLike, updatePost } from "../controllers/postController";

const router = Router();
router.use(protectRoute);
router.get("/", getPosts);
router.post("/", createPost);
router.patch("/:postId", updatePost);
router.delete("/:postId", deletePost);
router.post("/:postId/like", toggleLike);
router.get("/:postId/comments", getComments);
router.post("/:postId/comments", addComment);

export default router;