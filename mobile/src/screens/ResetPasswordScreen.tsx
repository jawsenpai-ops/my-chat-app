import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { apiCall } from "../api/client";
import { AppColors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

export const ResetPasswordScreen: React.FC<Props> = ({ route, navigation }) => {
  const [token, setToken] = useState(route.params?.token || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!token.trim() || password.length < 8) return Alert.alert("Invalid details", "Enter the reset token and a password of at least 8 characters.");
    setLoading(true);
    try {
      await apiCall("/auth/reset-password", { method: "POST", body: JSON.stringify({ token: token.trim(), password }) });
      Alert.alert("Password updated", "You can now log in.", [{ text: "Login", onPress: () => navigation.navigate("Login") }]);
    } catch (error: any) {
      Alert.alert("Reset failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return <View style={styles.container}>
    <View style={styles.card}>
      <Text style={styles.title}>Choose a new password</Text>
      <TextInput value={token} onChangeText={setToken} placeholder="Paste reset token" placeholderTextColor={AppColors.placeholder} autoCapitalize="none" style={styles.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="New password" placeholderTextColor={AppColors.placeholder} secureTextEntry style={styles.input} />
      <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}><Text style={styles.buttonText}>{loading ? "Updating..." : "Update password"}</Text></TouchableOpacity>
    </View>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: AppColors.background },
  card: { width: "100%", maxWidth: 420, alignSelf: "center", padding: 28, backgroundColor: "rgba(20,42,68,0.06)", borderRadius: 24 },
  title: { color: AppColors.text, fontSize: 26, fontWeight: "700", textAlign: "center", marginBottom: 24 },
  input: { backgroundColor: AppColors.whiteSoft, color: AppColors.inputText, borderRadius: 12, padding: 15, marginBottom: 14 },
  button: { backgroundColor: AppColors.buttonInner, padding: 15, borderRadius: 12, alignItems: "center" },
  buttonText: { color: AppColors.white, fontWeight: "700" },
});
