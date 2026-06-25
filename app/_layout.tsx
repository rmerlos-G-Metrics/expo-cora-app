import InitialScreen from "@/components/InitialScreen";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getStoredTokens } from "@/services/auth";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimation, setShowAnimation] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        const { refreshToken } = await getStoredTokens();
        if (refreshToken) {
          setIsLoggedIn(true);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  if (showAnimation) {
    return (
      <InitialScreen onAnimationComplete={() => setShowAnimation(false)} />
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="home" />
      </Stack>
      {isLoggedIn ? <Redirect href="/home" /> : <Redirect href="/login" />}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
