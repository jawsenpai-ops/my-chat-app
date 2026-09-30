import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiCall } from "../api/client";
import { normalizeCommentThreads, removeCommentBranch } from "../api/commentThreads";
import { readCachedComments, readCachedPost, saveCachedComments, saveCachedPost } from "../api/offlinePostCache";
import { CommentThreadList } from "../components/CommentThreadList";
import { CommentBubbleIcon } from "../components/CommentBubbleIcon";
import { LikeIcon } from "../components/LikeIcon";
import { AppColors } from "../theme/colors";
import { Post, PostComment, PostCommentsResponse, RootStackParamList, User } from "../types";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Post">;

export const PostScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const postId = route.params.postId;
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Set<string>>(new Set());
  const [fullScreenImages, setFullScreenImages] = useState<string[]>([]);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [friendStatus, setFriendStatus] = useState<"none" | "pending_sent" | "friends" | "pending_received" | "blocked">("none");
  const [friendActionId, setFriendActionId] = useState<string | null>(null);

  const loadPost = async () => {
    const cachedPost = await readCachedPost(postId);
    if (cachedPost) {
      setPost(cachedPost);
      setLoading(false);
    }

    const cachedComments = await readCachedComments(postId);
    if (cachedComments.length) {
      setComments(cachedComments);
    }

    let loadedPost: Post | null = cachedPost;
    try {
      const data = await apiCall<Post>(`/posts/${postId}`);
      loadedPost = data;
      setPost(data);
      await saveCachedPost(postId, data);
    } catch (error: any) {
      if (!cachedPost) Alert.alert("Could not load post", error.message);
    }

    try {
      const commentData = normalizeCommentThreads(await apiCall<PostCommentsResponse | PostComment[]>(`/posts/${postId}/comments?limit=1000&offset=0`), 0, 1000);
      setComments(commentData.comments);
      await saveCachedComments(postId, commentData.comments);
    } catch (error: any) {
      Alert.alert("Could not load comments", error.message);
    }

    if (loadedPost?.author?._id && String(loadedPost.author._id) !== String(user?._id)) {
      try {
        const status = await apiCall<{ status: typeof friendStatus }>(`/friends/status/${loadedPost.author._id}`);
        setFriendStatus(status.status ?? "none");
      } catch (error: any) {
        Alert.alert("Could not load friend status", error.message);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPost();
  }, [postId]);

  useEffect(() => {
    StatusBar.setHidden(fullScreenImages.length > 0, "fade");
    return () => StatusBar.setHidden(false, "fade");
  }, [fullScreenImages.length]);

  const authorOnline = useMemo(() => !!post && (String(post.author._id) === String(user?._id) || true), [post, user?._id]);

  const sendPostFriendRequest = async (authorId: number | string) => {
    const id = String(authorId);
    setFriendActionId(id);
    setFriendStatus("pending_sent");
    try {
      await apiCall(`/friends/request/${authorId}`, { method: "POST" });
    } catch (error: any) {
      setFriendStatus("none");
      Alert.alert("Could not send friend request", error.message);
    } finally {
      setFriendActionId(null);
    }
  };

  const toggleLike = async () => {
    if (!post) return;
    const optimistic = { ...post, likedByMe: !post.likedByMe, likeCount: post.likeCount + (post.likedByMe ? -1 : 1) };
    setPost(optimistic);
    try {
      await apiCall(`/posts/${post._id}/like`, { method: "POST" });
      await saveCachedPost(String(post._id), optimistic);
    } catch (error: any) {
      setPost(post);
      Alert.alert("Could not update like", error.message);
    }
  };

  const addComment = async () => {
    if (!post || !commentText.trim()) return;
    setSubmitting(true);
    try {
      await apiCall(`/posts/${post._id}/comments`, { method: "POST", body: JSON.stringify({ body: commentText, parentCommentId: replyTo?._id || null }) });
      setCommentText("");
      setReplyTo(null);
      const commentData = normalizeCommentThreads(await apiCall<PostCommentsResponse | PostComment[]>(`/posts/${post._id}/comments?limit=1000&offset=0`), 0, 1000);
      setComments(commentData.comments);
      await saveCachedComments(String(post._id), commentData.comments);
      if (replyTo) setExpandedReplyThreads((current) => new Set(current).add(String(replyTo._id)));
      setPost((current) => {
        if (!current) return current;
        const updatedPost = { ...current, commentCount: current.commentCount + 1 };
        void saveCachedPost(String(post._id), updatedPost);
        return updatedPost;
      });
    } catch (error: any) {
      Alert.alert("Could not add comment", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (comment: PostComment) => {
    if (!post) return;
    Alert.alert("Delete comment", "Delete this comment and its replies?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await apiCall(`/posts/${post._id}/comments/${comment._id}`, { method: "DELETE" });
          const updated = removeCommentBranch(comments, String(comment._id));
          setComments(updated.comments);
          setPost((current) => current ? { ...current, commentCount: Math.max(0, current.commentCount - updated.removedCount) } : current);
        } catch (error: any) {
          Alert.alert("Could not delete comment", error.message);
        }
      } },
    ]);
  };

  const openFullScreen = (photos: string[], index: number) => {
    setFullScreenImages(photos);
    setFullScreenIndex(index);
  };

  const startReply = (comment: PostComment) => {
    setReplyTo(comment);
  };

  const toggleReplies = (commentId: string) => setExpandedReplyThreads((current) => {
    const next = new Set(current);
    if (next.has(commentId)) next.delete(commentId);
    else next.add(commentId);
    return next;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={AppColors.buttonInner} /><Text style={styles.empty}>Loading post…</Text></View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.title}>Post</Text><View style={styles.headerSpace} /></View>
        <View style={styles.loadingBox}><Text style={styles.empty}>Post not found.</Text></View>
      </SafeAreaView>
    );
  }

  const photos = post.imageUrls?.length ? post.imageUrls : post.imageUrl ? [post.imageUrl] : [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>Post</Text>
        <TouchableOpacity onPress={() => Share.share({ message: `https://ikiyadm.com/posts/${post._id}` })}><Text style={styles.share}>Share</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <TouchableOpacity style={styles.authorWrap} onPress={() => navigation.navigate("Profile", { userId: post.author._id, online: authorOnline })}>
              <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
              <View style={styles.authorCopy}>
                <View style={styles.authorNameRow}>
                  <Text style={styles.authorName}>{post.author.name}</Text>
                  {String(post.author._id) !== String(user?._id) && (
                    friendStatus === "friends" ? <Text style={styles.partnerLabel}>Partner</Text> :
                    friendStatus === "pending_sent" ? <Text style={styles.pendingLabel}>Pending</Text> :
                    <TouchableOpacity disabled={friendActionId === String(post.author._id)} onPress={() => sendPostFriendRequest(post.author._id)}>
                      <Text style={styles.addFriendLabel}>{friendActionId === String(post.author._id) ? "..." : "Add Friend"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.meta}>{new Date(post.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {!!post.body && <Text style={styles.postBody}>{post.body}</Text>}

          {photos.length > 0 && (
            <View style={styles.photoWrap}>
              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={photos}
                keyExtractor={(_, index) => `${post._id}-${index}`}
                renderItem={({ item, index }) => (
                  <TouchableOpacity onPress={() => openFullScreen(photos, index)} activeOpacity={0.9}>
                    <Image source={{ uri: item }} style={styles.feedPhoto} resizeMode="cover" />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={toggleLike} style={styles.likeAction} accessibilityRole="button" accessibilityLabel={post.likedByMe ? "Unlike post" : "Like post"} accessibilityState={{ selected: post.likedByMe }}>
              <LikeIcon liked={!!post.likedByMe} />
              <Text style={styles.actionText}>{post.likeCount}</Text>
            </TouchableOpacity>
            <View style={styles.commentCountAction}>
              <CommentBubbleIcon />
              <Text style={styles.actionText}>{post.commentCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.commentsPanel}>
          <Text style={styles.sectionTitle}>Comments</Text>
          {comments.length === 0 ? <Text style={styles.empty}>No comments yet.</Text> : <CommentThreadList comments={comments} userId={user?._id} postAuthorId={post.author._id} expandedReplyThreads={expandedReplyThreads} onReply={startReply} onDelete={deleteComment} onToggleReplies={toggleReplies} />}
        </View>
      </ScrollView>

      <View style={styles.commentComposer}>
        {replyTo && <Text style={styles.replyingTo}>Replying to @{replyTo.author.name}</Text>}
        <TextInput
          value={commentText}
          onChangeText={setCommentText}
          placeholder={replyTo ? `Reply to @${replyTo.author.name}` : "Write a comment..."}
          placeholderTextColor={AppColors.placeholder}
          style={styles.commentInput}
          multiline
        />
        <View style={styles.submitRow}>
          {replyTo && <TouchableOpacity onPress={() => setReplyTo(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>}
          <TouchableOpacity onPress={addComment} disabled={submitting || !commentText.trim()}>
            <Text style={[styles.postLink, (!commentText.trim() || submitting) && styles.disabledButton]}>{submitting ? "Posting..." : "Post"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={fullScreenImages.length > 0} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setFullScreenImages([])}>
        <View style={styles.fullScreen}>
          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={fullScreenImages}
            initialScrollIndex={fullScreenIndex}
            getItemLayout={(_, index) => ({ length: Dimensions.get("window").width, offset: Dimensions.get("window").width * index, index })}
            onMomentumScrollEnd={(event) => setFullScreenIndex(Math.round(event.nativeEvent.contentOffset.x / Dimensions.get("window").width))}
            keyExtractor={(_, index) => `full-photo-${index}`}
            renderItem={({ item: uri }) => <Image source={{ uri }} style={styles.fullScreenImage} resizeMode="contain" />}
          />
          <View style={styles.fullScreenCounter}><Text style={styles.fullScreenCounterText}>{fullScreenIndex + 1}/{fullScreenImages.length}</Text></View>
          <TouchableOpacity style={styles.closeButton} onPress={() => setFullScreenImages([])}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  back: { color: AppColors.primaryDark, fontSize: 38, lineHeight: 38 },
  title: { color: AppColors.primaryDark, fontSize: 20, fontWeight: "700" },
  share: { color: AppColors.buttonInner, fontSize: 14, fontWeight: "700" },
  headerSpace: { width: 28 },
  content: { padding: 12, paddingBottom: 24 },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  empty: { color: AppColors.textMuted, fontSize: 14 },
  postCard: { backgroundColor: AppColors.surface, borderRadius: 16, padding: 14, marginBottom: 12 },
  postHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  authorWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: AppColors.whiteSoft, marginRight: 10 },
  authorCopy: { flex: 1, minWidth: 0 },
  authorNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  authorName: { color: AppColors.primaryDark, fontWeight: "700" },
  meta: { color: AppColors.textMuted, fontSize: 11, marginTop: 3 },
  addFriendLabel: { color: AppColors.buttonInner, fontSize: 11, fontWeight: "700" },
  pendingLabel: { color: AppColors.textMuted, fontSize: 11, fontWeight: "700" },
  partnerLabel: { color: AppColors.success, fontSize: 11, fontWeight: "700" },
  postBody: { color: AppColors.text, fontSize: 15, lineHeight: 22, marginTop: 14 },
  photoWrap: { marginTop: 12 },
  feedPhoto: { width: Dimensions.get("window").width - 56, aspectRatio: 4 / 5, borderRadius: 12, backgroundColor: AppColors.whiteSoft },
  actionRow: { flexDirection: "row", gap: 22, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(20,42,68,0.08)" },
  actionText: { color: AppColors.primaryDark, fontWeight: "600", fontSize: 13 },
  commentCountAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  liked: { color: AppColors.buttonInner },
  commentsPanel: { backgroundColor: AppColors.surface, borderRadius: 16, padding: 14 },
  sectionTitle: { color: AppColors.primaryDark, fontWeight: "700", fontSize: 16, marginBottom: 12 },
  commentComposer: { backgroundColor: AppColors.background, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 18, borderTopWidth: 1, borderTopColor: "rgba(20,42,68,0.08)" },
  replyingTo: { color: AppColors.textMuted, fontSize: 12, marginBottom: 6 },
  commentInput: { backgroundColor: AppColors.white, color: AppColors.inputText, borderRadius: 12, borderWidth: 1, borderColor: "rgba(20,42,68,0.08)", minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" },
  submitRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 8 },
  cancelText: { color: AppColors.textMuted, fontWeight: "700", marginRight: 12 },
  postLink: { color: AppColors.buttonInner, fontWeight: "700" },
  disabledButton: { color: AppColors.textMuted },
  fullScreen: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  fullScreenImage: { width: Dimensions.get("window").width, height: Dimensions.get("window").height },
  fullScreenCounter: { position: "absolute", top: 24, right: 16, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  fullScreenCounterText: { color: AppColors.white, fontWeight: "700" },
  closeButton: { position: "absolute", top: 22, left: 16, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  closeButtonText: { color: AppColors.white, fontWeight: "700" },
});
