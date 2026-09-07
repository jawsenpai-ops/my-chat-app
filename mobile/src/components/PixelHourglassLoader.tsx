import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const sprite = [
  "  #######  ",
  "   #####   ",
  "    ###    ",
  "     #     ",
  "     #     ",
  "    ###    ",
  "   #####   ",
  "  #######  ",
];

const frameCount = 8;
const frameDuration = 110;

export const PixelHourglassLoader: React.FC = () => {
  const [frame, setFrame] = useState(0);
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const frameTimer = setInterval(() => {
      setFrame((currentFrame) => (currentFrame + 1) % frameCount);
    }, frameDuration);

    const rotationLoop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: frameCount * frameDuration,
        useNativeDriver: true,
      }),
    );
    rotationLoop.start();

    return () => {
      clearInterval(frameTimer);
      rotationLoop.stop();
    };
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.hourglass, { transform: [{ rotate }] }]}>
        {sprite.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {[...row].map((pixel, pixelIndex) => (
              <View
                key={`pixel-${rowIndex}-${pixelIndex}`}
                style={[styles.pixel, pixel === " " ? styles.emptyPixel : undefined]}
              />
            ))}
          </View>
        ))}
        <View style={[styles.sand, { height: 4 + frame * 2 }]} />
      </Animated.View>
      <Text style={styles.label}>LOADING</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1b1b1b",
  },
  hourglass: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    height: 8,
    flexDirection: "row",
  },
  pixel: {
    width: 8,
    height: 8,
    backgroundColor: "#ffffff",
  },
  emptyPixel: {
    opacity: 0,
  },
  sand: {
    position: "absolute",
    width: 12,
    bottom: 23,
    backgroundColor: "#ffffff",
  },
  label: {
    marginTop: 22,
    color: "#ffffff",
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
});