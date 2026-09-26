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
    await AsyncStorage.setItem(messagesKey(userId, chatId), JSON.stringify(messages.slice(-MAX_CACHED_MESSAGES)));
  } catch (error) {
    console.warn("Unable to save offline messages", error);
  }
}

export function mergeMessages(existing: Message[], incoming: Message[]) {
  const messagesById = new Map<string, Message>();
  for (const message of existing) {
    const key = message.clientMessageId ? `client:${message.clientMessageId}` : `message:${message._id}`;
    messagesById.set(key, message);
  }
  for (const message of incoming) {
    const key = message.clientMessageId ? `client:${message.clientMessageId}` : `message:${message._id}`;
    const previous = messagesById.get(key);
    messagesById.set(key, {
      ...previous,
      ...message,
      status: message.status ?? (previous?.status === "pending" ? "sent" : previous?.status),
    });
  }
  return [...messagesById.values()].sort((first, second) =>
    new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  ).slice(-MAX_CACHED_MESSAGES);
}