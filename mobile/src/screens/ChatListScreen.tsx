import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, Chat, User } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";
import { AppColors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "ChatList">;

export const ChatListScreen: React.FC<Props> = ({ navigation }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "profile">("chat");
  const { logout, user } = useAuth();
  const socket = getSocket();

  const loadData = async () => {
    try {
      const [chatData, userData] = await Promise.all([
        apiCall<Chat[]>("/chats"),
        apiCall<User[]>("/users"),
      ]);
      setChats(chatData);

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
    socket.on("new-message", () => {
      loadData();
    });

    return () => {
      socket.off("new-message");
    };
  }, []);

  const openChatWithUser = async (targetUser: User) => {
    try {
      const targetId = targetUser._id || (targetUser as any).id;
      const chat = await apiCall<Chat>(`/chats/with/${targetId}`, { method: "POST" });
      const chatId = chat._id || (chat as any).id;
      navigation.navigate("ChatRoom", { chatId: chatId, participant: targetUser });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Chats ({user?.name})</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

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
            >
              <Image source={{ uri: item.participant?.avatar }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.participant?.name}</Text>
                <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage?.text || "No messages"}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Text style={styles.sectionTitle}>Other Users</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={users}
        keyExtractor={(item, index) => {
          const key = item._id || (item as any).id;
          return key ? `user-${key}-${index}` : `user-idx-${index}`;
        }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.userCircle} onPress={() => openChatWithUser(item)}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <Text style={styles.userName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "chat" && styles.tabButtonActive]}
          onPress={() => setActiveTab("chat")}
        >
          <Text style={[styles.tabText, activeTab === "chat" && styles.activeTabText]}>chat</Text>
        </TouchableOpacity>

        <View style={styles.tabDivider} />

        <TouchableOpacity
          style={[styles.tabButton, activeTab === "profile" && styles.tabButtonActive]}
          onPress={() => setActiveTab("profile")}
        >
          <Text style={[styles.tabText, activeTab === "profile" && styles.activeTabText]}>profile</Text>
        </TouchableOpacity>
      </View>
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
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
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
  listContent: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  name: { fontWeight: "700", color: AppColors.primaryDark, fontSize: 15 },
  lastMsg: { color: AppColors.textMuted, fontSize: 12, marginTop: 4 },
  sectionTitle: { fontWeight: "700", color: AppColors.primaryDark, marginVertical: 12, marginLeft: 8 },
  userCircle: {
    alignItems: "center",
    marginRight: 12,
    padding: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  userName: {
    color: AppColors.primaryDark,
    fontSize: 10,
    marginTop: 4,
    fontWeight: "600",
  },
  bottomTabBar: {
    flexDirection: "row",
    height: 62,
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    borderRadius: 18,
    marginTop: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  tabButtonActive: {
    backgroundColor: AppColors.primaryDark,
  },
  tabDivider: {
    width: 1,
    height: "60%",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  tabText: {
    fontSize: 18,
    color: AppColors.primaryDark,
    fontWeight: "500",
    textTransform: "lowercase",
  },
  activeTabText: {
    color: AppColors.white,
    fontWeight: "700",
  },
});