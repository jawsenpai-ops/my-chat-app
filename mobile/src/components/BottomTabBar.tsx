import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppColors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";

type Props = {
  onProfilePress: () => void;
  onActionPress: () => void;
};

export const BottomTabBar: React.FC<Props> = ({ onProfilePress, onActionPress }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const socket = getSocket();
  const [isOnline, setIsOnline] = useState(socket.connected);

  useEffect(() => {
    const handleConnect = () => setIsOnline(true);
    const handleDisconnect = () => setIsOnline(false);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);

  return (
    <View style={[styles.safeArea, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
      <View style={styles.bar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onProfilePress}
          style={styles.profileButton}
        >
          <View style={styles.avatarFrame}>
            <Image source={{ uri: user?.avatar }} style={styles.avatar} />
            {isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name} numberOfLines={1}>{user?.name || "User"}</Text>
            <Text style={styles.status}>{isOnline ? "Online" : "Offline"}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open Freedom"
          onPress={onActionPress}
          style={styles.actionButton}
        >
          <Text style={styles.actionIcon}>∆</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: AppColors.background,
    paddingHorizontal: 12,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    padding: 8,
    borderRadius: 20,
    backgroundColor: AppColors.primaryDark,
    shadowColor: AppColors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  profileButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    paddingHorizontal: 6,
  },
  avatarFrame: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.surface,
  },
  onlineDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: AppColors.success,
    borderWidth: 2,
    borderColor: AppColors.primaryDark,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  name: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  status: {
    color: AppColors.whiteSoft,
    fontSize: 12,
    marginTop: 3,
  },
  actionButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    borderRadius: 14,
    backgroundColor: AppColors.buttonInner,
  },
  actionIcon: {
    color: AppColors.white,
    fontSize: 23,
    fontWeight: "600",
  },
});