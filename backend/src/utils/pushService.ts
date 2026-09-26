import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { db } from "../config/database";

const expo = new Expo();

export async function sendExpoPush(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  if (!Expo.isExpoPushToken(pushToken)) return;
  const message: ExpoPushMessage = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data,
    channelId: "messages",
  };
  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);
    if (tickets[0]?.status === "error" && tickets[0].details?.error === "DeviceNotRegistered") {
      await db.query("UPDATE users SET pushToken = NULL WHERE pushToken = ?", [pushToken]);
    }
  } catch (error) {
    console.error("Expo push delivery failed", error instanceof Error ? error.message : "Unknown error");
  }
}