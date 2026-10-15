import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post, PostComment } from "../types";

const postsKey = "post-feed-cache:v1";
const postKey = (postId: string | number) => `post-cache:v1:${encodeURIComponent(String(postId))}`;
const commentsKey = (postId: string | number) => `post-comments-cache:v1:${encodeURIComponent(String(postId))}`;

const isInlineImage = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.startsWith("data:image/");

function withoutInlineImages(post: Post): Post {
  return {
    ...post,
    imageUrl: isInlineImage(post.imageUrl) ? null : post.imageUrl,
    imageUrls: post.imageUrls?.filter((imageUrl) => !isInlineImage(imageUrl)),
    author: {
      ...post.author,
      avatar: isInlineImage(post.author.avatar) ? "" : post.author.avatar,
    },
  };
}

function isStorageFull(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_FULL|database or disk is full/i.test(message);
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function readCachedPosts(): Promise<Post[]> {
  const value = await readJson<Post[]>(postsKey);
  return Array.isArray(value) ? value : [];
}

export async function saveCachedPosts(posts: Post[]) {
  const serializedPosts = JSON.stringify(posts.slice(0, 200).map(withoutInlineImages));
  try {
    await AsyncStorage.setItem(postsKey, serializedPosts);
  } catch (error) {
    if (!isStorageFull(error)) {
      console.warn("Unable to save offline post feed", error);
      return;
    }

    try {
      await AsyncStorage.removeItem(postsKey);
      await AsyncStorage.setItem(postsKey, serializedPosts);
    } catch (retryError) {
      console.warn("Unable to save offline post feed", retryError);
    }
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
