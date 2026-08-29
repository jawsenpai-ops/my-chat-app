import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, Chat, User } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";

type Props = NativeStackScreenProps<RootStackParamList, "ChatList">;

export const ChatListScreen: React.FC<Props> = ({ navigation }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const { logout, user } = useAuth();
  const socket = getSocket();

  const loadData = async () => {
    try {
      const [chatData, userData] = await Promise.all([
        apiCall<Chat[]>("/chats"),
        apiCall<User[]>("/users"),
      ]);
      setChats(chatData);
      setUsers(userData);
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
      const chat = await apiCall<Chat>(`/chats/with/${targetUser._id}`, { method: "POST" });
      navigation.navigate("ChatRoom", { chatId: chat._id, participant: targetUser });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Chats ({user?.name})</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => String(item._id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatCard}
            onPress={() => item.participant && navigation.navigate("ChatRoom", { chatId: item._id, participant: item.participant })}
          >
            <Image source={{ uri: item.participant?.avatar }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.participant?.name}</Text>
              <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage?.text || "No messages"}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.sectionTitle}>Other Users</Text>
      <FlatList
        data={users}
        horizontal
        keyExtractor={(item) => String(item._id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.userCircle} onPress={() => openChatWithUser(item)}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <Text style={{ fontSize: 10 }}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
  headerText: { fontSize: 18, fontWeight: "bold" },
  logout: { color: "red" },
  chatCard: { flexDirection: "row", padding: 12, alignItems: "center", borderBottomWidth: 1, borderColor: "#f0f0f0" },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  name: { fontWeight: "bold" },
  lastMsg: { color: "#666", fontSize: 12 },
  sectionTitle: { fontWeight: "bold", marginVertical: 10 },
  userCircle: { alignItems: "center", marginRight: 15 },
});