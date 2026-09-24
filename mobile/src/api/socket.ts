import { io, Socket } from "socket.io-client";
import { getAccessToken, getGatewayOrigin, initializeApi } from "./client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(getGatewayOrigin(), {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
};

export const connectSocket = async () => {
  await initializeApi();
  const token = await getAccessToken();
  const s = getSocket();
  if (token) {
    s.auth = { token };
    if (!s.connected) {
      s.connect();
    }
  }
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};