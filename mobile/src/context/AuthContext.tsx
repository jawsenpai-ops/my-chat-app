import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "../types";
import { apiCall } from "../api/client";
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
        const token = await AsyncStorage.getItem("jwt_token");
        if (token) {
          const userData = await apiCall<User>("/auth/me");
          setUser(userData);
          await connectSocket();
        }
      } catch (err) {
        await AsyncStorage.removeItem("jwt_token");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (token: string, newUser: User) => {
    await AsyncStorage.setItem("jwt_token", token);
    setUser(newUser);
    await connectSocket();
  };

  const logout = async () => {
    await AsyncStorage.removeItem("jwt_token");
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