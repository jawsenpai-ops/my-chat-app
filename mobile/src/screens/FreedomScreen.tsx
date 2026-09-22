import React, { useEffect, useRef, useState } from "react";
import { Alert, Dimensions, FlatList, Image, Modal, RefreshControl, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiCall } from "../api/client";
import { getSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import { AppColors } from "../theme/colors";
import { BottomTabBar } from "../components/BottomTabBar";
import { PixelHourglassLoader } from "../components/PixelHourglassLoader";
import { CreatePostComposer, SelectedImage } from "../components/CreatePostComposer";
import { FriendRelationship, Post, PostComment, PostCommentsResponse, RootStackParamList, User } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Freedom">;

const normalizeComments = (response: PostCommentsResponse | PostComment[], offset = 0, limit = 4): PostCommentsResponse => {
  if (!Array.isArray(response)) return { comments: Array.isArray(response?.comments) ? response.comments : [], hasMore: Boolean(response?.hasMore) };
  const roots = response.filter((comment) => !comment.parentCommentId);
  const pageRoots = roots.slice(offset, offset + limit);
  const rootIds = new Set(pageRoots.map((comment) => String(comment._id)));
  const visibleIds = new Set(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    response.forEach((comment) => {
      if (comment.parentCommentId !== null && comment.parentCommentId !== undefined && visibleIds.has(String(comment.parentCommentId)) && !visibleIds.has(String(comment._id))) {
        visibleIds.add(String(comment._id));
        changed = true;
      }
    });
  }
  return { comments: response.filter((comment) => visibleIds.has(String(comment._id))), hasMore: offset + pageRoots.length < roots.length };
};

export const FreedomScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [composerVisible, setComposerVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [fullCommentsPostId, setFullCommentsPostId] = useState<string | null>(null);
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Set<string>>(new Set());
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [fullScreenImages, setFullScreenImages] = useState<string[]>([]);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, FriendRelationship["status"]>>({});
  const [friendActionId, setFriendActionId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const postsRef = useRef<FlatList<Post>>(null);
  const socket = getSocket();

  const loadPosts = async () => {
    try { setPosts(await apiCall<Post[]>("/posts")); } catch (error: any) { Alert.alert("Could not load posts", error.message); }
    finally { setLoading(false); }
  };
  const refresh = async () => { setRefreshing(true); await loadPosts(); setRefreshing(false); };

  useEffect(() => {
    loadPosts();
    Promise.all([apiCall<User[]>("/users"), apiCall<User[]>("/friends")])
      .then(([allUsers, partnerUsers]) => {
        const partnerIds = new Set(partnerUsers.map((partner) => String(partner._id)));
        setUsers(allUsers.filter((candidate) => candidate.isPartner === true || partnerIds.has(String(candidate._id))));
      })
      .catch(() => undefined);
    const online = ({ userIds }: { userIds: string[] }) => setOnlineIds(new Set(userIds.map(String)));
    socket.on("online-users", online);
    return () => { socket.off("online-users", online); };
  }, []);
  useEffect(() => {
    const authorIds = Array.from(new Set(posts.map((post) => String(post.author._id)).filter((id) => id !== String(user?._id))));
    if (!authorIds.length) return;
    Promise.all(authorIds.map(async (authorId) => [authorId, await apiCall<FriendRelationship>(`/friends/status/${authorId}`)] as const))
      .then((statuses) => setFriendStatuses((current) => Object.fromEntries([...Object.entries(current), ...statuses.map(([id, relationship]) => [id, relationship.status])])))
      .catch(() => undefined);
  }, [posts, user?._id]);

  useEffect(() => {
    const refreshFriendStatus = () => {
      setPosts((current) => [...current]);
    };
    socket.on("friend-request-received", refreshFriendStatus);
    socket.on("friend-request-accepted", refreshFriendStatus);
    socket.on("friend-request-declined", refreshFriendStatus);
    socket.on("friend-request-cancelled", refreshFriendStatus);
    return () => { socket.off("friend-request-received", refreshFriendStatus); socket.off("friend-request-accepted", refreshFriendStatus); socket.off("friend-request-declined", refreshFriendStatus); socket.off("friend-request-cancelled", refreshFriendStatus); };
  }, []);

  useEffect(() => {
    posts.forEach((post) => {
      if (!post.imageUrl || imageRatios[String(post._id)]) return;
      Image.getSize(post.imageUrl, (width, height) => {
        if (width > 0 && height > 0) setImageRatios((current) => ({ ...current, [String(post._id)]: width / height }));
      }, () => undefined);
    });
  }, [posts, imageRatios]);

  useEffect(() => {
    if (route.params?.openComposer) openComposer();
  }, [route.params?.openComposer]);

  useEffect(() => {
    const targetId = route.params?.highlightPostId;
    if (!targetId || !posts.length) return;
    const index = posts.findIndex((post) => String(post._id) === String(targetId));
    if (index < 0) return;
    setHighlightedPostId(String(targetId));
    postsRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
  }, [route.params?.highlightPostId, posts]);

  useEffect(() => {
    StatusBar.setHidden(fullScreenImages.length > 0, "fade");
    return () => StatusBar.setHidden(false, "fade");
  }, [fullScreenImages.length]);

  const openComposer = (post?: Post) => {
    setEditingPost(post || null);
    setBody(post?.body || "");
    const urls = post?.imageUrls?.length ? post.imageUrls : post?.imageUrl ? [post.imageUrl] : [];
    setImages(urls.map((uri) => ({ uri, width: 1, height: 1 })));
    setComposerVisible(true);
  };

  const savePost = async () => {
    if (!body.trim() && images.length === 0) return Alert.alert("Add something", "Write a post or choose an image first.");
    try {
      // When editing, only the caption is sent — existing photos stay untouched.
      const payload = editingPost ? { body } : { body, imageUrls: images.map((image) => image.uri) };
      const options = { method: editingPost ? "PATCH" : "POST", body: JSON.stringify(payload) };
      await apiCall(editingPost ? `/posts/${editingPost._id}` : "/posts", options);
      setComposerVisible(false);
      await loadPosts();
    } catch (error: any) { Alert.alert("Could not save post", error.message); }
  };

  const deletePost = (post: Post) => {
    setMenuPost(null);
    Alert.alert("Delete post", "Delete this post?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await apiCall(`/posts/${post._id}`, { method: "DELETE" }); setPosts((current) => current.filter((item) => item._id !== post._id)); }
        catch (error: any) { Alert.alert("Could not delete post", error.message); }
      } },
    ]);
  };

  const toggleLike = async (post: Post) => {
    const optimistic = { ...post, likedByMe: !post.likedByMe, likeCount: post.likeCount + (post.likedByMe ? -1 : 1) };
    setPosts((current) => current.map((item) => item._id === post._id ? optimistic : item));
    try { await apiCall(`/posts/${post._id}/like`, { method: "POST" }); }
    catch (error: any) { setPosts((current) => current.map((item) => item._id === post._id ? post : item)); Alert.alert("Could not update like", error.message); }
  };

  const showComments = async (post: Post) => {
    if (commentsFor === String(post._id)) return setCommentsFor(null);
    try {
      const response = normalizeComments(await apiCall<PostCommentsResponse | PostComment[]>(`/posts/${post._id}/comments?limit=1000&offset=0`), 0, 1000);
      setComments(response.comments); setCommentsHasMore(response.hasMore); setCommentsOffset(response.comments.filter((comment) => !comment.parentCommentId).length); setExpandedReplyThreads(new Set()); setCommentsFor(String(post._id));
    }
    catch (error: any) { Alert.alert("Could not load comments", error.message); }
  };

  const loadMoreComments = async (post: Post) => {
    if (!commentsHasMore || commentsLoading) return;
    setCommentsLoading(true);
    try {
      const response = normalizeComments(await apiCall<PostCommentsResponse | PostComment[]>(`/posts/${post._id}/comments?limit=4&offset=${commentsOffset}`), commentsOffset);
      setComments((current) => [...current, ...response.comments.filter((comment) => !current.some((existing) => existing._id === comment._id))]);
      setCommentsHasMore(response.hasMore);
      setCommentsOffset((current) => current + response.comments.filter((comment) => !comment.parentCommentId).length);
    } catch (error: any) { Alert.alert("Could not load more comments", error.message); }
    finally { setCommentsLoading(false); }
  };

  const openFullComments = async (post: Post) => {
    try {
      const response = normalizeComments(await apiCall<PostCommentsResponse | PostComment[]>(`/posts/${post._id}/comments?limit=1000&offset=0`), 0, 1000);
      setComments(response.comments);
      setCommentsHasMore(response.hasMore);
      setExpandedReplyThreads(new Set());
      setFullCommentsPostId(String(post._id));
    } catch (error: any) { Alert.alert("Could not load all comments", error.message); }
  };

  const addComment = async (post: Post) => {
    if (!commentText.trim()) return;
    try {
      await apiCall(`/posts/${post._id}/comments`, { method: "POST", body: JSON.stringify({ body: commentText, parentCommentId: replyTo?._id || null }) });
      setCommentText(""); setReplyTo(null);
      const response = normalizeComments(await apiCall<PostCommentsResponse | PostComment[]>(`/posts/${post._id}/comments?limit=1000&offset=0`), 0, 1000);
      setComments(response.comments); setCommentsHasMore(response.hasMore);
      setPosts((current) => current.map((item) => item._id === post._id ? { ...item, commentCount: item.commentCount + 1 } : item));
    } catch (error: any) { Alert.alert("Could not add comment", error.message); }
  };

  const deleteComment = (post: Post, comment: PostComment) => {
    Alert.alert("Delete comment", "Delete this comment and its replies?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await apiCall(`/posts/${post._id}/comments/${comment._id}`, { method: "DELETE" });
          const deletedIds = new Set<string>([String(comment._id)]);
          let foundDescendant = true;
          while (foundDescendant) {
            foundDescendant = false;
            comments.forEach((item) => {
              if (item.parentCommentId !== null && item.parentCommentId !== undefined && deletedIds.has(String(item.parentCommentId)) && !deletedIds.has(String(item._id))) {
                deletedIds.add(String(item._id));
                foundDescendant = true;
              }
            });
          }
          setComments((current) => current.filter((item) => !deletedIds.has(String(item._id))));
          setPosts((current) => current.map((item) => item._id === post._id ? { ...item, commentCount: Math.max(0, item.commentCount - deletedIds.size) } : item));
        } catch (error: any) { Alert.alert("Could not delete comment", error.message); }
      } },
    ]);
  };

  const shareToFriend = async (friend: User) => {
    if (!sharePost) return;
    try {
      const chat = await apiCall<{ _id: string | number }>(`/chats/with/${friend._id}`, { method: "POST" });
      socket.emit("send-message", { chatId: String(chat._id), text: `Shared post: https://ikiyadm.com/posts/${sharePost._id}\n${sharePost.body}` });
      setSharePost(null);
      Alert.alert("Sent", `Post sent to ${friend.name}.`);
    } catch (error: any) { Alert.alert("Could not send post", error.message); }
  };

  const sendPostFriendRequest = async (authorId: number | string) => {
    const id = String(authorId);
    setFriendActionId(id);
    // Optimistic: show "Pending" immediately, revert if the request fails.
    setFriendStatuses((current) => ({ ...current, [id]: "pending_sent" }));
    try { await apiCall(`/friends/request/${authorId}`, { method: "POST" }); }
    catch (error: any) { setFriendStatuses((current) => ({ ...current, [id]: "none" })); Alert.alert("Could not send friend request", error.message); }
    finally { setFriendActionId(null); }
  };

  const openFullScreen = (photos: string[], index: number) => {
    setFullScreenImages(photos);
    setFullScreenIndex(index);
  };

  const renderPost = ({ item }: { item: Post }) => {
    const online = onlineIds.has(String(item.author._id)) || String(item.author._id) === String(user?._id);
    const authorId = String(item.author._id);
    const friendStatus = friendStatuses[authorId];
    const childComments = (parentId: number | string) => comments.filter((comment) => String(comment.parentCommentId) === String(parentId));
    const renderComment = (comment: PostComment, depth = 0): React.ReactElement => {
      const canDelete = String(comment.author._id) === String(user?._id) || String(item.author._id) === String(user?._id);
      const children = childComments(comment._id);
      const showAllReplies = expandedReplyThreads.has(String(comment._id));
      const visibleChildren = showAllReplies ? children : children.slice(0, 1);
      return <View key={String(comment._id)} style={[styles.commentThread, depth > 0 && styles.replyThread]}>
        <View style={styles.comment}>
          <Image source={{ uri: comment.author.avatar }} style={styles.commentAvatar} />
          <View style={styles.commentText}>
            <Text><Text style={styles.commentName}>{comment.author.name}: </Text>{comment.parentCommentId ? <Text style={styles.replyMention}>@{comments.find((parent) => String(parent._id) === String(comment.parentCommentId))?.author.name || "user"} </Text> : null}{comment.body}</Text>
            <View style={styles.commentActions}><TouchableOpacity onPress={() => setReplyTo(comment)}><Text style={styles.replyLink}>Reply</Text></TouchableOpacity>{canDelete && <TouchableOpacity onPress={() => deleteComment(item, comment)} onLongPress={() => deleteComment(item, comment)}><Text style={styles.deleteCommentLink}>...</Text></TouchableOpacity>}</View>
          </View>
        </View>
        {visibleChildren.map((child) => renderComment(child, depth + 1))}
        {children.length > visibleChildren.length && <TouchableOpacity onPress={() => setExpandedReplyThreads((current) => { const next = new Set(current); next.add(String(comment._id)); return next; })}><Text style={styles.moreReplies}>and more</Text></TouchableOpacity>}
      </View>;
    };
    const topLevelComments = comments.filter((comment) => !comment.parentCommentId);
    const previewComments = topLevelComments.slice(0, 10);
    return <View style={[styles.postCard, highlightedPostId === String(item._id) && styles.highlightedPost]}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.authorWrap} onPress={() => navigation.navigate("Profile", { userId: item.author._id, online })} activeOpacity={0.75}><View><Image source={{ uri: item.author.avatar }} style={styles.avatar} />{online && <View style={styles.onlineDot} />}</View><View style={styles.authorCopy}><View style={styles.authorNameRow}><Text style={styles.authorName}>{item.author.name}</Text>{authorId !== String(user?._id) && (friendStatus === "friends" ? <Text style={styles.partnerLabel}>Partner</Text> : friendStatus === "pending_sent" ? <Text style={styles.pendingLabel}>Pending</Text> : <TouchableOpacity disabled={friendActionId === authorId} onPress={() => sendPostFriendRequest(item.author._id)}><Text style={styles.addFriendLabel}>{friendActionId === authorId ? "..." : "Add Friend"}</Text></TouchableOpacity>)}</View><Text style={styles.meta}>{online ? "Online" : "Offline"} · {new Date(item.createdAt).toLocaleString()}</Text></View></TouchableOpacity>
        <TouchableOpacity onPress={() => setMenuPost(item)}><Text style={styles.more}>...</Text></TouchableOpacity>
      </View>
      {!!item.body && <Text style={styles.postBody}>{item.body}</Text>}
      {(item.imageUrls?.length || item.imageUrl) ? (() => {
        const photos = item.imageUrls?.length ? item.imageUrls : [item.imageUrl as string];
        const postKey = String(item._id);
        return <View style={{ position: "relative" }}><FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={photos} keyExtractor={(_, index) => `${item._id}-${index}`} onMomentumScrollEnd={(event) => { const pageWidth = Dimensions.get("window").width - 56; const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth); setCarouselIndexes((current) => ({ ...current, [postKey]: index })); }} renderItem={({ item: uri, index }) => <TouchableOpacity onPress={() => openFullScreen(photos, index)} activeOpacity={0.9}><Image source={{ uri }} style={styles.feedPhoto} resizeMode="cover" /></TouchableOpacity>} />{photos.length > 1 && <View style={styles.carouselIndicator}><Text style={styles.carouselIndicatorText}>{(carouselIndexes[postKey] || 0) + 1}/{photos.length}</Text></View>}</View>;
      })() : null}
      <View style={styles.actionRow}><TouchableOpacity onPress={() => toggleLike(item)}><Text style={[styles.actionText, item.likedByMe && styles.liked]}>{item.likedByMe ? "Unlike" : "Like"} · {item.likeCount}</Text></TouchableOpacity><TouchableOpacity onPress={() => showComments(item)}><Text style={styles.actionText}>Comment · {item.commentCount}</Text></TouchableOpacity></View>
      {commentsFor === String(item._id) && <View style={styles.comments}>{previewComments.map((comment) => renderComment(comment))}{(topLevelComments.length > 10 || commentsHasMore) && <TouchableOpacity onPress={() => openFullComments(item)} disabled={commentsLoading}><Text style={styles.seeMore}>{commentsLoading ? "Loading..." : "See More Comments"}</Text></TouchableOpacity>}<View style={styles.commentComposer}>{replyTo && <Text style={styles.replyingTo}>Replying to @{replyTo.author.name}</Text>}<TextInput value={commentText} onChangeText={setCommentText} placeholder={replyTo ? `Reply to @${replyTo.author.name}` : "Write a comment..."} placeholderTextColor={AppColors.placeholder} style={styles.commentInput} /><TouchableOpacity onPress={() => addComment(item)}><Text style={styles.postLink}>Post</Text></TouchableOpacity></View></View>}
      <Modal visible={fullCommentsPostId === String(item._id)} animationType="slide" transparent onRequestClose={() => setFullCommentsPostId(null)}><View style={styles.modalBackdrop}><View style={styles.fullCommentsPanel}><View style={styles.fullCommentsHeader}><Text style={styles.modalTitle}>Comments</Text><TouchableOpacity onPress={() => setFullCommentsPostId(null)}><Text style={styles.closeComments}>X</Text></TouchableOpacity></View><FlatList data={topLevelComments} keyExtractor={(comment) => `full-comment-${String(comment._id)}`} renderItem={({ item: comment }) => renderComment(comment)} ListEmptyComponent={<Text style={styles.empty}>No comments yet.</Text>} /><View style={styles.commentComposer}>{replyTo && <Text style={styles.replyingTo}>Replying to @{replyTo.author.name}</Text>}<TextInput value={commentText} onChangeText={setCommentText} placeholder={replyTo ? `Reply to @${replyTo.author.name}` : "Write a comment..."} placeholderTextColor={AppColors.placeholder} style={styles.commentInput} /><TouchableOpacity onPress={() => addComment(item)}><Text style={styles.postLink}>Post</Text></TouchableOpacity></View></View></View></Modal>
    </View>;
  };

  return <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
    {loading ? <PixelHourglassLoader /> : <FlatList ref={postsRef} data={posts} renderItem={renderPost} keyExtractor={(item) => String(item._id)} contentContainerStyle={styles.feed} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} onScrollToIndexFailed={() => undefined} ListEmptyComponent={<Text style={styles.empty}>No posts yet. Start the conversation.</Text>} />}
    <BottomTabBar
      showCreate
      onCreatePress={() => openComposer()}
      onProfilePress={() => navigation.navigate("Profile")}
      onActionPress={() => undefined}
      actionIcon="search"
    />
    <Modal visible={composerVisible} animationType="slide" transparent onRequestClose={() => setComposerVisible(false)}><View style={styles.modalBackdrop}><CreatePostComposer body={body} images={images} onBodyChange={setBody} onImagesChange={setImages} onSubmit={savePost} onCancel={() => setComposerVisible(false)} submitLabel={editingPost ? "Save Changes" : "Post"} authorName={user?.name} authorAvatar={user?.avatar} lockImages={!!editingPost} /></View></Modal>
    <Modal visible={!!menuPost} animationType="slide" transparent onRequestClose={() => setMenuPost(null)}><View style={styles.modalBackdrop}><View style={styles.menu}><TouchableOpacity onPress={() => { setMenuPost(null); Share.share({ message: `https://ikiyadm.com/posts/${menuPost?._id}` }); }}><Text style={styles.menuItem}>Copy link</Text></TouchableOpacity><TouchableOpacity onPress={() => { setSharePost(menuPost); setMenuPost(null); }}><Text style={styles.menuItem}>Send to my friend</Text></TouchableOpacity>{menuPost?.isOwner && <><TouchableOpacity onPress={() => { const post = menuPost; setMenuPost(null); openComposer(post); }}><Text style={styles.menuItem}>Edit post</Text></TouchableOpacity><TouchableOpacity onPress={() => deletePost(menuPost)}><Text style={[styles.menuItem, styles.danger]}>Delete post</Text></TouchableOpacity></>}</View></View></Modal>
    <Modal visible={!!sharePost} animationType="slide" transparent onRequestClose={() => setSharePost(null)}><View style={styles.modalBackdrop}><View style={styles.menu}><Text style={styles.modalTitle}>Send to my friend</Text>{users.filter((friend) => friend.isPartner === true).map((friend) => <TouchableOpacity key={String(friend._id)} onPress={() => shareToFriend(friend)} style={styles.friend}><Image source={{ uri: friend.avatar }} style={styles.commentAvatar} /><Text style={styles.menuItem}>{friend.name}</Text></TouchableOpacity>)}<TouchableOpacity onPress={() => setSharePost(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View></View></Modal>
    <Modal visible={fullScreenImages.length > 0} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onShow={() => StatusBar.setHidden(true, "none")} onDismiss={() => StatusBar.setHidden(false, "none")} onRequestClose={() => setFullScreenImages([])}><View style={styles.fullScreen}><FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={fullScreenImages} initialScrollIndex={fullScreenIndex} getItemLayout={(_, index) => ({ length: Dimensions.get("window").width, offset: Dimensions.get("window").width * index, index })} onMomentumScrollEnd={(event) => setFullScreenIndex(Math.round(event.nativeEvent.contentOffset.x / Dimensions.get("window").width))} keyExtractor={(_, index) => `full-photo-${index}`} renderItem={({ item: uri }) => <Image source={{ uri }} style={styles.fullScreenImage} resizeMode="contain" />} /><View style={styles.fullScreenCounter}><Text style={styles.fullScreenCounterText}>{fullScreenIndex + 1}/{fullScreenImages.length}</Text></View></View></Modal>
  </SafeAreaView>;
};

const styles = StyleSheet.create({
  authorCopy: { flex: 1, minWidth: 0 }, authorNameRow: { flexDirection: "row", alignItems: "center", gap: 8 }, addFriendLabel: { color: AppColors.buttonInner, fontSize: 11, fontWeight: "700" }, pendingLabel: { color: AppColors.textMuted, fontSize: 11, fontWeight: "700" }, partnerLabel: { color: AppColors.success, fontSize: 11, fontWeight: "700" },
  container: { flex: 1, backgroundColor: AppColors.background }, feedPhoto: { width: Dimensions.get("window").width - 56, aspectRatio: 4 / 5, borderRadius: 12, marginTop: 12, backgroundColor: AppColors.whiteSoft }, carouselIndicator: { position: "absolute", right: 10, top: 20, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }, carouselIndicatorText: { color: AppColors.white, fontSize: 12, fontWeight: "700" }, reply: { marginLeft: 36 }, replyLink: { color: AppColors.buttonInner, fontSize: 11, fontWeight: "700", marginTop: 3 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 10, backgroundColor: AppColors.primaryDark },
  back: { color: AppColors.white, fontSize: 38, lineHeight: 38 }, title: { color: AppColors.white, fontSize: 20, fontWeight: "700" }, headerPlus: { color: AppColors.white, fontSize: 28 },
  feed: { padding: 12, paddingBottom: 30 }, postCard: { backgroundColor: AppColors.surface, borderRadius: 16, marginBottom: 12, padding: 14 }, highlightedPost: { borderWidth: 2, borderColor: AppColors.buttonInner }, postHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, authorWrap: { flexDirection: "row", alignItems: "center", flex: 1 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: AppColors.whiteSoft, marginRight: 10 }, onlineDot: { position: "absolute", right: 6, bottom: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: AppColors.success, borderWidth: 2, borderColor: AppColors.surface }, authorName: { color: AppColors.primaryDark, fontWeight: "700" }, meta: { color: AppColors.textMuted, fontSize: 11, marginTop: 3 }, more: { color: AppColors.primaryDark, fontSize: 22, fontWeight: "700", paddingHorizontal: 8 }, postBody: { color: AppColors.text, fontSize: 15, lineHeight: 22, marginTop: 14 }, postImage: { width: "100%", borderRadius: 12, marginTop: 12, backgroundColor: AppColors.whiteSoft }, actionRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(20,42,68,0.08)", marginTop: 14, paddingTop: 12, gap: 22 }, actionText: { color: AppColors.primaryDark, fontWeight: "600", fontSize: 13 }, liked: { color: AppColors.buttonInner }, comments: { marginTop: 12 }, commentThread: { width: "100%" }, replyThread: { marginLeft: 24, width: "auto" }, comment: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 }, commentAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 }, commentText: { flex: 1, color: AppColors.text, fontSize: 13 }, commentName: { fontWeight: "700" }, replyMention: { color: AppColors.buttonInner, fontWeight: "600" }, commentActions: { flexDirection: "row", alignItems: "center", gap: 12 }, deleteCommentLink: { color: AppColors.textMuted, fontWeight: "700", paddingHorizontal: 8 }, moreReplies: { color: AppColors.textMuted, fontSize: 12, fontWeight: "700", paddingVertical: 4 }, seeMore: { color: AppColors.buttonInner, fontWeight: "700", paddingVertical: 10 }, replyingTo: { color: AppColors.textMuted, fontSize: 12, marginBottom: 4 }, commentComposer: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 6 }, commentInput: { flex: 1, height: 38, backgroundColor: AppColors.white, borderRadius: 18, paddingHorizontal: 12, color: AppColors.inputText }, postLink: { color: AppColors.buttonInner, fontWeight: "700", marginLeft: 10 }, empty: { color: AppColors.textMuted, textAlign: "center", marginTop: 50 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }, composer: { backgroundColor: AppColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, minHeight: 390 }, fullCommentsPanel: { backgroundColor: AppColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, height: "82%" }, fullCommentsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, closeComments: { color: AppColors.primaryDark, fontSize: 18, fontWeight: "700", padding: 8 }, modalTitle: { color: AppColors.primaryDark, fontSize: 20, fontWeight: "700", marginBottom: 18 }, postInput: { backgroundColor: AppColors.white, color: AppColors.inputText, borderRadius: 14, minHeight: 110, padding: 14, textAlignVertical: "top", marginTop: 18 }, preview: { width: "100%", height: 130, borderRadius: 12, marginTop: 10 }, modalActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }, secondaryButton: { backgroundColor: AppColors.whiteSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, secondaryText: { color: AppColors.primaryDark, fontWeight: "700" }, primaryButton: { backgroundColor: AppColors.buttonInner, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 }, primaryText: { color: AppColors.white, fontWeight: "700" }, cancelText: { color: AppColors.textMuted, fontWeight: "700", padding: 10 }, menu: { backgroundColor: AppColors.background, borderRadius: 18, padding: 18, margin: 18 }, menuItem: { color: AppColors.primaryDark, fontSize: 15, fontWeight: "600", paddingVertical: 12 }, danger: { color: "#b42318" }, friend: { flexDirection: "row", alignItems: "center" }, fullScreen: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }, fullScreenImage: { width: Dimensions.get("window").width, height: Dimensions.get("window").height }, fullScreenCounter: { position: "absolute", top: 24, right: 16, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }, fullScreenCounterText: { color: AppColors.white, fontSize: 13, fontWeight: "700" },
});