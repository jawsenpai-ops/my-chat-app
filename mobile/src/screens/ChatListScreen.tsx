import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, Chat, ChatRequest, IncomingFriendRequest, User } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";
import { AppColors } from "../theme/colors";
import { BottomTabBar } from "../components/BottomTabBar";
import { AvatarWithStatus } from "../components/AvatarWithStatus";

type Props = NativeStackScreenProps<RootStackParamList, "ChatList">;

export const ChatListScreen: React.FC<Props> = ({ navigation }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [friendRequests, setFriendRequests] = useState<IncomingFriendRequest[]>([]);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const { logout, user } = useAuth();
  const socket = getSocket();

  const loadData = async () => {
    try {
      const [chatData, userData, requestData, incomingFriends] = await Promise.all([
        apiCall<Chat[]>("/chats"),
        apiCall<User[]>("/users"),
        apiCall<ChatRequest[]>("/chat-requests"),
        apiCall<IncomingFriendRequest[]>("/friends/requests/incoming"),
      ]);
      setChats(chatData);
      setRequests(requestData);
      setFriendRequests(incomingFriends);

      const currentUserId = user?._id || (user as any)?.id;
      const filteredUsers = userData.filter((u) => {
        const uId = u._id || (u as any).id;
        return String(uId) !== String(currentUserId);
      });
      setUsers(filteredUsers);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribeFocus = navigation.addListener("focus", loadData);
    const handleOnlineUsers = ({ userIds }: { userIds: string[] }) => {
      setOnlineUserIds(new Set(userIds.map(String)));
    };
    const handleUserOnline = ({ userId }: { userId: string | number }) => {
      setOnlineUserIds((current) => new Set(current).add(String(userId)));
    };
    const handleUserOffline = ({ userId }: { userId: string | number }) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);
        next.delete(String(userId));
        return next;
      });
    };
    const handleNewMessage = (message: { _id: string | number; chat: string | number; text: string; createdAt: string; sender: { _id: string | number } }) => {
      const senderId = message.sender?._id;
      const currentUserId = user?._id || (user as any)?.id;
      setChats((current) => current.map((chat) => {
        if (String(chat._id) !== String(message.chat)) return chat;
        return {
          ...chat,
          lastMessage: { _id: message._id, text: message.text, createdAt: message.createdAt },
          unreadCount: String(senderId) === String(currentUserId) ? chat.unreadCount : (chat.unreadCount || 0) + 1,
        };
      }));
    };
    const handleNotification = () => { loadData(); };
    const handleFriendEvent = () => { loadData(); };
    const handleChatRead = ({ chatId }: { chatId: string | number }) => {
      setChats((current) => current.map((chat) =>
        String(chat._id) === String(chatId) ? { ...chat, unreadCount: 0 } : chat,
      ));
    };
    socket.on("online-users", handleOnlineUsers);
    socket.on("user-online", handleUserOnline);
    socket.on("user-offline", handleUserOffline);
    socket.on("new-message", handleNewMessage);
    socket.on("chat-read", handleChatRead);
    socket.on("notification", handleNotification);
    socket.on("friend-request-received", handleFriendEvent);
    socket.on("friend-request-accepted", handleFriendEvent);
    socket.on("friend-request-declined", handleFriendEvent);
    socket.on("friend-request-cancelled", handleFriendEvent);

    return () => {
      unsubscribeFocus();
      socket.off("online-users", handleOnlineUsers);
      socket.off("user-online", handleUserOnline);
      socket.off("user-offline", handleUserOffline);
      socket.off("new-message", handleNewMessage);
      socket.off("chat-read", handleChatRead);
      socket.off("notification", handleNotification);
      socket.off("friend-request-received", handleFriendEvent);
      socket.off("friend-request-accepted", handleFriendEvent);
      socket.off("friend-request-declined", handleFriendEvent);
      socket.off("friend-request-cancelled", handleFriendEvent);
    };
  }, []);

  const sendFriendRequest = async (targetUser: User) => {
    try {
      const targetId = targetUser._id || (targetUser as any).id;
      await apiCall(`/friends/request/${targetId}`, { method: "POST" });
      Alert.alert("Friend request sent", `You sent ${targetUser.name} a friend request.`);
    } catch (err: any) {
      Alert.alert("Could not send request", err.message);
    }
  };

  const respondToRequest = async (request: ChatRequest, action: "accept" | "reject") => {
    try { await apiCall(`/chat-requests/${request._id}/respond`, { method: "POST", body: JSON.stringify({ action }) }); setRequests((current) => current.filter((item) => item._id !== request._id)); await loadData(); }
    catch (error: any) { Alert.alert("Could not update request", error.message); }
  };
  const respondToFriendRequest = async (request: IncomingFriendRequest, action: "accept" | "decline") => {
    try { await apiCall(`/friends/request/${request.requestId}/${action}`, { method: "POST" }); await loadData(); } catch (error: any) { Alert.alert("Could not update friend request", error.message); }
  };

  const updateChatAction = async (action: "pin" | "mute" | "delete") => {
    if (!selectedChat) return;
    const chatId = selectedChat._id || (selectedChat as any).id;
    try {
      await apiCall(`/chats/${chatId}/action`, { method: "POST", body: JSON.stringify({ action }) });
      if (action === "delete") setChats((current) => current.filter((chat) => String(chat._id) !== String(chatId)));
      else setChats((current) => current.map((chat) => String(chat._id) === String(chatId) ? { ...chat, [action === "pin" ? "pinned" : "muted"]: !(action === "pin" ? chat.pinned : chat.muted) } : chat));
    } catch (error: any) { Alert.alert("Could not update chat", error.message); }
    setSelectedChat(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Chats ({user?.name})</Text>
        <TouchableOpacity onPress={() => setNotificationsVisible(true)} style={styles.bellButton} accessibilityLabel="Notifications">
          <Text style={styles.bell}>🔔</Text>
          {(requests.length + friendRequests.length) > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{requests.length + friendRequests.length > 9 ? "9+" : requests.length + friendRequests.length}</Text></View>}
        </TouchableOpacity>
      </View>

      <View style={styles.storyRowWrap}>
        <Text style={styles.sectionTitle}>Other Users</Text>
        <TextInput
          value={userSearch}
          onChangeText={setUserSearch}
          placeholder="Search by name or Gmail"
          placeholderTextColor={AppColors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.userSearch}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.userListContent}
          data={users.filter((item) => {
            const query = userSearch.trim().toLowerCase();
            return !query || item.name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query);
          })}
          keyExtractor={(item, index) => {
            const key = item._id || (item as any).id;
            return key ? `user-${key}-${index}` : `user-idx-${index}`;
          }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userCircle} onPress={() => sendFriendRequest(item)}>
              <AvatarWithStatus uri={item.avatar} size={42} online={onlineUserIds.has(String(item._id))} />
              <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.addLabel}>Add</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <Text style={styles.chatListTitle}>Chats</Text>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={chats}
        keyExtractor={(item, index) => {
          const key = item._id || (item as any).id;
          return key ? `chat-${key}-${index}` : `chat-idx-${index}`;
        }}
        renderItem={({ item }) => {
          const chatId = item._id || (item as any).id;
          return (
            <TouchableOpacity
              style={styles.chatCard}
              onPress={() => item.participant && navigation.navigate("ChatRoom", { chatId: chatId, participant: item.participant })}
              onLongPress={() => setSelectedChat(item)}
              delayLongPress={500}
            >
              <AvatarWithStatus
                uri={item.participant?.avatar}
                size={42}
                online={onlineUserIds.has(String(item.participant?._id))}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.participant?.name}</Text>
                <Text style={styles.lastMsg} numberOfLines={1}>{item.muted ? "Muted" : item.lastMessage?.text || "No messages"}</Text>
              </View>
              {item.pinned && <Text style={styles.pinMark}>Pinned</Text>}
              {!!item.unreadCount && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <BottomTabBar
        onProfilePress={() => navigation.navigate("Profile")}
        onActionPress={() => navigation.navigate("Freedom")}
      />
      <Modal visible={!!selectedChat} transparent animationType="fade" onRequestClose={() => setSelectedChat(null)}><View style={styles.modalBackdrop}><View style={styles.chatActionMenu}><Text style={styles.chatActionTitle}>{selectedChat?.participant?.name}</Text><TouchableOpacity onPress={() => updateChatAction("pin")} style={styles.chatAction}><Text style={styles.chatActionText}>{selectedChat?.pinned ? "Unpin chat" : "Pin chat"}</Text></TouchableOpacity><TouchableOpacity onPress={() => updateChatAction("mute")} style={styles.chatAction}><Text style={styles.chatActionText}>{selectedChat?.muted ? "Unmute chat" : "Mute chat"}</Text></TouchableOpacity><TouchableOpacity onPress={() => updateChatAction("delete")} style={styles.chatAction}><Text style={styles.deleteChatText}>Delete chat</Text></TouchableOpacity><TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.cancelAction}><Text style={styles.cancelActionText}>Cancel</Text></TouchableOpacity></View></View></Modal>
      <Modal visible={notificationsVisible} transparent animationType="slide" onRequestClose={() => setNotificationsVisible(false)}><View style={styles.modalBackdrop}><View style={styles.notificationModal}><View style={styles.notificationHeader}><Text style={styles.notificationTitle}>Notifications</Text><TouchableOpacity onPress={() => setNotificationsVisible(false)}><Text style={styles.closeNotification}>X</Text></TouchableOpacity></View>{requests.map((request) => <View key={`chat-${String(request._id)}`} style={styles.requestRow}><AvatarWithStatus uri={request.sender.avatar} size={42} online={onlineUserIds.has(String(request.sender._id))} /><View style={styles.requestCopy}><Text style={styles.requestName}>{request.sender.name}</Text><Text style={styles.requestText}>wants to chat with you</Text></View><TouchableOpacity onPress={() => respondToRequest(request, "accept")} style={styles.acceptButton}><Text style={styles.acceptText}>Accept</Text></TouchableOpacity><TouchableOpacity onPress={() => respondToRequest(request, "reject")} style={styles.rejectButton}><Text style={styles.rejectText}>Reject</Text></TouchableOpacity></View>)}{friendRequests.map((request) => <View key={`friend-${String(request.requestId)}`} style={styles.requestRow}><AvatarWithStatus uri={request.avatar} size={42} online={onlineUserIds.has(String(request._id))} /><View style={styles.requestCopy}><Text style={styles.requestName}>{request.name}</Text><Text style={styles.requestText}>sent you a friend request</Text></View><TouchableOpacity onPress={() => respondToFriendRequest(request, "accept")} style={styles.acceptButton}><Text style={styles.acceptText}>Confirm</Text></TouchableOpacity><TouchableOpacity onPress={() => respondToFriendRequest(request, "decline")} style={styles.rejectButton}><Text style={styles.rejectText}>Delete</Text></TouchableOpacity></View>)}{requests.length === 0 && friendRequests.length === 0 && <Text style={styles.emptyNotifications}>No new requests</Text>}</View></View></Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "700",
    color: AppColors.primaryDark,
  },
  logout: {
    color: AppColors.primaryDark,
    fontWeight: "600",
  },
  bellButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  bell: { fontSize: 22 },
  notificationBadge: { position: "absolute", right: 0, top: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#b42318" },
  notificationBadgeText: { color: AppColors.white, fontSize: 10, fontWeight: "700" },
  storyRowWrap: {
    marginTop: 4,
    marginBottom: 6,
  },
  userListContent: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: "rgba(20,42,68,0.06)",
    borderWidth: 0,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  avatarLarge: { width: 42, height: 42, borderRadius: 21 },
  name: { fontWeight: "700", color: AppColors.primaryDark, fontSize: 15 },
  lastMsg: { color: AppColors.textMuted, fontSize: 12, marginTop: 4 },
  sectionTitle: {
    fontWeight: "700",
    color: AppColors.primaryDark,
    marginBottom: 6,
    marginLeft: 8,
    fontSize: 15,
  },
  userSearch: {
    marginHorizontal: 4,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    backgroundColor: AppColors.whiteSoft,
    color: AppColors.inputText,
  },
  chatListTitle: {
    fontWeight: "700",
    color: AppColors.primaryDark,
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 8,
    fontSize: 15,
  },
  userCircle: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    width: 62,
    minHeight: 64,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "transparent",
  },
  userName: {
    color: AppColors.primaryDark,
    fontSize: 9,
    marginTop: 5,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 54,
  },
  addLabel: { color: AppColors.buttonInner, fontSize: 10, fontWeight: "700", marginTop: 2 },
  pinMark: { color: AppColors.buttonInner, fontSize: 10, fontWeight: "700", marginRight: 8 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  notificationModal: { backgroundColor: AppColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: "70%" },
  notificationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  notificationTitle: { color: AppColors.primaryDark, fontSize: 20, fontWeight: "700" },
  closeNotification: { color: AppColors.textMuted, fontSize: 22, fontWeight: "700" },
  emptyNotifications: { color: AppColors.textMuted, textAlign: "center", paddingVertical: 30 },
  requestRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(20,42,68,0.1)" },
  requestCopy: { flex: 1, marginHorizontal: 10 },
  requestName: { color: AppColors.primaryDark, fontWeight: "700" },
  requestText: { color: AppColors.textMuted, fontSize: 12, marginTop: 3 },
  acceptButton: { backgroundColor: AppColors.buttonInner, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  acceptText: { color: AppColors.white, fontSize: 11, fontWeight: "700" },
  rejectButton: { backgroundColor: AppColors.whiteSoft, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, marginLeft: 5 },
  rejectText: { color: "#b42318", fontSize: 11, fontWeight: "700" },
  chatActionMenu: { backgroundColor: AppColors.background, borderRadius: 18, padding: 20, margin: 18 },
  chatActionTitle: { color: AppColors.primaryDark, fontSize: 18, fontWeight: "700", marginBottom: 4 },
  chatAction: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "rgba(20,42,68,0.1)" },
  chatActionText: { color: AppColors.primaryDark, fontSize: 16, fontWeight: "600" },
  deleteChatText: { color: "#b42318", fontSize: 16, fontWeight: "600" },
  cancelAction: { alignItems: "center", paddingTop: 16 },
  cancelActionText: { color: AppColors.textMuted, fontWeight: "700" },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.buttonOuter,
  },
  unreadText: {
    color: AppColors.white,
    fontSize: 11,
    fontWeight: "700",
  },
});