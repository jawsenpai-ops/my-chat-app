import AsyncStorage from "@react-native-async-storage/async-storage";

// Cloud hosted domain URL
export const BASE_URL = "https://api.ikiyadm.com";

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem("jwt_token");
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

  const responseText = await response.text();
  let data: { message?: string } | T;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`Server returned an invalid response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Network error");
  }

  return data as T;
}