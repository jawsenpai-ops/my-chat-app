import React, { useEffect, useState } from "react";
import { Alert, Dimensions, FlatList, Image, Modal, RefreshControl, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiCall } from "../api/client";
import { getSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import { AppColors } from "../theme/colors";
import { BottomTabBar } from "../components/BottomTabBar";
import { CreatePostComposer, SelectedImage } from "../components/CreatePostComposer";
import { Post, PostComment, RootStackParamList, User } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Freedom">;

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
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [fullScreenImages, setFullScreenImages] = useState<string[]>([]);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const socket = getSocket();

  const loadPosts = async () => {
    try { setPosts(await apiCall<Post[]>("/posts")); } catch (error: any) { Alert.alert("Could not load posts", error.message); }
  };
  const refresh = async () => { setRefreshing(true); await loadPosts(); setRefreshing(false); };

  useEffect(() => {
    loadPosts();
    apiCall<User[]>("/users").then(setUsers).catch(() => undefined);
    const online = ({ userIds }: { userIds: string[] }) => setOnlineIds(new Set(userIds.map(String)));
    socket.on("online-users", online);
    return () => { socket.off("online-users", online); };
  }, []);
  useEffect(() => { const handleNotification = (notification: { message: string }) => Alert.alert("New activity", notification.message); socket.on("notification", handleNotification); return () => { socket.off("notification", handleNotification); }; }, []);

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
      const options = { method: editingPost ? "PATCH" : "POST", body: JSON.stringify({ body, imageUrls: images.map((image) => image.uri) }) };
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
    try { setComments(await apiCall<PostComment[]>(`/posts/${post._id}/comments`)); setCommentsFor(String(post._id)); }
    catch (error: any) { Alert.alert("Could not load comments", error.message); }
  };

  const addComment = async (post: Post) => {
    if (!commentText.trim()) return;
    try {
      await apiCall(`/posts/${post._id}/comments`, { method: "POST", body: JSON.stringify({ body: commentText, parentCommentId: replyTo }) });
      setCommentText(""); setReplyTo(null);
      setComments(await apiCall<PostComment[]>(`/posts/${post._id}/comments`));
      setPosts((current) => current.map((item) => item._id === post._id ? { ...item, commentCount: item.commentCount + 1 } : item));
    } catch (error: any) { Alert.alert("Could not add comment", error.message); }
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

  const openFullScreen = (photos: string[], index: number) => {
    setFullScreenImages(photos);
    setFullScreenIndex(index);
  };

  const renderPost = ({ item }: { item: Post }) => {
    const online = onlineIds.has(String(item.author._id)) || String(item.author._id) === String(user?._id);
    return <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.authorWrap} onPress={() => navigation.navigate("Profile", { userId: item.author._id, online })} activeOpacity={0.75}><View><Image source={{ uri: item.author.avatar }} style={styles.avatar} />{online && <View style={styles.onlineDot} />}</View><View><Text style={styles.authorName}>{item.author.name}</Text><Text style={styles.meta}>{online ? "Online" : "Offline"} · {new Date(item.createdAt).toLocaleString()}</Text></View></TouchableOpacity>
        <TouchableOpacity onPress={() => setMenuPost(item)}><Text style={styles.more}>...</Text></TouchableOpacity>
      </View>
      {!!item.body && <Text style={styles.postBody}>{item.body}</Text>}
      {(item.imageUrls?.length || item.imageUrl) ? (() => {
        const photos = item.imageUrls?.length ? item.imageUrls : [item.imageUrl as string];
        const postKey = String(item._id);
        return <View style={{ position: "relative" }}><FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={photos} keyExtractor={(_, index) => `${item._id}-${index}`} onMomentumScrollEnd={(event) => { const pageWidth = Dimensions.get("window").width - 56; const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth); setCarouselIndexes((current) => ({ ...current, [postKey]: index })); }} renderItem={({ item: uri, index }) => <TouchableOpacity onPress={() => openFullScreen(photos, index)} activeOpacity={0.9}><Image source={{ uri }} style={styles.feedPhoto} resizeMode="cover" /></TouchableOpacity>} />{photos.length > 1 && <View style={styles.carouselIndicator}><Text style={styles.carouselIndicatorText}>{(carouselIndexes[postKey] || 0) + 1}/{photos.length}</Text></View>}</View>;
      })() : null}
      <View style={styles.actionRow}><TouchableOpacity onPress={() => toggleLike(item)}><Text style={[styles.actionText, item.likedByMe && styles.liked]}>{item.likedByMe ? "Unlike" : "Like"} · {item.likeCount}</Text></TouchableOpacity><TouchableOpacity onPress={() => showComments(item)}><Text style={styles.actionText}>Comment · {item.commentCount}</Text></TouchableOpacity></View>
      {commentsFor === String(item._id) && <View style={styles.comments}>{comments.slice(0, 4).map((comment) => <View key={String(comment._id)} style={[styles.comment, Boolean(comment.parentCommentId) && styles.reply]}><Image source={{ uri: comment.author.avatar }} style={styles.commentAvatar} /><View style={styles.commentText}><Text><Text style={styles.commentName}>{comment.author.name}: </Text>{comment.body}</Text><TouchableOpacity onPress={() => setReplyTo(String(comment._id))}><Text style={styles.replyLink}>Reply</Text></TouchableOpacity></View></View>)}<View style={styles.commentComposer}><TextInput value={commentText} onChangeText={setCommentText} placeholder={replyTo ? "Reply to comment..." : "Write a comment..."} placeholderTextColor={AppColors.placeholder} style={styles.commentInput} /><TouchableOpacity onPress={() => addComment(item)}><Text style={styles.postLink}>Post</Text></TouchableOpacity></View></View>}
    </View>;
  };

  return <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
    <FlatList data={posts} renderItem={renderPost} keyExtractor={(item) => String(item._id)} contentContainerStyle={styles.feed} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} ListEmptyComponent={<Text style={styles.empty}>No posts yet. Start the conversation.</Text>} />
    <BottomTabBar
      showCreate
      onCreatePress={() => openComposer()}
      onProfilePress={() => navigation.navigate("Profile")}
      onActionPress={() => undefined}
    />
    <Modal visible={composerVisible} animationType="slide" transparent onRequestClose={() => setComposerVisible(false)}><View style={styles.modalBackdrop}><CreatePostComposer body={body} images={images} onBodyChange={setBody} onImagesChange={setImages} onSubmit={savePost} onCancel={() => setComposerVisible(false)} submitLabel={editingPost ? "Save Changes" : "Post"} authorName={user?.name} authorAvatar={user?.avatar} /></View></Modal>
    <Modal visible={!!menuPost} animationType="fade" transparent onRequestClose={() => setMenuPost(null)}><View style={styles.modalBackdrop}><View style={styles.menu}><TouchableOpacity onPress={() => { setMenuPost(null); Share.share({ message: `https://ikiyadm.com/posts/${menuPost?._id}` }); }}><Text style={styles.menuItem}>Copy link</Text></TouchableOpacity><TouchableOpacity onPress={() => { setSharePost(menuPost); setMenuPost(null); }}><Text style={styles.menuItem}>Send to my friend</Text></TouchableOpacity>{menuPost?.isOwner && <><TouchableOpacity onPress={() => { const post = menuPost; setMenuPost(null); openComposer(post); }}><Text style={styles.menuItem}>Edit post</Text></TouchableOpacity><TouchableOpacity onPress={() => deletePost(menuPost)}><Text style={[styles.menuItem, styles.danger]}>Delete post</Text></TouchableOpacity></>}</View></View></Modal>
    <Modal visible={!!sharePost} animationType="slide" transparent onRequestClose={() => setSharePost(null)}><View style={styles.modalBackdrop}><View style={styles.menu}><Text style={styles.modalTitle}>Send to my friend</Text>{users.map((friend) => <TouchableOpacity key={String(friend._id)} onPress={() => shareToFriend(friend)} style={styles.friend}><Image source={{ uri: friend.avatar }} style={styles.commentAvatar} /><Text style={styles.menuItem}>{friend.name}</Text></TouchableOpacity>)}<TouchableOpacity onPress={() => setSharePost(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View></View></Modal>
    <Modal visible={fullScreenImages.length > 0} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onShow={() => StatusBar.setHidden(true, "none")} onDismiss={() => StatusBar.setHidden(false, "none")} onRequestClose={() => setFullScreenImages([])}><View style={styles.fullScreen}><FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={fullScreenImages} initialScrollIndex={fullScreenIndex} getItemLayout={(_, index) => ({ length: Dimensions.get("window").width, offset: Dimensions.get("window").width * index, index })} onMomentumScrollEnd={(event) => setFullScreenIndex(Math.round(event.nativeEvent.contentOffset.x / Dimensions.get("window").width))} keyExtractor={(_, index) => `full-photo-${index}`} renderItem={({ item: uri }) => <Image source={{ uri }} style={styles.fullScreenImage} resizeMode="contain" />} /><View style={styles.fullScreenCounter}><Text style={styles.fullScreenCounterText}>{fullScreenIndex + 1}/{fullScreenImages.length}</Text></View></View></Modal>
  </SafeAreaView>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background }, feedPhoto: { width: Dimensions.get("window").width - 56, aspectRatio: 4 / 5, borderRadius: 12, marginTop: 12, backgroundColor: AppColors.whiteSoft }, carouselIndicator: { position: "absolute", right: 10, top: 20, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }, carouselIndicatorText: { color: AppColors.white, fontSize: 12, fontWeight: "700" }, reply: { marginLeft: 36 }, replyLink: { color: AppColors.buttonInner, fontSize: 11, fontWeight: "700", marginTop: 3 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 10, backgroundColor: AppColors.primaryDark },
  back: { color: AppColors.white, fontSize: 38, lineHeight: 38 }, title: { color: AppColors.white, fontSize: 20, fontWeight: "700" }, headerPlus: { color: AppColors.white, fontSize: 28 },
  feed: { padding: 12, paddingBottom: 30 }, postCard: { backgroundColor: AppColors.surface, borderRadius: 16, marginBottom: 12, padding: 14 }, postHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, authorWrap: { flexDirection: "row", alignItems: "center", flex: 1 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: AppColors.whiteSoft, marginRight: 10 }, onlineDot: { position: "absolute", right: 6, bottom: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: AppColors.success, borderWidth: 2, borderColor: AppColors.surface }, authorName: { color: AppColors.primaryDark, fontWeight: "700" }, meta: { color: AppColors.textMuted, fontSize: 11, marginTop: 3 }, more: { color: AppColors.primaryDark, fontSize: 22, fontWeight: "700", paddingHorizontal: 8 }, postBody: { color: AppColors.text, fontSize: 15, lineHeight: 22, marginTop: 14 }, postImage: { width: "100%", borderRadius: 12, marginTop: 12, backgroundColor: AppColors.whiteSoft }, actionRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(20,42,68,0.08)", marginTop: 14, paddingTop: 12, gap: 22 }, actionText: { color: AppColors.primaryDark, fontWeight: "600", fontSize: 13 }, liked: { color: AppColors.buttonInner }, comments: { marginTop: 12 }, comment: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, commentAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 }, commentText: { flex: 1, color: AppColors.text, fontSize: 13 }, commentName: { fontWeight: "700" }, commentComposer: { flexDirection: "row", alignItems: "center", marginTop: 6 }, commentInput: { flex: 1, height: 38, backgroundColor: AppColors.white, borderRadius: 18, paddingHorizontal: 12, color: AppColors.inputText }, postLink: { color: AppColors.buttonInner, fontWeight: "700", marginLeft: 10 }, empty: { color: AppColors.textMuted, textAlign: "center", marginTop: 50 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }, composer: { backgroundColor: AppColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, minHeight: 390 }, modalTitle: { color: AppColors.primaryDark, fontSize: 20, fontWeight: "700", marginBottom: 18 }, postInput: { backgroundColor: AppColors.white, color: AppColors.inputText, borderRadius: 14, minHeight: 110, padding: 14, textAlignVertical: "top", marginTop: 18 }, preview: { width: "100%", height: 130, borderRadius: 12, marginTop: 10 }, modalActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }, secondaryButton: { backgroundColor: AppColors.whiteSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, secondaryText: { color: AppColors.primaryDark, fontWeight: "700" }, primaryButton: { backgroundColor: AppColors.buttonInner, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 }, primaryText: { color: AppColors.white, fontWeight: "700" }, cancelText: { color: AppColors.textMuted, fontWeight: "700", padding: 10 }, menu: { backgroundColor: AppColors.background, borderRadius: 18, padding: 18, margin: 18 }, menuItem: { color: AppColors.primaryDark, fontSize: 15, fontWeight: "600", paddingVertical: 12 }, danger: { color: "#b42318" }, friend: { flexDirection: "row", alignItems: "center" }, fullScreen: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }, fullScreenImage: { width: Dimensions.get("window").width, height: Dimensions.get("window").height }, fullScreenCounter: { position: "absolute", top: 24, right: 16, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }, fullScreenCounterText: { color: AppColors.white, fontSize: 13, fontWeight: "700" },
});
