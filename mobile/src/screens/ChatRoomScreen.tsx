import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

  useEffect(() => {
    const socket = getSocket();

    const fetchMessages = async () => {
      try {
        const data = await apiCall<Message[]>(`/messages/chat/${chatId}`);
        setMessages(data);
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      }
    };

    fetchMessages();
    socket.emit("join-chat", String(chatId));

    const handleNewMessage = (msg: Message) => {
      if (String(msg.chat) === String(chatId)) {
        setMessages((prev) => {
          const msgDisplay = msg.displayText ?? msg.text;

          const isDuplicate = prev.some((m) => {
            const mId = m._id || (m as any).id;
            const msgId = msg._id || (msg as any).id;
            const mDisplay = m.displayText ?? m.text;
            const msgDisplayText = msg.displayText ?? msg.text;

            if (mId && msgId) return String(mId) === String(msgId);
            return mDisplay === msgDisplayText && String(m.sender) === String(msg.sender);
          });

          if (isDuplicate) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on("new-message", handleNewMessage);

    return () => {
      socket.emit("leave-chat", String(chatId));
      socket.off("new-message", handleNewMessage);
    };
  }, [chatId]);

  const sendMessage = () => {
    if (!text.trim()) return;

    const socket = getSocket();
    socket.emit("send-message", {
      chatId: String(chatId),
      text: text.trim(),
    });

    setText("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>{participant.name}</Text>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item, index) => {
            const id = item._id || (item as any).id;
            return id ? `msg-${id}` : `msg-fallback-${index}-${item.text.slice(0, 5)}`;
          }}
          renderItem={({ item }) => {
            const senderId = typeof item.sender === "object" ? (item.sender?._id || (item.sender as any)?.id) : item.sender;
            const currentUserId = user?._id || (user as any)?.id;
            const isMe = String(senderId) === String(currentUserId);

            return (
              <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                <Text style={isMe ? styles.myText : styles.otherText}>{item.displayText ?? item.text}</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { padding: 15, backgroundColor: "#f8f9fa", borderBottomWidth: 1, borderColor: "#ccc" },
  headerText: { fontSize: 16, fontWeight: "bold" },
  bubble: { padding: 10, borderRadius: 10, marginVertical: 4, marginHorizontal: 10, maxWidth: "75%" },
  myBubble: { alignSelf: "flex-end", backgroundColor: "#007bff" },
  otherBubble: { alignSelf: "flex-start", backgroundColor: "#e9ecef" },
  myText: { color: "#fff" },
  otherText: { color: "#000" },
  inputContainer: { flexDirection: "row", padding: 10, borderTopWidth: 1, borderColor: "#ccc", backgroundColor: "#fff" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 20, paddingHorizontal: 15, height: 40 },
  sendBtn: { marginLeft: 10, backgroundColor: "#007bff", justifyContent: "center", paddingHorizontal: 15, borderRadius: 20 },
});