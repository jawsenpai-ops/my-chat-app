import React from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../context/ThemeContext";

export const SettingsButton: React.FC = () => {
  const { theme, toggleTheme, spinValue } = useTheme();

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      style={[
        styles.button,
        {
          backgroundColor: theme.panel,
          borderColor: theme.panelBorder,
          transform: [{ rotate: spin }],
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={toggleTheme} style={styles.touchable}>
        <Text style={[styles.icon, { color: theme.icon }]}>⚙</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 28,
    left: 18,
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  touchable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 18,
    fontWeight: "700",
  },
});
