import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { AppColors } from "../theme/colors";

type Props = {
  uri?: string;
  size?: number;
  online?: boolean;
};

export const AvatarWithStatus: React.FC<Props> = ({ uri, size = 42, online = false }) => {
  const dotSize = Math.max(10, Math.round(size * 0.28));
  return (
    <View style={{ width: size, height: size }}>
      <Image source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: Math.max(2, Math.round(size * 0.05)),
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: AppColors.whiteSoft,
  },
  onlineDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    backgroundColor: AppColors.success,
    borderColor: AppColors.background,
  },
});