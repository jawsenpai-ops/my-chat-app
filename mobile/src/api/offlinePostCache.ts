import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post, PostComment } from "../types";

const postKey = (postId: string | number) => `post-cache:v1:${encodeURIComponent(String(postId))}`;
const commentsKey = (postId: string | number) => `post-comments-cache:v1:${encodeURIComponent(String(postId))}`;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function readCachedPost(postId: string | number): Promise<Post | null> {
  return readJson<Post>(postKey(postId));
}

export async function saveCachedPost(postId: string | number, post: Post) {
  try {
    await AsyncStorage.setItem(postKey(postId), JSON.stringify(post));
  } catch (error) {
    console.warn("Unable to save offline post", error);
  }
}

export async function readCachedComments(postId: string | number): Promise<PostComment[]> {
  const value = await readJson<PostComment[]>(commentsKey(postId));
  return Array.isArray(value) ? value : [];
}

export async function saveCachedComments(postId: string | number, comments: PostComment[]) {
  try {
    await AsyncStorage.setItem(commentsKey(postId), JSON.stringify(comments));
  } catch (error) {
    console.warn("Unable to save offline post comments", error);
  }
}
