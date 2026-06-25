import InitialScreen from "@/components/InitialScreen";
import { getStoredTokens } from "@/services/auth";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function IndexRouteController() {
  const router = useRouter();
  const [showAnimation, setShowAnimation] = useState(true);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  useEffect(() => {
    async function determineSession() {
      try {
        const { refreshToken } = await getStoredTokens();

        if (refreshToken) {
          setTargetRoute("/home");
        } else {
          setTargetRoute("/login");
        }
      } catch (error) {
        setTargetRoute("/login");
      } finally {
        await SplashScreen.hideAsync();
      }
    }

    determineSession();
  }, []);

  const handleAnimationComplete = () => {
    setShowAnimation(false);
    if (targetRoute) {
      router.replace(targetRoute as any);
    }
  };

  if (targetRoute === null) {
    return <View style={styles.container} />;
  }

  if (showAnimation) {
    return (
      <View style={styles.container}>
        <InitialScreen onAnimationComplete={handleAnimationComplete} />
      </View>
    );
  }

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dedeee",
  },
});
