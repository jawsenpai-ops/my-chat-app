import React from "react";
import { StyleSheet, View } from "react-native";
import { AppColors } from "../theme/colors";

export const CommentBubbleIcon: React.FC = () => (
  <View style={styles.icon}>
    <View style={styles.bubble} />
    <View style={styles.topLine} />
    <View style={styles.bottomLine} />
    <View style={styles.dot} />
  </View>
);

const styles = StyleSheet.create({
  icon: { width: 36, height: 26 },
  bubble: { position: "absolute", left: 0, top: 0, width: 36, height: 26, borderWidth: 2.5, borderColor: AppColors.primaryDark, borderRadius: 18, backgroundColor: AppColors.surface },
  topLine: { position: "absolute", left: 8, top: 8, width: 20, height: 2.5, borderRadius: 1.5, backgroundColor: AppColors.primaryDark },
  bottomLine: { position: "absolute", left: 8, top: 16, width: 10, height: 2.5, borderRadius: 1.5, backgroundColor: AppColors.primaryDark },
  dot: { position: "absolute", left: 25, top: 16, width: 4, height: 4, borderRadius: 2, backgroundColor: AppColors.primaryDark },
});