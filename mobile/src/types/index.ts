export interface User {
  _id: number | string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  role?: "user" | "admin";
  isPartner?: boolean;
  createdAt: string;
  online?: boolean;
}

export interface Message {
  _id: number | string;
  clientMessageId?: string;
  chat: number | string;
  text: string;
  displayText?: string;
  createdAt: string;
  status?: "pending" | "sent" | "failed";
  pinned?: boolean;
  replyTo?: { _id: number | string; text: string; senderName: string } | null;
  sender: {
    _id: number | string;
    name: string;
    avatar: string;
  };
}

export interface Chat {
  _id: number | string;
  participant: User | null;
  lastMessage?: {
    _id: number | string;
    text: string;
    createdAt: string;
  } | null;
  lastMessageAt: string;
  createdAt: string;
  unreadCount?: number;
  isNew?: boolean;
  pinned?: boolean;
  muted?: boolean;
}

export interface ChatRequest {
  _id: number | string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  sender: User;
}

export type FriendStatus = "none" | "pending_sent" | "pending_received" | "friends" | "blocked";
export interface FriendRelationship {
  status: FriendStatus;
  requestId?: number | string;
}
export interface IncomingFriendRequest extends User {
  requestId: number | string;
}

export interface Post {
  _id: number | string;
  body: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  createdAt: string;
  updatedAt?: string;
  author: User;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  isOwner: boolean;
}

export interface PostComment {
  _id: number | string;
  body: string;
  parentCommentId?: number | string | null;
  createdAt: string;
  author: Pick<User, "_id" | "name" | "avatar">;
}

export interface PostCommentsResponse {
  comments: PostComment[];
  hasMore: boolean;
}

export type NotificationType = "FRIEND_REQ" | "FRIEND_ACCEPT" | "COMMENT" | "LIKE";
export interface AppNotification {
  _id: number | string;
  type: NotificationType;
  entityId: number | string;
  message: string;
  isRead: boolean;
  createdAt: string;
  sender: Pick<User, "_id" | "name" | "avatar">;
}

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ChatList: undefined;
  ChatRoom: { chatId: string | number; participant: Pick<User, "_id" | "name" | "avatar"> };
  Profile: { userId?: number | string; online?: boolean } | undefined;
  Freedom: { openComposer?: boolean; highlightPostId?: number | string } | undefined;
  Post: { postId: number | string };
  Notifications: undefined;
  CropProfilePicture: { uri: string; width: number; height: number };
  AdminDashboard: undefined;
};