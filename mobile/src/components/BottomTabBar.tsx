import React, { useEffect, useState } from "react";
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppColors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";

type Props = {
  onProfilePress: () => void;
  onCreatePress?: () => void;
  onActionPress: () => void;
  showCreate?: boolean;
};

export const BottomTabBar: React.FC<Props> = ({ onProfilePress, onCreatePress, onActionPress, showCreate = false }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const socket = getSocket();
  const [isOnline, setIsOnline] = useState(socket.connected);
  const createProgress = React.useRef(new Animated.Value(showCreate ? 0 : 1)).current;

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

  useEffect(() => {
    if (!showCreate) return;
    createProgress.setValue(0);
    Animated.spring(createProgress, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
  }, [createProgress, showCreate]);

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
        {showCreate && onCreatePress && <Animated.View style={[styles.addButton, { opacity: createProgress, transform: [{ scale: createProgress }] }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create post" onPress={onCreatePress} style={styles.addButtonTouch}>
            <Text style={styles.addIcon}>+</Text>
          </TouchableOpacity>
        </Animated.View>}
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
  addButton: {
    position: "absolute",
    top: 12,
    left: "50%",
    marginLeft: -22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: AppColors.buttonOuter,
  },
  addButtonTouch: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  addIcon: { color: AppColors.white, fontSize: 28, fontWeight: "400", lineHeight: 30 },
  actionIcon: {
    color: AppColors.white,
    fontSize: 23,
    fontWeight: "600",
  },
});