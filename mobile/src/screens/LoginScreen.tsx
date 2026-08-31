import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, User } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AppColors, AppShadow } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert("Error", "Please fill all fields");

    setLoading(true);
    try {
      const data = await apiCall<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      await login(data.token, data.user);
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>L</Text>
        </View>

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Login to your account to continue</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            placeholderTextColor={AppColors.placeholder}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              placeholderTextColor={AppColors.placeholder}
              style={styles.inputWithButton}
            />
            <TouchableOpacity style={styles.showPassword} onPress={() => setShowPassword((prev) => !prev)}>
              <Text style={styles.showPasswordText}>{showPassword ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.optionsRow}>
          <View style={styles.rememberWrap}>
            <Text style={styles.rememberText}>Remember me</Text>
          </View>

          <TouchableOpacity>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Signing in..." : "Login"}</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <Text style={styles.dividerText}>OR</Text>
        </View>

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.signupLink}>Sign up</Text>
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
    padding: 20,
    backgroundColor: AppColors.background,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 40,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    borderRadius: 24,
    ...AppShadow.soft,
  },
  logoBox: {
    width: 65,
    height: 65,
    marginBottom: 20,
    borderRadius: 18,
    backgroundColor: AppColors.primaryDark,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: AppColors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  logoText: {
    color: AppColors.white,
    fontSize: 28,
    fontWeight: "700",
  },
  title: {
    textAlign: "center",
    color: AppColors.text,
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    color: AppColors.textMuted,
    fontSize: 14,
    marginBottom: 30,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    color: AppColors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: AppColors.whiteSoft,
    color: AppColors.inputText,
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
    backgroundColor: AppColors.whiteSoft,
    color: AppColors.inputText,
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
    color: AppColors.primaryMid,
    fontSize: 13,
    fontWeight: "600",
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
    marginBottom: 25,
  },
  rememberWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  rememberText: {
    color: AppColors.text,
    fontSize: 13,
  },
  forgotText: {
    color: AppColors.text,
    fontWeight: "600",
    fontSize: 13,
  },
  button: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: AppColors.primaryDark,
    alignItems: "center",
    shadowColor: AppColors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 5,
  },
  btnText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
  },
  dividerText: {
    flex: 1,
    textAlign: "center",
    color: AppColors.textMuted,
    fontSize: 13,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    color: AppColors.textMuted,
    fontSize: 14,
  },
  signupLink: {
    color: AppColors.primaryDark,
    fontWeight: "700",
    fontSize: 14,
  },
});