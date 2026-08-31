import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";

export type ThemeName = "default" | "layered";

export type ThemePalette = {
  background: string;
  layer1: string;
  layer2: string;
  panel: string;
  panelBorder: string;
  text: string;
  textMuted: string;
  input: string;
  inputPlaceholder: string;
  buttonOuter: string;
  buttonInner: string;
  buttonText: string;
  icon: string;
};

export const themePalettes: Record<ThemeName, ThemePalette> = {
  default: {
    background: "#9d85b6",
    layer1: "#9d85b6",
    layer2: "#9d85b6",
    panel: "rgba(255,255,255,0.18)",
    panelBorder: "rgba(255,255,255,0.25)",
    text: "#263A47",
    textMuted: "#465866",
    input: "rgba(255,255,255,0.75)",
    inputPlaceholder: "#7b8790",
    buttonOuter: "#263A47",
    buttonInner: "#6d8190",
    buttonText: "#FFFFFF",
    icon: "#263A47",
  },
  layered: {
    background: "#DCEAF7",
    layer1: "#DCEAF7",
    layer2: "#142A44",
    panel: "rgba(255,255,255,0.18)",
    panelBorder: "rgba(255,255,255,0.30)",
    text: "#142A44",
    textMuted: "#3c4e66",
    input: "rgba(255,255,255,0.65)",
    inputPlaceholder: "#4b5b73",
    buttonOuter: "#cf9892",
    buttonInner: "#6968a6",
    buttonText: "#FFFFFF",
    icon: "#1E2D3B",
  },
};

type ThemeContextValue = {
  themeName: ThemeName;
  theme: ThemePalette;
  isLayered: boolean;
  toggleTheme: () => void;
  spinValue: Animated.Value;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeName>("default");
  const spinValue = useRef(new Animated.Value(0)).current;

  const toggleTheme = () => {
    const nextTheme = themeName === "default" ? "layered" : "default";
    setThemeName(nextTheme);

    Animated.timing(spinValue, {
      toValue: nextTheme === "layered" ? 1 : 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const value = useMemo(
    () => ({
      themeName,
      theme: themePalettes[themeName],
      isLayered: themeName === "layered",
      toggleTheme,
      spinValue,
    }),
    [themeName, spinValue]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
