import { createNavigationContainerRef, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { ChatListScreen } from "./src/screens/ChatListScreen";
import { ChatRoomScreen } from "./src/screens/ChatRoomScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { CropProfilePictureScreen } from "./src/screens/CropProfilePictureScreen";
import { FreedomScreen } from "./src/screens/FreedomScreen";
import { AdminDashboardScreen } from "./src/screens/AdminDashboardScreen";
import { NotificationScreen } from "./src/screens/NotificationScreen";
import { PixelHourglassLoader } from "./src/components/PixelHourglassLoader";
import { RootStackParamList } from "./src/types";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ChatNotificationTarget, getChatTargetFromNotification, requestPushPermissionsAndGetToken } from "./src/api/pushNotificationService";

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const AppNavigator: React.FC<{ pendingChat: ChatNotificationTarget | null; clearPendingChat: () => void }> = ({ pendingChat, clearPendingChat }) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading && pendingChat && navigationRef.isReady()) {
      navigationRef.navigate("ChatRoom", pendingChat);
      clearPendingChat();
    }
  }, [user, loading, pendingChat, clearPendingChat]);

  if (loading) {
    return <PixelHourglassLoader />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="ChatList" component={ChatListScreen} />
          <Stack.Screen name="Notifications" component={NotificationScreen} />
          <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Freedom" component={FreedomScreen} />
          <Stack.Screen name="CropProfilePicture" component={CropProfilePictureScreen} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  const [pendingChat, setPendingChat] = useState<ChatNotificationTarget | null>(null);

  useEffect(() => {
    void requestPushPermissionsAndGetToken().catch((error) => console.warn("Push permission setup failed", error));
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const target = getChatTargetFromNotification(response);
      if (target) setPendingChat(target);
      void Notifications.clearLastNotificationResponseAsync();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator pendingChat={pendingChat} clearPendingChat={() => setPendingChat(null)} />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}