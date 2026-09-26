import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiCall } from "./client";
import { RootStackParamList } from "../types";

export type ChatNotificationTarget = RootStackParamList["ChatRoom"];
let tokenRequest: Promise<string | null> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getPushToken(): Promise<string | null> {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;

  if (Constants.platform?.android) {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Expo project ID is not configured for push notifications.");
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export function requestPushPermissionsAndGetToken(): Promise<string | null> {
  if (Constants.executionEnvironment === "storeClient") return Promise.resolve(null);
  if (!tokenRequest) {
    tokenRequest = getPushToken().catch((error) => {
      tokenRequest = null;
      throw error;
    });
  }
  return tokenRequest;
}

export async function syncPushTokenWithBackend() {
  const pushToken = await requestPushPermissionsAndGetToken();
  if (!pushToken) return;
  await apiCall("/users/push-token", {
    method: "PUT",
    body: JSON.stringify({ pushToken }),
  });
}

export async function clearPushTokenFromBackend() {
  await apiCall("/users/push-token", { method: "DELETE" });
}

export function getChatTargetFromNotification(response: Notifications.NotificationResponse): ChatNotificationTarget | null {
  const data = response.notification.request.content.data;
  const chatId = data.chatId;
  const senderId = data.senderId;
  if ((typeof chatId !== "string" && typeof chatId !== "number") || (typeof senderId !== "string" && typeof senderId !== "number")) return null;

  return {
    chatId,
    participant: {
      _id: senderId,
      name: typeof data.senderName === "string" ? data.senderName : "Chat",
      avatar: typeof data.senderAvatar === "string" ? data.senderAvatar : "",
    },
  };
}