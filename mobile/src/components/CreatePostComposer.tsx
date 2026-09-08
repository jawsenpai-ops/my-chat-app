import React, { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Alert, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AppColors } from "../theme/colors";

export type SelectedImage = { uri: string; width: number; height: number; marks?: { x: number; y: number }[] };

type Props = {
  body: string;
  images: SelectedImage[];
  onBodyChange: (value: string) => void;
  onImagesChange: (value: SelectedImage[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  authorName?: string;
  authorAvatar?: string;
};

export const CreatePostComposer: React.FC<Props> = ({ body, images, onBodyChange, onImagesChange, onSubmit, onCancel, submitLabel, authorName, authorAvatar }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);

  const chooseImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 50 - images.length),
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const picked = result.assets.filter((asset) => asset.base64 && asset.mimeType).map((asset) => ({
      uri: `data:${asset.mimeType};base64,${asset.base64}`,
      width: asset.width || 1,
      height: asset.height || 1,
    }));
    onImagesChange([...images, ...picked].slice(0, 50));
  };

  const removeImage = (index: number) => onImagesChange(images.filter((_, imageIndex) => imageIndex !== index));

  const editImage = async (action: "rotate" | "crop" | "scale") => {
    if (editingIndex === null) return;
    const image = images[editingIndex];
    const actions: ImageManipulator.Action[] = action === "rotate"
      ? [{ rotate: 90 }]
      : action === "crop"
        ? [{ crop: { originX: 0, originY: 0, width: Math.min(image.width, image.height), height: Math.min(image.width, image.height) } }]
        : [{ resize: { width: Math.max(320, Math.round(image.width * 0.75)) } }];
    try {
      const result = await ImageManipulator.manipulateAsync(image.uri, actions, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!result.base64) throw new Error("The edited image could not be encoded.");
      const updated = [...images];
      updated[editingIndex] = { uri: `data:image/jpeg;base64,${result.base64}`, width: result.width, height: result.height, marks: image.marks };
      onImagesChange(updated);
    } catch (error: any) {
      Alert.alert("Could not edit image", error.message);
    }
  };

  const addMark = (event: any) => {
    if (editingIndex === null || !annotationMode) return;
    const { locationX, locationY } = event.nativeEvent;
    const updated = [...images];
    updated[editingIndex] = { ...updated[editingIndex], marks: [...(updated[editingIndex].marks || []), { x: locationX, y: locationY }] };
    onImagesChange(updated);
  };

  return <View style={styles.composer}>
    <Text style={styles.title}>Create post</Text>
    <View style={styles.author}><Image source={{ uri: authorAvatar }} style={styles.avatar} /><Text style={styles.authorName}>{authorName}</Text></View>
    <TextInput value={body} onChangeText={onBodyChange} multiline placeholder="What's on your mind?" placeholderTextColor={AppColors.placeholder} style={styles.input} />
    {images.length > 0 && <View style={styles.grid}>{images.map((image, index) => <View key={`${image.uri.slice(0, 20)}-${index}`} style={[styles.tile, images.length === 1 && styles.singleTile, images.length === 2 && styles.doubleTile]}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => { setEditingIndex(index); setAnnotationMode(false); }} onPressIn={addMark} style={styles.imageTouch}>
        <Image source={{ uri: image.uri }} style={styles.image} resizeMode="cover" />
        {image.marks?.map((mark, markIndex) => <View key={markIndex} style={[styles.mark, { left: mark.x - 7, top: mark.y - 7 }]} />)}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => removeImage(index)} style={styles.remove}><Text style={styles.removeText}>X</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => { setEditingIndex(index); setAnnotationMode(false); }} style={styles.edit}><Text style={styles.editText}>Edit</Text></TouchableOpacity>
      {index === 3 && images.length > 4 && <View style={styles.more}><Text style={styles.moreText}>+{images.length - 4}</Text></View>}
    </View>)}</View>}
    <View style={styles.actions}><TouchableOpacity onPress={chooseImages} style={styles.photoButton}><Text style={styles.photoText}>Add photos ({images.length}/50)</Text></TouchableOpacity><TouchableOpacity onPress={onCancel}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={onSubmit} style={styles.submit}><Text style={styles.submitText}>{submitLabel}</Text></TouchableOpacity></View>
    <Modal visible={editingIndex !== null} transparent animationType="slide" onRequestClose={() => setEditingIndex(null)}><View style={styles.backdrop}><View style={styles.editor}><Text style={styles.title}>Edit photo</Text>{editingIndex !== null && <TouchableOpacity onPress={addMark} activeOpacity={1} style={styles.editorImage}><Image source={{ uri: images[editingIndex].uri }} style={styles.editorImageInner} resizeMode="contain" />{images[editingIndex].marks?.map((mark, markIndex) => <View key={markIndex} style={[styles.mark, { left: mark.x - 7, top: mark.y - 7 }]} />)}</TouchableOpacity>}<View style={styles.editorActions}><TouchableOpacity onPress={() => editImage("crop")}><Text style={styles.tool}>Crop</Text></TouchableOpacity><TouchableOpacity onPress={() => editImage("rotate")}><Text style={styles.tool}>Rotate</Text></TouchableOpacity><TouchableOpacity onPress={() => editImage("scale")}><Text style={styles.tool}>Scale</Text></TouchableOpacity><TouchableOpacity onPress={() => setAnnotationMode(!annotationMode)}><Text style={[styles.tool, annotationMode && styles.activeTool]}>Draw</Text></TouchableOpacity></View><TouchableOpacity onPress={() => setEditingIndex(null)} style={styles.submit}><Text style={styles.submitText}>Done</Text></TouchableOpacity></View></View></Modal>
  </View>;
};

const styles = StyleSheet.create({
  composer: { backgroundColor: AppColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, minHeight: 430 }, title: { color: AppColors.primaryDark, fontSize: 20, fontWeight: "700", marginBottom: 14 }, author: { flexDirection: "row", alignItems: "center" }, avatar: { width: 38, height: 38, borderRadius: 19, marginRight: 9 }, authorName: { color: AppColors.primaryDark, fontWeight: "700" }, input: { backgroundColor: AppColors.white, color: AppColors.inputText, borderRadius: 14, minHeight: 90, padding: 14, textAlignVertical: "top", marginTop: 16 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 10 }, tile: { width: "32.3%", aspectRatio: 1, position: "relative", overflow: "hidden", borderRadius: 8 }, singleTile: { width: "100%", aspectRatio: 1.35 }, doubleTile: { width: "49.3%", aspectRatio: 1 }, imageTouch: { flex: 1 }, image: { width: "100%", height: "100%" }, remove: { position: "absolute", right: 5, top: 5, width: 25, height: 25, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" }, removeText: { color: AppColors.white, fontWeight: "800" }, edit: { position: "absolute", left: 5, bottom: 5, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }, editText: { color: AppColors.white, fontSize: 12, fontWeight: "700" }, more: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }, moreText: { color: AppColors.white, fontSize: 22, fontWeight: "800" }, mark: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: "#ef4444", borderWidth: 2, borderColor: AppColors.white }, actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }, photoButton: { backgroundColor: AppColors.whiteSoft, borderRadius: 12, padding: 10 }, photoText: { color: AppColors.primaryDark, fontWeight: "700" }, cancel: { color: AppColors.textMuted, fontWeight: "700", padding: 10 }, submit: { backgroundColor: AppColors.buttonInner, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" }, submitText: { color: AppColors.white, fontWeight: "700" }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }, editor: { backgroundColor: AppColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 }, editorImage: { height: 300, backgroundColor: "#111", overflow: "hidden", position: "relative" }, editorImageInner: { width: "100%", height: "100%" }, editorActions: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 18 }, tool: { color: AppColors.primaryDark, fontWeight: "700" }, activeTool: { color: AppColors.buttonInner },
});