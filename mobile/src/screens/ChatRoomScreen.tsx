import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, Message } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";
import { AppColors } from "../theme/colors";

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
        getSocket().emit("chat-read", String(chatId));
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
    const handleMessageDeleted = ({ messageId }: { messageId: string | number }) => {
      setMessages((current) => current.filter((item) => String(item._id || (item as any).id) !== String(messageId)));
    };

    socket.on("new-message", handleNewMessage);
    socket.on("message-deleted", handleMessageDeleted);

    return () => {
      socket.emit("leave-chat", String(chatId));
      socket.off("new-message", handleNewMessage);
      socket.off("message-deleted", handleMessageDeleted);
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

  const deleteMessage = (message: Message) => {
    const messageId = message._id || (message as any).id;
    if (!messageId) return;
    Alert.alert("Delete message", "Delete this message for everyone?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setMessages((current) => current.filter((item) => String(item._id || (item as any).id) !== String(messageId)));
        try {
          await apiCall(`/messages/${messageId}`, { method: "DELETE" });
        } catch (error: any) {
          setMessages((current) => current.some((item) => String(item._id || (item as any).id) === String(messageId)) ? current : [...current, message]);
          Alert.alert("Could not delete message", error.message);
        }
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.header}>
          <Image source={{ uri: participant.avatar }} style={styles.headerAvatar} />
          <Text style={styles.headerText}>{participant.name}</Text>
        </View>

        <FlatList
          contentContainerStyle={styles.listContent}
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
              <TouchableOpacity onLongPress={() => isMe && deleteMessage(item)} style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                <Text style={isMe ? styles.myText : styles.otherText}>{item.displayText ?? item.text}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type message..."
            value={text}
            onChangeText={setText}
            placeholderTextColor={AppColors.placeholder}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  wrapper: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "rgba(20,42,68,0.05)",
    borderBottomWidth: 0,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "700",
    color: AppColors.primaryDark,
  },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, marginRight: 10 },
  listContent: {
    paddingVertical: 12,
  },
  bubble: {
    padding: 10,
    borderRadius: 14,
    marginVertical: 4,
    marginHorizontal: 10,
    maxWidth: "75%",
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: AppColors.buttonInner,
  },
  otherBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  myText: {
    color: AppColors.white,
  },
  otherText: {
    color: AppColors.text,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 0,
    backgroundColor: "rgba(20,42,68,0.05)",
  },
  input: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: AppColors.whiteSoft,
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 44,
    color: AppColors.inputText,
  },
  sendBtn: {
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    borderRadius: 20,
    minWidth: 70,
    backgroundColor: AppColors.buttonOuter,
  },
  sendText: {
    color: AppColors.white,
    fontWeight: "700",
  },
});