import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, Alert, Modal } from "react-native";
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
  const [activePinnedId, setActivePinnedId] = useState<string | null>(null);
  const [pinnedListVisible, setPinnedListVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
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
      replyToId: replyTo?._id || null,
    });

    setText("");
    setReplyTo(null);
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

  const togglePin = async (message: Message) => {
    const messageId = message._id || (message as any).id;
    try {
      const result = await apiCall<{ pinned: boolean }>(`/messages/${messageId}/pin`, { method: "POST" });
      setMessages((current) => current.map((item) => item === message ? { ...item, pinned: result.pinned } : item));
      if (result.pinned) setActivePinnedId(String(messageId));
      else setActivePinnedId(null);
    } catch (error: any) { Alert.alert("Could not update pin", error.message); }
  };

  const pinnedMessages = messages.filter((message) => message.pinned);
  const activePinnedMessage = pinnedMessages.find((message) => String(message._id) === activePinnedId) || pinnedMessages[pinnedMessages.length - 1];
  const activePinnedIndex = activePinnedMessage ? pinnedMessages.findIndex((message) => String(message._id) === String(activePinnedMessage._id)) : -1;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.header}>
          <Image source={{ uri: participant.avatar }} style={styles.headerAvatar} />
          <View><Text style={styles.headerText}>{participant.name}</Text><Text style={styles.partnerLabel}>Partner</Text></View>
        </View>

        {activePinnedMessage && <View style={styles.pinnedBanner}>
          <TouchableOpacity style={styles.pinnedContent} onPress={() => setPinnedListVisible(true)}>
            <View style={styles.pinAccent} />
            <View style={styles.pinnedCopy}><Text style={styles.pinnedTitle}>Pinned Message</Text><Text style={styles.pinnedPreview} numberOfLines={1}>{activePinnedMessage.displayText ?? activePinnedMessage.text}</Text></View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { const previous = activePinnedIndex > 0 ? String(pinnedMessages[activePinnedIndex - 1]._id) : null; togglePin(activePinnedMessage); setActivePinnedId(previous); }} style={styles.dismissPin} accessibilityLabel="Unpin message"><Text style={styles.dismissPinText}>X</Text></TouchableOpacity>
        </View>}

        <FlatList
          ref={listRef}
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
              <TouchableOpacity onLongPress={() => setSelectedMessage(item)} delayLongPress={500} style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble, item.pinned && styles.pinnedBubble]}>
                {item.replyTo && <View style={styles.replyQuote}><Text style={styles.replyQuoteName}>{item.replyTo.senderName}</Text><Text style={styles.replyQuoteText} numberOfLines={1}>{item.replyTo.text}</Text></View>}
                <Text style={isMe ? styles.myText : styles.otherText}>{item.displayText ?? item.text}</Text>
                {item.pinned && <Text style={isMe ? styles.pinMyText : styles.pinText}>Pinned</Text>}
              </TouchableOpacity>
            );
          }}
        />

        {replyTo && <View style={styles.replyComposer}><View style={styles.replyComposerBar} /><View style={styles.replyComposerCopy}><Text style={styles.replyComposerTitle}>Replying to {replyTo.sender?.name || replyTo.replyTo?.senderName || "message"}</Text><Text style={styles.replyComposerText} numberOfLines={1}>{replyTo.displayText ?? replyTo.text}</Text></View><TouchableOpacity onPress={() => setReplyTo(null)}><Text style={styles.dismissPinText}>X</Text></TouchableOpacity></View>}
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
      <Modal visible={pinnedListVisible} transparent animationType="slide" onRequestClose={() => setPinnedListVisible(false)}><View style={styles.menuBackdrop}><View style={styles.pinnedListModal}><View style={styles.pinnedListHeader}><Text style={styles.pinnedListTitle}>Pinned Messages</Text><TouchableOpacity onPress={() => setPinnedListVisible(false)}><Text style={styles.dismissPinText}>X</Text></TouchableOpacity></View>{[...pinnedMessages].reverse().map((message) => <TouchableOpacity key={String(message._id)} style={styles.pinnedListItem} onPress={() => { const index = messages.findIndex((item) => String(item._id) === String(message._id)); if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }); setActivePinnedId(String(message._id)); setPinnedListVisible(false); }}><View style={styles.pinAccentSmall} /><View style={styles.pinnedListCopy}><Text style={styles.pinnedListSender}>{typeof message.sender === "object" ? message.sender.name : "Message"}</Text><Text style={styles.pinnedListPreview} numberOfLines={2}>{message.displayText ?? message.text}</Text></View></TouchableOpacity>)}</View></View></Modal>
      <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={() => setSelectedMessage(null)}><View style={styles.menuBackdrop}><View style={styles.actionMenu}><Text style={styles.menuTitle}>Message actions</Text><TouchableOpacity onPress={async () => { if (selectedMessage) await togglePin(selectedMessage); setSelectedMessage(null); }} style={styles.menuAction}><Text style={styles.menuActionText}>{selectedMessage?.pinned ? "Unpin" : "Pin"}</Text></TouchableOpacity><TouchableOpacity onPress={() => { setReplyTo(selectedMessage); setSelectedMessage(null); }} style={styles.menuAction}><Text style={styles.menuActionText}>Reply</Text></TouchableOpacity><TouchableOpacity onPress={() => { const message = selectedMessage; setSelectedMessage(null); if (message) deleteMessage(message); }} style={styles.menuAction}><Text style={styles.deleteActionText}>Delete</Text></TouchableOpacity><TouchableOpacity onPress={() => setSelectedMessage(null)} style={styles.menuCancel}><Text style={styles.menuCancelText}>Cancel</Text></TouchableOpacity></View></View></Modal>
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
  partnerLabel: { color: AppColors.buttonInner, fontSize: 11, fontWeight: "700", marginTop: 2 },
  pinnedBanner: { flexDirection: "row", alignItems: "center", marginHorizontal: 10, marginTop: 8, borderRadius: 16, backgroundColor: "rgba(65,48,76,0.92)", minHeight: 76, overflow: "hidden" },
  pinnedContent: { flex: 1, flexDirection: "row", alignItems: "center", minHeight: 76 },
  pinAccent: { width: 6, alignSelf: "stretch", backgroundColor: AppColors.buttonInner, marginRight: 14 },
  pinnedCopy: { flex: 1, paddingVertical: 11 },
  pinnedTitle: { color: "#a9baff", fontSize: 18, fontWeight: "700" },
  pinnedPreview: { color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 4 },
  dismissPin: { width: 48, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  dismissPinText: { color: "rgba(255,255,255,0.65)", fontSize: 28, fontWeight: "300" },
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
  pinnedBubble: { borderWidth: 2, borderColor: AppColors.buttonInner },
  pinText: { color: AppColors.buttonInner, fontSize: 10, marginTop: 4, fontWeight: "700" },
  pinMyText: { color: AppColors.white, fontSize: 10, marginTop: 4, fontWeight: "700" },
  replyQuote: { borderLeftWidth: 3, borderLeftColor: AppColors.buttonInner, paddingLeft: 8, marginBottom: 6, maxWidth: 220 },
  replyQuoteName: { color: AppColors.buttonInner, fontSize: 11, fontWeight: "700" },
  replyQuoteText: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  replyComposer: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginBottom: 4, padding: 8, borderRadius: 10, backgroundColor: AppColors.whiteSoft },
  replyComposerBar: { width: 4, alignSelf: "stretch", backgroundColor: AppColors.buttonInner, borderRadius: 2, marginRight: 8 },
  replyComposerCopy: { flex: 1 },
  replyComposerTitle: { color: AppColors.primaryDark, fontSize: 12, fontWeight: "700" },
  replyComposerText: { color: AppColors.textMuted, fontSize: 12, marginTop: 2 },
  menuBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  actionMenu: { backgroundColor: AppColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  pinnedListModal: { backgroundColor: AppColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
  pinnedListHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  pinnedListTitle: { color: AppColors.primaryDark, fontSize: 20, fontWeight: "700" },
  pinnedListItem: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(20,42,68,0.1)" },
  pinAccentSmall: { width: 4, height: 42, borderRadius: 2, backgroundColor: AppColors.buttonInner, marginRight: 10 },
  pinnedListCopy: { flex: 1 },
  pinnedListSender: { color: AppColors.primaryDark, fontSize: 12, fontWeight: "700" },
  pinnedListPreview: { color: AppColors.textMuted, fontSize: 14, marginTop: 3 },
  menuTitle: { color: AppColors.textMuted, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  menuAction: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(20,42,68,0.1)" },
  menuActionText: { color: AppColors.primaryDark, fontSize: 17, fontWeight: "600" },
  deleteActionText: { color: "#b42318", fontSize: 17, fontWeight: "600" },
  menuCancel: { alignItems: "center", paddingVertical: 16 },
  menuCancelText: { color: AppColors.textMuted, fontSize: 16, fontWeight: "700" },
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