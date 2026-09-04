import React from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppColors } from "../theme/colors";

export const FreedomScreen: React.FC = () => (
  <SafeAreaView style={styles.container}>
    <Text style={styles.title}>Welcome from Freedom</Text>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.background,
    paddingHorizontal: 24,
  },
  title: {
    color: AppColors.primaryDark,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
});