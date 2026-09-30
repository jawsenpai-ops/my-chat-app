import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Chat, Message } from "../types";

const MAX_CACHED_CHATS = 100;
const MAX_CACHED_MESSAGES = 500;

const chatsKey = (userId: string) => `chat-cache:v1:${encodeURIComponent(userId)}:chats`;
const messagesKey = (userId: string, chatId: string) => `chat-cache:v1:${encodeURIComponent(userId)}:${encodeURIComponent(chatId)}:messages`;

async function readArray<T>(key: string): Promise<T[]> {
  try {
    const value = await AsyncStorage.getItem(key);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export const readCachedChats = (userId: string) => readArray<Chat>(chatsKey(userId));

export async function saveCachedChats(userId: string, chats: Chat[]) {
  try {
    await AsyncStorage.setItem(chatsKey(userId), JSON.stringify(chats.slice(0, MAX_CACHED_CHATS)));
  } catch (error) {
    console.warn("Unable to save offline chats", error);
  }
}

export const readCachedMessages = (userId: string, chatId: string) => readArray<Message>(messagesKey(userId, chatId));

export async function saveCachedMessages(userId: string, chatId: string, messages: Message[]) {
  try {
    const confirmedMessages = messages.filter((message) => message.status !== "pending" && message.status !== "failed");
    await AsyncStorage.setItem(messagesKey(userId, chatId), JSON.stringify(confirmedMessages.slice(-MAX_CACHED_MESSAGES)));
  } catch (error) {
    console.warn("Unable to save offline messages", error);
  }
}

export function mergeMessages(existing: Message[], incoming: Message[]) {
  const messagesById = new Map<string, Message>();
  const identityKeys = new Map<string, string>();

  const addMessage = (message: Message) => {
    const messageId = message._id ?? (message as any).id;
    const clientId = message.clientMessageId;
    const clientKey = clientId !== undefined && clientId !== null ? `client:${clientId}` : null;
    const serverKey = messageId !== undefined && messageId !== null ? `server:${messageId}` : null;
    const key = (clientKey && identityKeys.get(clientKey))
      || (serverKey && identityKeys.get(serverKey))
      || clientKey
      || serverKey
      || `fallback:${message.text}:${message.createdAt}:${message.sender?._id ?? ""}`;
    const previous = messagesById.get(key);
    const merged = {
      ...previous,
      ...message,
      status: message.status ?? (previous?.status === "pending" ? "sent" : previous?.status),
    };
    messagesById.set(key, merged);
    if (clientKey) identityKeys.set(clientKey, key);
    if (serverKey) identityKeys.set(serverKey, key);
  };

  for (const message of existing) addMessage(message);
  for (const message of incoming) addMessage(message);

  return [...messagesById.values()].sort((first, second) =>
    new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  ).slice(-MAX_CACHED_MESSAGES);
}