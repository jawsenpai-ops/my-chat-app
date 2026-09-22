import React, { useEffect, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiCall } from "../api/client";
import { getSocket } from "../api/socket";
import { AppColors } from "../theme/colors";
import { AppNotification, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

export const NotificationScreen: React.FC<Props> = ({ navigation }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const socket = getSocket();

  const loadNotifications = async () => {
    try { setNotifications(await apiCall<AppNotification[]>("/notifications")); } catch { /* Keep the center usable while offline. */ }
  };

  useEffect(() => {
    loadNotifications();
    const handleNotification = () => loadNotifications();
    socket.on("notification", handleNotification);
    return () => { socket.off("notification", handleNotification); };
  }, []);

  const openNotification = async (item: AppNotification) => {
    if (!item.isRead) {
      setNotifications((current) => current.map((notification) => notification._id === item._id ? { ...notification, isRead: true } : notification));
      await apiCall(`/notifications/${item._id}/read`, { method: "PATCH" }).catch(() => undefined);
    }
    if (item.type === "FRIEND_REQ") navigation.navigate("Profile", { userId: item.sender._id });
    else if (item.type === "FRIEND_ACCEPT") navigation.navigate("Profile", { userId: item.sender._id });
    else navigation.navigate("Freedom", { highlightPostId: item.entityId });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}><Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.title}>Notifications</Text><View style={styles.headerSpace} /></View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => openNotification(item)} style={[styles.item, !item.isRead && styles.unread]}>
            <Image source={{ uri: item.sender.avatar }} style={styles.avatar} />
            <View style={styles.copy}><Text style={styles.message}>{item.message}</Text><Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text></View>
            {!item.isRead && <View style={styles.dot} />}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  back: { color: AppColors.primaryDark, fontSize: 38, lineHeight: 40 },
  title: { color: AppColors.primaryDark, fontSize: 20, fontWeight: "700" },
  headerSpace: { width: 28 },
  list: { padding: 12 },
  emptyContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: AppColors.textMuted, fontSize: 15 },
  item: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(20,42,68,0.1)" },
  unread: { backgroundColor: AppColors.whiteSoft },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: AppColors.whiteSoft },
  copy: { flex: 1, marginLeft: 12 },
  message: { color: AppColors.primaryDark, fontSize: 14, lineHeight: 20 },
  time: { color: AppColors.textMuted, fontSize: 11, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: AppColors.buttonInner, marginLeft: 8 },
});
