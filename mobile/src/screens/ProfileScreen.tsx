import React, { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { FriendRelationship, FriendStatus, RootStackParamList, User } from "../types";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AppColors } from "../theme/colors";
import { BottomTabBar } from "../components/BottomTabBar";
import { AvatarWithStatus } from "../components/AvatarWithStatus";
import { getSocket } from "../api/socket";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export const ProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user, updateUser, logout } = useAuth();
  const viewedUserId = route.params?.userId;
  const isOwnProfile = !viewedUserId || String(viewedUserId) === String(user?._id);
  const profileOnline = isOwnProfile || route.params?.online === true;
  const [profile, setProfile] = useState<User | null>(isOwnProfile ? user : null);
  const [bio, setBio] = useState(isOwnProfile ? user?.bio || "" : "");
  const [editingBio, setEditingBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState("general");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [friendRelationship, setFriendRelationship] = useState<FriendRelationship>({ status: "none" });
  const [friendLoading, setFriendLoading] = useState(false);
  const friendSocket = getSocket();

  useEffect(() => {
    if (isOwnProfile && user) {
      setProfile(user);
      setBio(user.bio || "");
    } else if (!isOwnProfile) {
      setProfile(null);
      setBio("");
      setEditingBio(false);
    }
  }, [isOwnProfile, user]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const targetId = viewedUserId;
        const freshProfile = await apiCall<User>(targetId ? `/users/${targetId}` : "/users/me");
        setProfile(freshProfile);
        setBio(freshProfile.bio || "");
        if (!targetId) updateUser(freshProfile);
      } catch (error: any) {
        Alert.alert("Profile unavailable", error.message);
      }
    };
    loadProfile();
  }, [viewedUserId]);

  useEffect(() => {
    if (isOwnProfile || !viewedUserId) return;
    const loadFriendStatus = async () => {
      try { setFriendRelationship(await apiCall<FriendRelationship>(`/friends/status/${viewedUserId}`)); } catch { setFriendRelationship({ status: "none" }); }
    };
    loadFriendStatus();
    const sync = () => loadFriendStatus();
    friendSocket.on("friend-request-accepted", sync);
    friendSocket.on("friend-request-received", sync);
    friendSocket.on("friend-request-declined", sync);
    friendSocket.on("friend-request-cancelled", sync);
    return () => { friendSocket.off("friend-request-received", sync); friendSocket.off("friend-request-accepted", sync); friendSocket.off("friend-request-declined", sync); friendSocket.off("friend-request-cancelled", sync); };
  }, [isOwnProfile, viewedUserId]);

  const refreshFriendStatus = async () => { if (viewedUserId) setFriendRelationship(await apiCall<FriendRelationship>(`/friends/status/${viewedUserId}`)); };
  const findIncomingRequestId = async () => { const incoming = await apiCall<Array<{ requestId: number | string; _id: number | string }>>("/friends/requests/incoming"); return incoming.find((request) => String(request._id) === String(viewedUserId))?.requestId; };
  const friendAction = async (action: "add" | "cancel" | "accept" | "decline" | "remove") => {
    if (!viewedUserId) return;
    setFriendLoading(true);
    try {
      if (action === "add") await apiCall(`/friends/request/${viewedUserId}`, { method: "POST" });
      if (action === "cancel" || action === "remove") await apiCall(`/friends/${action === "cancel" ? `request/${viewedUserId}` : viewedUserId}`, { method: "DELETE" });
      if (action === "accept" || action === "decline") { const requestId = friendRelationship.requestId || await findIncomingRequestId(); if (!requestId) throw new Error("Friend request not found"); await apiCall(`/friends/request/${requestId}/${action}`, { method: "POST" }); }
      await refreshFriendStatus();
    } catch (error: any) { Alert.alert("Could not update friendship", error.message); } finally { setFriendLoading(false); }
  };

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

  const changeProfilePicture = async () => {
    const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    let granted = permission.granted;
    if (!granted) {
      const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) {
      Alert.alert("Photo permission required", "Allow photo access in Settings to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      navigation.navigate("CropProfilePicture", {
        uri: result.assets[0].uri,
        width: result.assets[0].width,
        height: result.assets[0].height,
      });
    }
  };

  const showMoreOptions = () => {
    Alert.alert("Profile actions", undefined, [
      { text: "Change Profile Picture", onPress: changeProfilePicture },
      ...(user?.role === "admin" ? [{ text: "Admin Dashboard", onPress: () => navigation.navigate("AdminDashboard") }] : []),
      { text: "Delete account", style: "destructive", onPress: confirmDeleteAccount },
      { text: "Log out", style: "destructive", onPress: logout },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert("Delete account", "This permanently deletes your account. Continue?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await apiCall("/account", { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }) });
          await logout();
        } catch (error: any) { Alert.alert("Could not delete account", error.message); }
      } },
    ]);
  };

  const sendFeedback = async () => {
    if (!feedbackSubject.trim() || !feedbackMessage.trim()) {
      Alert.alert("Add more detail", "Enter a subject and describe your feedback.");
      return;
    }
    setSendingFeedback(true);
    try {
      await apiCall("/feedback", { method: "POST", body: JSON.stringify({ type: feedbackType, subject: feedbackSubject, message: feedbackMessage }) });
      setFeedbackVisible(false);
      setFeedbackSubject("");
      setFeedbackMessage("");
      Alert.alert("Feedback sent", "Thanks for helping improve the app.");
    } catch (error: any) {
      Alert.alert("Could not send feedback", error.message);
    } finally {
      setSendingFeedback(false);
    }
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
        {isOwnProfile ? <TouchableOpacity onPress={showMoreOptions} style={styles.headerButton} accessibilityLabel="More options">
          <Text style={styles.moreIcon}>⋮</Text>
        </TouchableOpacity> : <View style={styles.headerButton} />}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.profileIntro}>
          <AvatarWithStatus uri={profile?.avatar} size={104} online={profileOnline} />
          <Text style={styles.name}>{profile?.name || "User"}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          {!isOwnProfile && <View style={styles.friendActions}>{friendRelationship.status === "none" && <TouchableOpacity disabled={friendLoading} onPress={() => friendAction("add")} style={styles.friendButton}><Text style={styles.friendButtonText}>{friendLoading ? "..." : "Add Friend"}</Text></TouchableOpacity>}{friendRelationship.status === "pending_sent" && <TouchableOpacity disabled={friendLoading} onPress={() => friendAction("cancel")} style={styles.friendButtonSecondary}><Text style={styles.friendButtonSecondaryText}>Cancel Request</Text></TouchableOpacity>}{friendRelationship.status === "pending_received" && <><TouchableOpacity disabled={friendLoading} onPress={() => friendAction("accept")} style={styles.friendButton}><Text style={styles.friendButtonText}>Confirm</Text></TouchableOpacity><TouchableOpacity disabled={friendLoading} onPress={() => friendAction("decline")} style={styles.friendButtonSecondary}><Text style={styles.friendButtonSecondaryText}>Delete</Text></TouchableOpacity></>}{friendRelationship.status === "friends" && <TouchableOpacity disabled={friendLoading} onPress={() => friendAction("remove")} style={styles.friendButtonSecondary}><Text style={styles.friendButtonSecondaryText}>Friends ✓</Text></TouchableOpacity>}{friendRelationship.status === "blocked" && <Text style={styles.blockedText}>Blocked</Text>}</View>}
        </View>

        <View style={styles.accountSection}>
          <Text style={styles.sectionLabel}>ACCOUNT INFORMATION</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Joined Date</Text>
            <Text style={styles.infoValue}>{joinedDate}</Text>
          </View>
        </View>

        <View style={styles.bioSection}>
          <View style={styles.bioHeading}>
            <Text style={styles.sectionLabel}>BIO</Text>
            {isOwnProfile && !editingBio && (
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
            <TouchableOpacity disabled={!isOwnProfile} onPress={() => setEditingBio(true)} style={styles.bioDisplay}>
              <Text style={bio ? styles.bioText : styles.emptyBioText}>
                {bio || "Add a bio"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isOwnProfile && <><Text style={styles.avatarNote}>Profile picture</Text>
        <Text style={styles.helperText}>Your profile picture is shown to your contacts.</Text>
        <TouchableOpacity onPress={() => setFeedbackVisible(true)} style={styles.feedbackButton}>
          <Text style={styles.feedbackButtonText}>Send feedback</Text>
        </TouchableOpacity></>}
        {isOwnProfile && user?.role === "admin" && <TouchableOpacity onPress={() => navigation.navigate("AdminDashboard")} style={styles.adminButton}>
          <Text style={styles.adminButtonText}>Open admin dashboard</Text>
        </TouchableOpacity>}
      </ScrollView>
      <BottomTabBar
        onProfilePress={() => navigation.navigate("Profile")}
        onActionPress={() => navigation.navigate("Freedom")}
      />
      <Modal visible={feedbackVisible} animationType="slide" transparent onRequestClose={() => setFeedbackVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.feedbackModal}>
            <Text style={styles.modalTitle}>Send feedback</Text>
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>{["general", "bug", "feature", "problem"].map((type) => <TouchableOpacity key={type} onPress={() => setFeedbackType(type)} style={[styles.typeButton, feedbackType === type && styles.typeButtonSelected]}><Text style={[styles.typeText, feedbackType === type && styles.typeTextSelected]}>{type}</Text></TouchableOpacity>)}</View>
            <TextInput value={feedbackSubject} onChangeText={setFeedbackSubject} placeholder="Subject" placeholderTextColor={AppColors.placeholder} style={styles.feedbackInput} maxLength={255} />
            <TextInput value={feedbackMessage} onChangeText={setFeedbackMessage} placeholder="Tell us what happened or what you would like to see" placeholderTextColor={AppColors.placeholder} multiline style={[styles.feedbackInput, styles.feedbackMessage]} maxLength={5000} />
            <View style={styles.feedbackActions}><TouchableOpacity onPress={() => setFeedbackVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={sendFeedback} disabled={sendingFeedback} style={styles.saveButton}><Text style={styles.saveText}>{sendingFeedback ? "Sending..." : "Send"}</Text></TouchableOpacity></View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  scrollView: { flex: 1 },
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
  friendActions: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 14 },
  friendButton: { backgroundColor: AppColors.buttonInner, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  friendButtonText: { color: AppColors.white, fontWeight: "700" },
  friendButtonSecondary: { backgroundColor: AppColors.whiteSoft, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  friendButtonSecondaryText: { color: AppColors.primaryDark, fontWeight: "700" },
  blockedText: { color: "#b42318", fontWeight: "700" },
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
  feedbackButton: { marginTop: 30, paddingVertical: 14, borderRadius: 12, backgroundColor: AppColors.buttonInner, alignItems: "center" },
  feedbackButtonText: { color: AppColors.white, fontWeight: "700" },
  adminButton: { marginTop: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: AppColors.whiteSoft, alignItems: "center" },
  adminButtonText: { color: AppColors.primaryDark, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  feedbackModal: { backgroundColor: AppColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  modalTitle: { color: AppColors.primaryDark, fontSize: 20, fontWeight: "700", marginBottom: 18 },
  fieldLabel: { color: AppColors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  typeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: AppColors.whiteSoft },
  typeButtonSelected: { backgroundColor: AppColors.buttonInner },
  typeText: { color: AppColors.primaryDark, fontWeight: "600", textTransform: "capitalize" },
  typeTextSelected: { color: AppColors.white },
  feedbackInput: { backgroundColor: AppColors.white, color: AppColors.inputText, borderRadius: 12, padding: 13, marginBottom: 10 },
  feedbackMessage: { minHeight: 120, textAlignVertical: "top" },
  feedbackActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 18, marginTop: 8 },
});
