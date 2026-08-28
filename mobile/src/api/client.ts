import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Android Emulator အတွက် 10.0.2.2 သုံးပါ။
// ဖုန်းအစစ်ဖြင့် စမ်းပါက ကွန်ပျူတာ၏ Wi-Fi IP (ဥပမာ http://192.168.1.5:3000) ဟု ပြောင်းပေးပါ။
export const BASE_URL = "https://api.ikiyadm.com";
export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {  const token = await AsyncStorage.getItem("jwt_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Network error");
  }

  return data as T;
}