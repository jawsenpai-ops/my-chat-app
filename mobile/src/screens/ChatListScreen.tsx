import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, Chat, User } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";

type Props = NativeStackScreenProps<RootStackParamList, "ChatList">;

export const ChatListScreen: React.FC<Props> = ({ navigation }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "profile">("chat"); // 👈 Active Tab State
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
        data={users}
        horizontal
        keyExtractor={(item, index) => {
          const key = item._id || (item as any).id;
          return key ? `user-${key}-${index}` : `user-idx-${index}`;
        }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.userCircle} onPress={() => openChatWithUser(item)}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <Text style={{ fontSize: 10 }}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      {/* 👈 ထောက်ပြထားသည့် Bottom Navigation Bar (chat | profile) */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => setActiveTab("chat")}
        >
          <Text style={[styles.tabText, activeTab === "chat" && styles.activeTabText]}>
            chat
          </Text>
        </TouchableOpacity>

        <View style={styles.tabDivider} />

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => setActiveTab("profile")}
        >
          <Text style={[styles.tabText, activeTab === "profile" && styles.activeTabText]}>
            profile
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  headerText: { fontSize: 18, fontWeight: "bold" },
  logout: { color: "red" },
  chatCard: { flexDirection: "row", padding: 12, alignItems: "center", borderBottomWidth: 1, borderColor: "#f0f0f0" },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  name: { fontWeight: "bold" },
  lastMsg: { color: "#666", fontSize: 12 },
  sectionTitle: { fontWeight: "bold", marginVertical: 10 },
  userCircle: { alignItems: "center", marginRight: 15 },

  // Bottom Navigation Bar Styles
  bottomTabBar: {
    flexDirection: "row",
    height: 60,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    marginTop: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabDivider: {
    width: 1,
    height: "60%",
    backgroundColor: "#ccc",
  },
  tabText: {
    fontSize: 22,
    color: "#6b21a8",
    fontWeight: "400",
  },
  activeTabText: {
    fontWeight: "bold",
  },
});