import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AppColors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "AdminDashboard">;
type Stats = { users: number; feedback: number; messages: number };
type Feedback = { id: number; subject: string; message: string; status: string; user_name: string; user_email: string };

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    Promise.all([apiCall<Stats>("/admin/stats"), apiCall<Feedback[]>("/admin/feedback")])
      .then(([loadedStats, loadedFeedback]) => { setStats(loadedStats); setFeedback(loadedFeedback); })
      .catch((error: any) => Alert.alert("Dashboard unavailable", error.message));
  }, [user?.role]);

  if (user?.role !== "admin") return <View style={styles.center}><Text style={styles.title}>Access denied</Text></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}><Text style={styles.title}>Admin dashboard</Text><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>Close</Text></TouchableOpacity></View>
    <View style={styles.stats}>{(["users", "feedback", "messages"] as const).map((key) => <View style={styles.stat} key={key}><Text style={styles.statValue}>{stats?.[key] ?? "-"}</Text><Text style={styles.statLabel}>{key}</Text></View>)}</View>
    <Text style={styles.section}>Recent feedback</Text>
    {feedback.length === 0 ? <Text style={styles.muted}>No feedback yet.</Text> : feedback.map((item) => <View style={styles.item} key={item.id}><Text style={styles.itemTitle}>{item.subject}</Text><Text style={styles.muted}>{item.user_name} ({item.user_email})</Text><Text style={styles.itemMessage}>{item.message}</Text><Text style={styles.status}>{item.status}</Text></View>)}
  </ScrollView>;
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.background }, content: { padding: 20, paddingTop: 60 }, center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: AppColors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }, title: { color: AppColors.primaryDark, fontSize: 24, fontWeight: "700" }, link: { color: AppColors.buttonInner, fontWeight: "700" }, stats: { flexDirection: "row", gap: 10, marginBottom: 28 }, stat: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: AppColors.whiteSoft }, statValue: { color: AppColors.primaryDark, fontSize: 24, fontWeight: "700" }, statLabel: { color: AppColors.textMuted, marginTop: 4, textTransform: "capitalize" }, section: { color: AppColors.primaryDark, fontSize: 18, fontWeight: "700", marginBottom: 12 }, muted: { color: AppColors.textMuted }, item: { backgroundColor: AppColors.whiteSoft, padding: 14, borderRadius: 12, marginBottom: 10 }, itemTitle: { color: AppColors.primaryDark, fontSize: 16, fontWeight: "700" }, itemMessage: { color: AppColors.text, marginVertical: 8 }, status: { color: AppColors.buttonInner, fontWeight: "700", textTransform: "capitalize" },
});
