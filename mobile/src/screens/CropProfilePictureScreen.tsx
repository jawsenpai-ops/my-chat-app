import React, { useMemo, useRef, useState } from "react";
import { Alert, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImageManipulator from "expo-image-manipulator";
import { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { RootStackParamList } from "../types";
import { AppColors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "CropProfilePicture">;
const CROP_SIZE = 280;
const OUTPUT_SIZE = 256;

export const CropProfilePictureScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user, updateUser } = useAuth();
  const { uri, width, height } = route.params;
  const baseScale = Math.max(CROP_SIZE / width, CROP_SIZE / height);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const scale = baseScale * zoom;

  const clampOffset = (next: { x: number; y: number }) => {
    const maxX = Math.max(0, (width * scale - CROP_SIZE) / 2);
    const maxY = Math.max(0, (height * scale - CROP_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { dragStart.current = offsetRef.current; },
    onPanResponderMove: (_event, gesture) => {
      const next = clampOffset({ x: dragStart.current.x + gesture.dx, y: dragStart.current.y + gesture.dy });
      offsetRef.current = next;
      setOffset(next);
    },
  }), [scale]);

  const changeZoom = (nextZoom: number) => {
    setZoom(nextZoom);
    const renderedWidth = width * baseScale * nextZoom;
    const renderedHeight = height * baseScale * nextZoom;
    const next = clampOffset(offsetRef.current);
    offsetRef.current = next;
    setOffset(next);
  };

  const confirmCrop = async () => {
    setSaving(true);
    try {
      const renderedWidth = width * scale;
      const renderedHeight = height * scale;
      const imageLeft = (CROP_SIZE - renderedWidth) / 2 + offset.x;
      const imageTop = (CROP_SIZE - renderedHeight) / 2 + offset.y;
      const cropWidth = Math.min(width, CROP_SIZE / scale);
      const cropHeight = Math.min(height, CROP_SIZE / scale);
      const crop = {
        originX: Math.max(0, Math.min(width - cropWidth, (0 - imageLeft) / scale)),
        originY: Math.max(0, Math.min(height - cropHeight, (0 - imageTop) / scale)),
        width: cropWidth,
        height: cropHeight,
      };
      const result = await ImageManipulator.manipulateAsync(uri, [
        { crop },
        { resize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE } },
      ], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!result.base64) throw new Error("Could not create the profile picture");

      const updatedUser = await apiCall<NonNullable<typeof user>>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ avatar: `data:image/jpeg;base64,${result.base64}` }),
      });
      updateUser(updatedUser);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Could not update profile picture", error.message || "Please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.headerSafeArea} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={saving} accessibilityLabel="Cancel crop">
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Crop profile picture</Text>
          <TouchableOpacity onPress={confirmCrop} disabled={saving} accessibilityLabel="Confirm crop" style={styles.confirm}>
            <Text style={styles.check}>{saving ? "..." : "✓"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.cropStage} {...panResponder.panHandlers}>
        <Image source={{ uri }} style={{ width: width * scale, height: height * scale, transform: [{ translateX: offset.x }, { translateY: offset.y }] }} />
        <View pointerEvents="none" style={styles.cropMask} />
        <View pointerEvents="none" style={styles.cropRing} />
      </View>

      <View style={styles.controls}>
        <Text style={styles.hint}>Drag the image to reposition it</Text>
        <View style={styles.zoomRow}>
          <Text style={styles.zoomLabel}>−</Text>
          <View style={styles.zoomTrack}>
            {[1, 1.5, 2, 2.5, 3].map((value) => (
              <TouchableOpacity key={value} onPress={() => changeZoom(value)} style={[styles.zoomDot, zoom === value && styles.zoomDotActive]} />
            ))}
          </View>
          <Text style={styles.zoomLabel}>+</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#10151d" },
  headerSafeArea: { backgroundColor: "#10151d" },
  header: { height: 66, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: AppColors.white, fontSize: 17, fontWeight: "700" },
  cancel: { color: "#d7e2ef", fontSize: 16 },
  confirm: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  check: { color: AppColors.white, fontSize: 30, fontWeight: "700" },
  cropStage: { width: "100%", height: 360, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "#222b38" },
  cropMask: { position: "absolute", width: CROP_SIZE, height: CROP_SIZE, borderRadius: CROP_SIZE / 2, borderWidth: 1000, borderColor: "rgba(0,0,0,0.54)" },
  cropRing: { position: "absolute", width: CROP_SIZE, height: CROP_SIZE, borderRadius: CROP_SIZE / 2, borderWidth: 2, borderColor: AppColors.white, backgroundColor: "transparent" },
  controls: { alignItems: "center", paddingTop: 28 },
  hint: { color: "#d7e2ef", fontSize: 14 },
  zoomRow: { flexDirection: "row", alignItems: "center", marginTop: 28, gap: 14 },
  zoomLabel: { color: AppColors.white, fontSize: 22, width: 20, textAlign: "center" },
  zoomTrack: { width: 220, height: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  zoomDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#718096" },
  zoomDotActive: { width: 22, height: 22, borderRadius: 11, backgroundColor: AppColors.buttonInner, borderWidth: 3, borderColor: AppColors.white },
});
