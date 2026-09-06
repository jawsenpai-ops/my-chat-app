import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { apiCall } from "../api/client";
import { AppColors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) return Alert.alert("Email required", "Enter your account email.");
    setLoading(true);
    try {
      const result = await apiCall<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      Alert.alert("Check your email", result.message);
    } catch (error: any) {
      Alert.alert("Request failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return <View style={styles.container}>
    <View style={styles.card}>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>Enter your email and we will send a reset link.</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={AppColors.placeholder} style={styles.input} />
      <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}><Text style={styles.buttonText}>{loading ? "Sending..." : "Send reset link"}</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>Back to login</Text></TouchableOpacity>
    </View>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: AppColors.background },
  card: { width: "100%", maxWidth: 420, alignSelf: "center", padding: 28, backgroundColor: "rgba(20,42,68,0.06)", borderRadius: 24 },
  title: { color: AppColors.text, fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  subtitle: { color: AppColors.textMuted, textAlign: "center", marginBottom: 24 },
  input: { backgroundColor: AppColors.whiteSoft, color: AppColors.inputText, borderRadius: 12, padding: 15, marginBottom: 16 },
  button: { backgroundColor: AppColors.buttonInner, padding: 15, borderRadius: 12, alignItems: "center", marginBottom: 18 },
  buttonText: { color: AppColors.white, fontWeight: "700" },
  link: { color: AppColors.buttonInner, textAlign: "center", fontWeight: "600" },
});
