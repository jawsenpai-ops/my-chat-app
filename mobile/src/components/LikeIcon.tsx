import React from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { AppColors } from "../theme/colors";

type Props = {
  liked: boolean;
};

export const LikeIcon: React.FC<Props> = ({ liked }) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const wasLiked = React.useRef(liked);

  React.useEffect(() => {
    if (liked && !wasLiked.current) {
      scale.stopAnimation();
      scale.setValue(0.65);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.25, friction: 3, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
    wasLiked.current = liked;
  }, [liked, scale]);

  return (
    <Animated.Text style={[styles.icon, liked && styles.liked, { transform: [{ scale }] }]}>
      {liked ? "♥" : "♡"}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  icon: { width: 24, color: AppColors.primaryDark, fontSize: 22, lineHeight: 26, textAlign: "center" },
  liked: { color: AppColors.heart },
});