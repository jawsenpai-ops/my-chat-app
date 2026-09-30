import React from "react";
import { StyleSheet, Text } from "react-native";
import { AppColors } from "../theme/colors";

type Props = {
  liked: boolean;
};

export const LikeIcon: React.FC<Props> = ({ liked }) => (
  <Text style={[styles.icon, liked && styles.liked]}>{liked ? "♥" : "♡"}</Text>
);

const styles = StyleSheet.create({
  icon: { width: 24, color: AppColors.primaryDark, fontSize: 22, lineHeight: 26, textAlign: "center" },
  liked: { color: AppColors.buttonInner },
});