import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { addComment, createPost, deleteComment, deletePost, getComments, getPost, getPosts, toggleLike, updatePost } from "../controllers/postController";

const router = Router();
router.use(protectRoute);
router.get("/", getPosts);
router.get("/:postId", getPost);
router.post("/", createPost);
router.patch("/:postId", updatePost);
router.delete("/:postId", deletePost);
router.post("/:postId/like", toggleLike);
router.get("/:postId/comments", getComments);
router.post("/:postId/comments", addComment);
router.delete("/:postId/comments/:commentId", deleteComment);

export default router;