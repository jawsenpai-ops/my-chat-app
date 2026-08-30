export interface User {
  _id: number | string;
  name: string;
  email: string;
  avatar: string;
}

export interface Message {
  _id: number | string;
  chat: number | string;
  text: string;
  displayText?: string;
  createdAt: string;
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
}

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ChatList: undefined;
  ChatRoom: { chatId: string | number; participant: User };
};