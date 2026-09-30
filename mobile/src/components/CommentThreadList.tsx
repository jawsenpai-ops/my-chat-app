import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { flattenCommentThreads } from "../api/commentThreads";
import { AppColors } from "../theme/colors";
import { PostComment } from "../types";

interface Props {
  comments: PostComment[];
  userId?: number | string;
  postAuthorId?: number | string;
  expandedReplyThreads: Set<string>;
  onReply: (comment: PostComment) => void;
  onDelete: (comment: PostComment) => void;
  onToggleReplies: (commentId: string) => void;
}

export const CommentThreadList: React.FC<Props> = ({ comments, userId, postAuthorId, expandedReplyThreads, onReply, onDelete, onToggleReplies }) => {
  const commentsById = new Map(flattenCommentThreads(comments).map((comment) => [String(comment._id), comment]));

  const renderComment = (comment: PostComment, depth = 0): React.ReactElement => {
    const children = comment.replies || [];
    const showReplies = expandedReplyThreads.has(String(comment._id));
    const parentId = comment.parentCommentId ?? comment.parentId;
    const parentName = parentId == null ? undefined : commentsById.get(String(parentId))?.author.name;
    const canDelete = String(comment.author._id) === String(userId) || String(comment.author._id) === String(postAuthorId);

    return (
      <View key={String(comment._id)} style={[styles.thread, depth > 0 && depth <= 3 && styles.replyThread]}>
        <View style={styles.commentRow}>
          <Image source={{ uri: comment.author.avatar }} style={styles.avatar} />
          <View style={styles.commentBody}>
            <Text style={styles.commentText}>
              <Text style={styles.commentName}>{comment.author.name}: </Text>
              {parentName ? <Text style={styles.replyMention}>@{parentName} </Text> : null}
              {comment.body}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => onReply(comment)}><Text style={styles.replyLink}>Reply</Text></TouchableOpacity>
              {canDelete && <TouchableOpacity onPress={() => onDelete(comment)}><Text style={styles.deleteLink}>Delete</Text></TouchableOpacity>}
            </View>
          </View>
        </View>
        {children.length > 0 && (
          <TouchableOpacity onPress={() => onToggleReplies(String(comment._id))}>
            <Text style={styles.threadToggle}>{showReplies ? "Hide replies" : `View ${children.length} ${children.length === 1 ? "reply" : "replies"}`}</Text>
          </TouchableOpacity>
        )}
        {showReplies && children.map((child) => renderComment(child, depth + 1))}
      </View>
    );
  };

  return <View>{comments.map((comment) => renderComment(comment))}</View>;
};

const styles = StyleSheet.create({
  thread: { width: "100%" },
  replyThread: { marginLeft: 16, width: "auto", borderLeftWidth: 1, borderLeftColor: "rgba(20,42,68,0.12)", paddingLeft: 8 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  commentBody: { flex: 1 },
  commentText: { color: AppColors.text, fontSize: 13, lineHeight: 18 },
  commentName: { fontWeight: "700" },
  replyMention: { color: AppColors.buttonInner, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  replyLink: { color: AppColors.buttonInner, fontSize: 11, fontWeight: "700" },
  deleteLink: { color: AppColors.textMuted, fontSize: 11, fontWeight: "700" },
  threadToggle: { color: AppColors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 8 },
});