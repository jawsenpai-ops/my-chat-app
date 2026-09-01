import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { RootStackParamList, User } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AppColors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState<User | null>(user);
  const [bio, setBio] = useState(user?.bio || "");
  const [editingBio, setEditingBio] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const freshProfile = await apiCall<User>("/users/me");
        setProfile(freshProfile);
        setBio(freshProfile.bio || "");
        updateUser(freshProfile);
      } catch (error: any) {
        Alert.alert("Profile unavailable", error.message);
      }
    };
    loadProfile();
  }, []);

  const saveBio = async () => {
    setSaving(true);
    try {
      const updatedProfile = await apiCall<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ bio }),
      });
      setProfile(updatedProfile);
      setBio(updatedProfile.bio || "");
      updateUser(updatedProfile);
      setEditingBio(false);
    } catch (error: any) {
      Alert.alert("Could not save bio", error.message);
    } finally {
      setSaving(false);
    }
  };

  const showMoreOptions = () => {
    Alert.alert("Profile actions", undefined, [
      { text: "Log out", style: "destructive", onPress: logout },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "Not available";

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton} accessibilityLabel="Go back">
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={showMoreOptions} style={styles.headerButton} accessibilityLabel="More options">
          <Text style={styles.moreIcon}>⋮</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.profileIntro}>
          <Image source={{ uri: profile?.avatar }} style={styles.avatar} />
          <Text style={styles.name}>{profile?.name || "User"}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        <View style={styles.accountSection}>
          <Text style={styles.sectionLabel}>ACCOUNT INFORMATION</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Joined</Text>
            <Text style={styles.infoValue}>{joinedDate}</Text>
          </View>
        </View>

        <View style={styles.bioSection}>
          <View style={styles.bioHeading}>
            <Text style={styles.sectionLabel}>BIO</Text>
            {!editingBio && (
              <TouchableOpacity onPress={() => setEditingBio(true)}>
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingBio ? (
            <>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people a little about yourself"
                placeholderTextColor={AppColors.placeholder}
                multiline
                maxLength={500}
                autoFocus
                style={styles.bioInput}
              />
              <View style={styles.bioActions}>
                <TouchableOpacity onPress={() => { setBio(profile?.bio || ""); setEditingBio(false); }}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveBio} disabled={saving} style={styles.saveButton}>
                  <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => setEditingBio(true)} style={styles.bioDisplay}>
              <Text style={bio ? styles.bioText : styles.emptyBioText}>
                {bio || "Add a bio"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.avatarNote}>Profile picture</Text>
        <Text style={styles.helperText}>Your profile picture is shown to your contacts.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  backIcon: { color: AppColors.primaryDark, fontSize: 38, fontWeight: "300", lineHeight: 40 },
  moreIcon: { color: AppColors.primaryDark, fontSize: 28, fontWeight: "700", lineHeight: 30 },
  headerTitle: { color: AppColors.primaryDark, fontSize: 18, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingBottom: 36 },
  profileIntro: { alignItems: "center", paddingVertical: 20 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: AppColors.whiteSoft, marginBottom: 14 },
  name: { color: AppColors.primaryDark, fontSize: 24, fontWeight: "700" },
  email: { color: AppColors.textMuted, fontSize: 14, marginTop: 5 },
  accountSection: { marginTop: 12 },
  sectionLabel: { color: AppColors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  infoRow: { borderBottomWidth: 1, borderBottomColor: "rgba(20,42,68,0.12)", paddingVertical: 16 },
  infoLabel: { color: AppColors.textMuted, fontSize: 13, marginBottom: 5 },
  infoValue: { color: AppColors.primaryDark, fontSize: 16, fontWeight: "600" },
  bioSection: { marginTop: 28 },
  bioHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  actionText: { color: AppColors.buttonInner, fontWeight: "700", fontSize: 14 },
  bioDisplay: { minHeight: 54, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "rgba(20,42,68,0.12)" },
  bioText: { color: AppColors.primaryDark, fontSize: 16, lineHeight: 22 },
  emptyBioText: { color: AppColors.textMuted, fontSize: 16 },
  bioInput: { minHeight: 100, borderRadius: 12, padding: 14, backgroundColor: AppColors.whiteSoft, color: AppColors.inputText, fontSize: 16, textAlignVertical: "top" },
  bioActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 18, marginTop: 12 },
  cancelText: { color: AppColors.textMuted, fontWeight: "600" },
  saveButton: { backgroundColor: AppColors.buttonInner, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  saveText: { color: AppColors.white, fontWeight: "700" },
  avatarNote: { color: AppColors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginTop: 32 },
  helperText: { color: AppColors.textMuted, fontSize: 13, marginTop: 8 },
});
