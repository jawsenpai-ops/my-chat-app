import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, User } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { SettingsButton } from "../components/SettingsButton";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme } = useTheme();

  const handleRegister = async () => {
    if (!name || !email || !password) return Alert.alert("Error", "Please fill all fields");

    setLoading(true);
    try {
      const data = await apiCall<{ token: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });

      await login(data.token, data.user);
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SettingsButton />

      <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
        <View style={[styles.logoBox, { backgroundColor: theme.buttonInner }]}>
          <Text style={styles.logoText}>L</Text>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Sign up to start messaging</Text>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
          <TextInput
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
            placeholderTextColor={theme.inputPlaceholder}
            style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Email</Text>
          <TextInput
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            placeholderTextColor={theme.inputPlaceholder}
            style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              placeholderTextColor={theme.inputPlaceholder}
              style={[styles.inputWithButton, { backgroundColor: theme.input, color: theme.text }]}
            />
            <TouchableOpacity style={styles.showPassword} onPress={() => setShowPassword((prev) => !prev)}>
              <Text style={[styles.showPasswordText, { color: theme.textMuted }]}>{showPassword ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: theme.buttonInner }]} onPress={handleRegister} disabled={loading}>
          <Text style={[styles.btnText, { color: theme.buttonText }]}>{loading ? "Creating..." : "Register"}</Text>
        </TouchableOpacity>

        <View style={styles.signupRow}>
          <Text style={[styles.signupText, { color: theme.textMuted }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={[styles.signupLink, { color: theme.text }]}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 40,
    borderWidth: 1,
    borderRadius: 24,
    marginHorizontal: 0,
    shadowColor: "#263A47",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 6,
  },
  logoBox: {
    width: 65,
    height: 65,
    marginBottom: 20,
    borderRadius: 18,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#263A47",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },
  title: {
    textAlign: "center",
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    marginBottom: 30,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 2,
    borderColor: "transparent",
  },
  passwordWrap: {
    position: "relative",
    justifyContent: "center",
  },
  inputWithButton: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 70,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 2,
    borderColor: "transparent",
  },
  showPassword: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: [{ translateY: -9 }],
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  showPasswordText: {
    fontSize: 13,
    fontWeight: "600",
  },
  button: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#263A47",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 5,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontWeight: "700",
    fontSize: 14,
  },
});