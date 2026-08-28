import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, Message } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";

type Props = NativeStackScreenProps<RootStackParamList, "ChatRoom">;

export const ChatRoomScreen: React.FC<Props> = ({ route }) => {
  const { chatId, participant } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const { user } = useAuth();
  const socket = getSocket();

  useEffect(() => {
    const fetchMessages = async () => {
      const data = await apiCall<Message[]>(`/messages/chat/${chatId}`);
      setMessages(data);
    };

    fetchMessages();
    socket.emit("join-chat", String(chatId));

    socket.on("new-message", (msg: Message) => {
      if (String(msg.chat) === String(chatId)) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => {
      socket.emit("leave-chat", String(chatId));
      socket.off("new-message");
    };
  }, [chatId]);

  const sendMessage = () => {
    if (!text.trim()) return;

    socket.emit("send-message", {
      chatId: String(chatId),
      text,
    });

    setText("");
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{participant.name}</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => String(item._id)}
        renderItem={({ item }) => {
          const isMe = String(item.sender._id || item.sender) === String(user?._id);
          return (
            <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
              <Text style={isMe ? styles.myText : styles.otherText}>{item.text}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type message..."
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={{ color: "#fff" }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: { padding: 15, backgroundColor: "#f8f9fa", borderBottomWidth: 1, borderColor: "#ccc" },
  headerText: { fontSize: 16, fontWeight: "bold" },
  bubble: { padding: 10, borderRadius: 10, marginVertical: 4, marginHorizontal: 10, maxWidth: "75%" },
  myBubble: { alignSelf: "flex-end", backgroundColor: "#007bff" },
  otherBubble: { alignSelf: "start", backgroundColor: "#e9ecef" },
  myText: { color: "#fff" },
  otherText: { color: "#000" },
  inputContainer: { flexDirection: "row", padding: 10, borderTopWidth: 1, borderColor: "#ccc", backgroundColor: "#fff" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 20, paddingHorizontal: 15, height: 40 },
  sendBtn: { marginLeft: 10, backgroundColor: "#007bff", justifyContent: "center", paddingHorizontal: 15, borderRadius: 20 },
});