import React, { useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Alert, Dimensions, Image, Modal, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AppColors } from "../theme/colors";

export type SelectedImage = { uri: string; width: number; height: number; strokes?: { x: number; y: number }[][] };

type Point = { x: number; y: number };
type CropBox = { x: number; y: number; width: number; height: number };
type CropCorner = "tl" | "tr" | "bl" | "br";

const EDITOR_IMAGE_HEIGHT = 300;
const HANDLE_HIT = 36;
const MIN_CROP = 64;
const STROKE_WIDTH = 5;

/* Renders a free-hand stroke as rotated segments between sampled points. */
const Stroke: React.FC<{ points: Point[]; color?: string }> = ({ points, color = "#ef4444" }) => {
  if (points.length === 1) {
    const p = points[0];
    return <View style={{ position: "absolute", left: p.x - STROKE_WIDTH / 2, top: p.y - STROKE_WIDTH / 2, width: STROKE_WIDTH, height: STROKE_WIDTH, borderRadius: STROKE_WIDTH / 2, backgroundColor: color }} />;
  }
  const segments: React.ReactElement[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;
    const angle = Math.atan2(dy, dx);
    segments.push(
      <View
        key={`seg-${i}`}
        style={{
          position: "absolute",
          left: a.x,
          top: a.y,
          width: dist,
          height: STROKE_WIDTH,
          borderRadius: STROKE_WIDTH / 2,
          backgroundColor: color,
          transform: [{ translateY: -STROKE_WIDTH / 2 }, { rotate: `${angle}rad` }],
        }}
      />,
    );
  }
  return <>{segments}</>;
};

type PhotoEditorProps = {
  image: SelectedImage;
  onDone: (updated: SelectedImage) => void;
  onClose: () => void;
};

const PhotoEditorModal: React.FC<PhotoEditorProps> = ({ image, onDone, onClose }) => {
  const containerW = Math.max(200, Dimensions.get("window").width - 40);
  const aspect = image.width > 8 && image.height > 8 ? image.width / image.height : 1;
  const dispH = aspect > containerW / EDITOR_IMAGE_HEIGHT ? containerW / aspect : EDITOR_IMAGE_HEIGHT;
  const dispW = dispH * aspect;
  const offsetX = (containerW - dispW) / 2;
  const offsetY = (EDITOR_IMAGE_HEIGHT - dispH) / 2;

  const [, setTick] = useState(0);
  const render = () => setTick((t) => t + 1);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"none" | "draw" | "crop">("none");

  const modeRef = useRef<"none" | "draw" | "crop">("none");
  const strokesRef = useRef<Point[][]>(image.strokes ? image.strokes.map((s) => [...s]) : []);
  const activeStrokeRef = useRef<Point[] | null>(null);
  const cropRef = useRef<CropBox>({ x: 0, y: 0, width: dispW, height: dispH });
  const gestureRef = useRef<null | { type: "draw" } | { type: "move"; dx: number; dy: number } | { type: "resize"; corner: CropCorner }>(null);

  const setModeBoth = (next: "none" | "draw" | "crop") => {
    modeRef.current = next;
    setMode(next);
    if (next === "crop") cropRef.current = { x: 0, y: 0, width: dispW, height: dispH };
    render();
  };

  const clampPoint = (x: number, y: number): Point => ({ x: Math.min(Math.max(x, 0), dispW), y: Math.min(Math.max(y, 0), dispH) });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => modeRef.current !== "none",
      onMoveShouldSetPanResponder: () => modeRef.current !== "none",
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (modeRef.current === "draw") {
          activeStrokeRef.current = [clampPoint(locationX - offsetX, locationY - offsetY)];
          gestureRef.current = { type: "draw" };
          render();
        } else if (modeRef.current === "crop") {
          const b = cropRef.current;
          const hit = (px: number, py: number) => Math.abs(locationX - px) <= HANDLE_HIT && Math.abs(locationY - py) <= HANDLE_HIT;
          let corner: CropCorner | null = null;
          if (hit(offsetX + b.x, offsetY + b.y)) corner = "tl";
          else if (hit(offsetX + b.x + b.width, offsetY + b.y)) corner = "tr";
          else if (hit(offsetX + b.x, offsetY + b.y + b.height)) corner = "bl";
          else if (hit(offsetX + b.x + b.width, offsetY + b.y + b.height)) corner = "br";
          if (corner) {
            gestureRef.current = { type: "resize", corner };
          } else if (locationX >= offsetX + b.x && locationX <= offsetX + b.x + b.width && locationY >= offsetY + b.y && locationY <= offsetY + b.y + b.height) {
            gestureRef.current = { type: "move", dx: locationX - (offsetX + b.x), dy: locationY - (offsetY + b.y) };
          }
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const gesture = gestureRef.current;
        if (!gesture) return;
        if (gesture.type === "draw") {
          const p = clampPoint(locationX - offsetX, locationY - offsetY);
          const stroke = activeStrokeRef.current;
          if (stroke) {
            const last = stroke[stroke.length - 1];
            if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2) {
              stroke.push(p);
              render();
            }
          }
        } else if (gesture.type === "move") {
          const b = cropRef.current;
          b.x = Math.min(Math.max(locationX - offsetX - gesture.dx, 0), dispW - b.width);
          b.y = Math.min(Math.max(locationY - offsetY - gesture.dy, 0), dispH - b.height);
          render();
        } else if (gesture.type === "resize") {
          const b = cropRef.current;
          const ix = clampPoint(locationX - offsetX, locationY - offsetY);
          let x1 = b.x;
          let y1 = b.y;
          let x2 = b.x + b.width;
          let y2 = b.y + b.height;
          if (gesture.corner === "tl") { x1 = Math.min(ix.x, x2 - MIN_CROP); y1 = Math.min(ix.y, y2 - MIN_CROP); }
          if (gesture.corner === "tr") { x2 = Math.max(ix.x, x1 + MIN_CROP); y1 = Math.min(ix.y, y2 - MIN_CROP); }
          if (gesture.corner === "bl") { x1 = Math.min(ix.x, x2 - MIN_CROP); y2 = Math.max(ix.y, y1 + MIN_CROP); }
          if (gesture.corner === "br") { x2 = Math.max(ix.x, x1 + MIN_CROP); y2 = Math.max(ix.y, y1 + MIN_CROP); }
          x1 = Math.max(0, x1);
          y1 = Math.max(0, y1);
          x2 = Math.min(dispW, x2);
          y2 = Math.min(dispH, y2);
          cropRef.current = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
          render();
        }
      },
      onPanResponderRelease: () => {
        if (gestureRef.current?.type === "draw" && activeStrokeRef.current && activeStrokeRef.current.length > 0) {
          strokesRef.current.push(activeStrokeRef.current);
          activeStrokeRef.current = null;
          render();
        }
        gestureRef.current = null;
      },
      onPanResponderTerminate: () => {
        if (gestureRef.current?.type === "draw" && activeStrokeRef.current && activeStrokeRef.current.length > 0) {
          strokesRef.current.push(activeStrokeRef.current);
          activeStrokeRef.current = null;
          render();
        }
        gestureRef.current = null;
      },
    }),
  ).current;

  const manipulate = async (actions: ImageManipulator.Action[], extra: { resetStrokes: boolean }) => {
    setBusy(true);
    try {
      const result = await ImageManipulator.manipulateAsync(image.uri, actions, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!result.base64) throw new Error("The edited image could not be encoded.");
      onDone({ uri: `data:image/jpeg;base64,${result.base64}`, width: result.width, height: result.height, strokes: extra.resetStrokes ? [] : strokesRef.current });
    } catch (error: any) {
      Alert.alert("Could not edit image", error.message);
    } finally {
      setBusy(false);
    }
  };

  const applyCrop = () => {
    const b = cropRef.current;
    if (b.width >= dispW - 2 && b.height >= dispH - 2) return;
    const sx = image.width / dispW;
    const sy = image.height / dispH;
    const crop = {
      originX: Math.round(b.x * sx),
      originY: Math.round(b.y * sy),
      width: Math.max(1, Math.round(b.width * sx)),
      height: Math.max(1, Math.round(b.height * sy)),
    };
    manipulate([{ crop }], { resetStrokes: true });
  };

  const rotateImage = () => manipulate([{ rotate: 90 }], { resetStrokes: true });

  const commit = () => {
    if (modeRef.current === "crop") {
      applyCrop();
      return;
    }
    onDone({ ...image, strokes: strokesRef.current });
  };

  const b = cropRef.current;

  return (
    <View style={styles.editor}>
      <Text style={styles.title}>Edit photo</Text>
      <View style={[styles.editorImage, { width: containerW }]}>
        <Image source={{ uri: image.uri }} style={{ width: containerW, height: EDITOR_IMAGE_HEIGHT }} resizeMode="contain" />
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          {mode === "crop" && (
            <>
              <View pointerEvents="none" style={[styles.dim, { left: 0, top: 0, right: 0, height: Math.max(0, offsetY + b.y) }]} />
              <View pointerEvents="none" style={[styles.dim, { left: 0, right: 0, bottom: 0, top: offsetY + b.y + b.height }]} />
              <View pointerEvents="none" style={[styles.dim, { left: 0, width: Math.max(0, offsetX + b.x), top: offsetY + b.y, height: b.height }]} />
              <View pointerEvents="none" style={[styles.dim, { right: 0, left: offsetX + b.x + b.width, top: offsetY + b.y, height: b.height }]} />
              <View pointerEvents="none" style={{ position: "absolute", left: offsetX + b.x, top: offsetY + b.y, width: b.width, height: b.height, borderWidth: 2, borderColor: "#ffffff", borderStyle: "dashed" }} />
              {(["tl", "tr", "bl", "br"] as CropCorner[]).map((corner) => (
                <View
                  key={corner}
                  pointerEvents="none"
                  style={[
                    styles.handle,
                    {
                      left: offsetX + b.x + (corner === "tr" || corner === "br" ? b.width - 9 : -9),
                      top: offsetY + b.y + (corner === "bl" || corner === "br" ? b.height - 9 : -9),
                    },
                  ]}
                />
              ))}
            </>
          )}
          {strokesRef.current.map((points: Point[], index: number) => (
            <View key={`stroke-${index}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Stroke points={points} />
            </View>
          ))}
          {activeStrokeRef.current && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Stroke points={activeStrokeRef.current} />
            </View>
          )}
        </View>
      </View>
      <View style={styles.editorActions}>
        <TouchableOpacity onPress={() => setModeBoth(modeRef.current === "crop" ? "none" : "crop")} disabled={busy}>
          <Text style={[styles.tool, mode === "crop" && styles.activeTool]}>Crop</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setModeBoth(modeRef.current === "draw" ? "none" : "draw")} disabled={busy}>
          <Text style={[styles.tool, mode === "draw" && styles.activeTool]}>Draw</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={rotateImage} disabled={busy}>
          <Text style={styles.tool}>Rotate</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { strokesRef.current = []; render(); }} disabled={busy}>
          <Text style={styles.tool}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.editorFooter}>
        <TouchableOpacity onPress={onClose} disabled={busy}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={commit} disabled={busy} style={styles.submit}>
          <Text style={styles.submitText}>{busy ? "Working..." : mode === "crop" ? "Apply Crop" : "Done"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
  lockImages?: boolean;
};

export const CreatePostComposer: React.FC<Props> = ({ body, images, onBodyChange, onImagesChange, onSubmit, onCancel, submitLabel, authorName, authorAvatar, lockImages = false }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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

  const updateImage = (index: number, updated: SelectedImage) => {
    const updatedImages = [...images];
    updatedImages[index] = updated;
    onImagesChange(updatedImages);
  };

  return <View style={styles.composer}>
    <Text style={styles.title}>{lockImages ? "Edit post" : "Create post"}</Text>
    <View style={styles.author}><Image source={{ uri: authorAvatar }} style={styles.avatar} /><Text style={styles.authorName}>{authorName}</Text></View>
    <TextInput value={body} onChangeText={onBodyChange} multiline placeholder="How's going?" placeholderTextColor={AppColors.placeholder} style={styles.input} />
    {images.length > 0 && <View style={styles.grid}>{images.map((image, index) => <View key={`${image.uri.slice(0, 20)}-${index}`} style={[styles.tile, images.length === 1 && styles.singleTile, images.length === 2 && styles.doubleTile]}>
      <TouchableOpacity activeOpacity={0.9} disabled={lockImages} onPress={() => setEditingIndex(index)} style={styles.imageTouch}>
        <Image source={{ uri: image.uri }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
      {!lockImages && <TouchableOpacity onPress={() => removeImage(index)} style={styles.remove}><Text style={styles.removeText}>X</Text></TouchableOpacity>}
      {!lockImages && <TouchableOpacity onPress={() => setEditingIndex(index)} style={styles.edit}><Text style={styles.editText}>Edit</Text></TouchableOpacity>}
      {index === 3 && images.length > 4 && <View style={styles.more}><Text style={styles.moreText}>+{images.length - 4}</Text></View>}
    </View>)}</View>}
    <View style={styles.actions}>{!lockImages && <TouchableOpacity onPress={chooseImages} style={styles.photoButton}><Text style={styles.photoText}>Add photos ({images.length}/50)</Text></TouchableOpacity>}{lockImages && images.length > 0 && <View style={styles.photoButton}><Text style={styles.photoText}>Photos locked ({images.length})</Text></View>}<TouchableOpacity onPress={onCancel}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={onSubmit} style={styles.submit}><Text style={styles.submitText}>{submitLabel}</Text></TouchableOpacity></View>
    <Modal visible={editingIndex !== null} transparent animationType="slide" onRequestClose={() => setEditingIndex(null)}>
      <View style={styles.backdrop}>
        {editingIndex !== null && images[editingIndex] && (
          <PhotoEditorModal
            image={images[editingIndex]}
            onDone={(updated) => { updateImage(editingIndex, updated); setEditingIndex(null); }}
            onClose={() => setEditingIndex(null)}
          />
        )}
      </View>
    </Modal>
  </View>;
};

const styles = StyleSheet.create({
  composer: { backgroundColor: AppColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, minHeight: 430 }, title: { color: AppColors.primaryDark, fontSize: 20, fontWeight: "700", marginBottom: 14 }, author: { flexDirection: "row", alignItems: "center" }, avatar: { width: 38, height: 38, borderRadius: 19, marginRight: 9 }, authorName: { color: AppColors.primaryDark, fontWeight: "700" }, input: { backgroundColor: AppColors.white, color: AppColors.inputText, borderRadius: 14, minHeight: 90, padding: 14, textAlignVertical: "top", marginTop: 16 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 10 }, tile: { width: "32.3%", aspectRatio: 1, position: "relative", overflow: "hidden", borderRadius: 8 }, singleTile: { width: "100%", aspectRatio: 1.35 }, doubleTile: { width: "49.3%", aspectRatio: 1 }, imageTouch: { flex: 1 }, image: { width: "100%", height: "100%" }, remove: { position: "absolute", right: 5, top: 5, width: 25, height: 25, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" }, removeText: { color: AppColors.white, fontWeight: "800" }, edit: { position: "absolute", left: 5, bottom: 5, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }, editText: { color: AppColors.white, fontSize: 12, fontWeight: "700" }, more: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }, moreText: { color: AppColors.white, fontSize: 22, fontWeight: "800" }, actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }, photoButton: { backgroundColor: AppColors.whiteSoft, borderRadius: 12, padding: 10 }, photoText: { color: AppColors.primaryDark, fontWeight: "700" }, cancel: { color: AppColors.textMuted, fontWeight: "700", padding: 10 }, submit: { backgroundColor: AppColors.buttonInner, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" }, submitText: { color: AppColors.white, fontWeight: "700" }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }, editor: { backgroundColor: AppColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 }, editorImage: { height: EDITOR_IMAGE_HEIGHT, backgroundColor: "#111", overflow: "hidden", position: "relative" }, dim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.55)" }, handle: { position: "absolute", width: 18, height: 18, borderRadius: 4, backgroundColor: "#ffffff", borderWidth: 2, borderColor: AppColors.buttonInner }, editorActions: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 18 }, tool: { color: AppColors.primaryDark, fontWeight: "700" }, activeTool: { color: AppColors.buttonInner }, editorFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});