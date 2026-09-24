import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { apiCall, clearAccessToken, getAccessToken, initializeApi, setAccessToken } from "../api/client";
import { connectSocket, disconnectSocket } from "../api/socket";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await initializeApi();
        const token = await getAccessToken();
        if (token) {
          const userData = await apiCall<User>("/auth/me");
          setUser(userData);
          await connectSocket();
        }
      } catch (err) {
        await clearAccessToken();
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (token: string, newUser: User) => {
    await setAccessToken(token);
    setUser(newUser);
    await connectSocket();
  };

  const logout = async () => {
    await clearAccessToken();
    setUser(null);
    disconnectSocket();
  };

  const updateUser = (updatedUser: User) => setUser(updatedUser);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};