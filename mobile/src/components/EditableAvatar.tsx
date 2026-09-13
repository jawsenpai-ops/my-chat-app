import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { AppColors } from "../theme/colors";

type Props = {
  uri?: string;
  /** Diameter of the avatar in px. */
  size?: number;
  /** Called when the camera badge is tapped (e.g. launch ImagePicker). */
  onPress?: () => void;
  disabled?: boolean;
};

/**
 * Circular avatar with an "edit" badge pinned to the bottom-right corner.
 *
 * How the overlap works:
 * 1. The outer <View> is `position: "relative"` (default) with explicit width/height —
 *    absolutely-positioned children are placed relative to it.
 * 2. The badge <TouchableOpacity> uses position: "absolute", bottom: 0, right: 0,
 *    so it sits on top of (overlapping) the avatar's bottom-right corner.
 * 3. borderRadius = size / 2 makes both the avatar and the badge perfect circles,
 *    and a border in the page background color creates the "cutout ring" effect.
 */
export const EditableAvatar: React.FC<Props> = ({ uri, size = 104, onPress, disabled = false }) => {
  const badgeSize = Math.max(28, Math.round(size * 0.3));

  return (
    <View style={{ width: size, height: size }}>
      {/* The profile image fills the wrapper */}
      <Image
        source={{ uri }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      />

      {/* Edit badge — absolutely positioned over the image's bottom-right corner */}
      <TouchableOpacity
        style={[
          styles.badge,
          { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 },
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Change profile picture"
      >
        <Image
          source={require("../../assets/Plasma.jpg")}
          style={{ width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }}
          resizeMode="cover"
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: AppColors.whiteSoft,
  },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#1b1b22",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: AppColors.background,
    overflow: "hidden",
  },
});