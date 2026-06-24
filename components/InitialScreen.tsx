import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export default function InitialScreen({ onAnimationComplete }) {
  const logoScale = useSharedValue(1);

  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1200 }),
        withTiming(1, { duration: 1200 }),
      ),
      -1, // loop indefinitely
      true,
    );

    const timer = setTimeout(() => {
      onAnimationComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.centerContainer}>
        <Animated.Image
          source={require("@/assets/images/CORA_Logo_v1.png")}
          style={[styles.coraLogo, logoStyle]}
          resizeMode="contain"
        />
        <View style={styles.footerContainer}>
          <Text style={styles.developedByText}>Developed by</Text>
          <Animated.Image
            source={require("@/assets/images/G-Metrics-logo.png")}
            style={styles.gMetricsLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dedeee",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  coraLogo: {
    width: 300,
    height: 300,
  },
  developedByText: {
    fontSize: 24,
    color: "#463e4b",
    fontWeight: "500",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  gMetricsLogo: {
    width: 150,
    height: 170,
  },
});
