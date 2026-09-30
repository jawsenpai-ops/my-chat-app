import { PostComment, PostCommentsResponse } from "../types";

const chronological = (first: PostComment, second: PostComment) =>
  new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();

const nestComments = (flatComments: PostComment[]): PostComment[] => {
  const comments = flatComments.map((comment) => ({
    ...comment,
    parentCommentId: comment.parentCommentId ?? comment.parentId ?? null,
    body: comment.body ?? comment.text ?? "",
    author: comment.author ?? comment.user!,
    replies: [] as PostComment[],
  }));
  const byId = new Map(comments.map((comment) => [String(comment._id), comment]));
  const roots: PostComment[] = [];

  comments.forEach((comment) => {
    const parentId = comment.parentCommentId;
    const parent = parentId === null || parentId === undefined ? undefined : byId.get(String(parentId));
    if (parent) parent.replies!.push(comment);
    else roots.push(comment);
  });

  const sortReplies = (items: PostComment[]) => {
    items.sort(chronological);
    items.forEach((item) => sortReplies(item.replies!));
  };
  sortReplies(roots);
  return roots;
};

const sortCommentTree = (comments: PostComment[]): PostComment[] =>
  comments.map((comment) => ({
    ...comment,
    replies: sortCommentTree(comment.replies || []),
  })).sort(chronological);

export const normalizeCommentThreads = (
  response: PostCommentsResponse | PostComment[],
  offset = 0,
  limit = 4,
): PostCommentsResponse => {
  const comments = Array.isArray(response) ? response : response.comments;
  const hasFlatReplies = comments.some((comment) =>
    (comment.parentCommentId ?? comment.parentId) != null,
  );
  const isNested = comments.every((comment) => Array.isArray(comment.replies));

  if (isNested) {
    const roots = sortCommentTree(comments);
    return {
      comments: Array.isArray(response) ? roots.slice(offset, offset + limit) : roots,
      hasMore: Array.isArray(response)
        ? offset + Math.min(limit, roots.length) < roots.length
        : Boolean(response.hasMore),
    };
  }

  if (hasFlatReplies || !Array.isArray(response)) {
    const nested = nestComments(comments);
    if (Array.isArray(response)) return { comments: nested.slice(offset, offset + limit), hasMore: offset + limit < nested.length };
    return { comments: nested, hasMore: Boolean(response.hasMore) };
  }

  const roots = [...comments].sort(chronological);
  const page = roots.slice(offset, offset + limit);
  return { comments: page, hasMore: offset + page.length < roots.length };
};

export const flattenCommentThreads = (comments: PostComment[]): PostComment[] =>
  comments.flatMap((comment) => [comment, ...flattenCommentThreads(comment.replies || [])]);

export const removeCommentBranch = (comments: PostComment[], targetId: string): { comments: PostComment[]; removedCount: number } => {
  let removedCount = 0;
  const nextComments = comments.flatMap((comment) => {
    if (String(comment._id) === targetId) {
      removedCount += flattenCommentThreads([comment]).length;
      return [];
    }
    const updatedReplies = removeCommentBranch(comment.replies || [], targetId);
    removedCount += updatedReplies.removedCount;
    return [{ ...comment, replies: updatedReplies.comments }];
  });
  return { comments: nextComments, removedCount };
};