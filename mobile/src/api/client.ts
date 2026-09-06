import AsyncStorage from "@react-native-async-storage/async-storage";

export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "https://api.ikiyadm.com").replace(/\/$/, "");

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem("jwt_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(`Unable to reach the API at ${BASE_URL}. Check the server URL and deployment.`);
  }

  const responseText = await response.text();
  let data: { message?: string } | T;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`Server returned an invalid response (${response.status}). Check the API deployment.`);
  }

  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Network error");
  }

  return data as T;
}