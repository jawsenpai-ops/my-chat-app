import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { ChatListScreen } from "./src/screens/ChatListScreen";
import { ChatRoomScreen } from "./src/screens/ChatRoomScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { CropProfilePictureScreen } from "./src/screens/CropProfilePictureScreen";
import { FreedomScreen } from "./src/screens/FreedomScreen";
import { AdminDashboardScreen } from "./src/screens/AdminDashboardScreen";
import { PixelHourglassLoader } from "./src/components/PixelHourglassLoader";
import { RootStackParamList } from "./src/types";
import { SafeAreaProvider } from "react-native-safe-area-context";

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PixelHourglassLoader />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="ChatList" component={ChatListScreen} />
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
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}