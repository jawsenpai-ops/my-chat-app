import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const bootstrapOrigin = String(Constants.expoConfig?.extra?.gatewayOrigin || "").replace(/\/$/, "");
const bootstrapPath = "/api/v1/config/client-init";
let gatewayBaseUrl: string | null = null;
let initialization: Promise<void> | null = null;

const joinUrl = (origin: string, path: string) => `${origin.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;

export async function initializeApi() {
  if (gatewayBaseUrl) return;
  if (!bootstrapOrigin) throw new Error("The native API gateway origin is not configured.");
  if (!initialization) {
    initialization = fetch(joinUrl(bootstrapOrigin, bootstrapPath), { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to initialize the API connection.");
        const config = await response.json() as { gatewayPath?: string; protocolVersion?: number };
        if (config.protocolVersion !== 1 || typeof config.gatewayPath !== "string" || !/^\/[a-zA-Z0-9/_-]+$/.test(config.gatewayPath)) {
          throw new Error("The API returned an invalid client configuration.");
        }
        gatewayBaseUrl = joinUrl(bootstrapOrigin, config.gatewayPath);
      })
      .catch((error) => {
        initialization = null;
        throw error;
      });
  }
  await initialization;
}

export const getGatewayBaseUrl = () => {
  if (!gatewayBaseUrl) throw new Error("The API client has not been initialized.");
  return gatewayBaseUrl;
};

export const getGatewayOrigin = () => bootstrapOrigin;

export const getAccessToken = () => SecureStore.getItemAsync("jwt_token");
export const setAccessToken = (token: string) => SecureStore.setItemAsync("jwt_token", token);
export const clearAccessToken = () => SecureStore.deleteItemAsync("jwt_token");

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  await initializeApi();
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(joinUrl(getGatewayBaseUrl(), endpoint), {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Unable to reach the API. Check your network connection and try again.");
  }

  const responseText = await response.text();
  let data: { message?: string } | T;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`Server returned an invalid response (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Network error");
  }

  return data as T;
}