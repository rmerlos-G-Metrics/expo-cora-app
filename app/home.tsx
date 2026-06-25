import { logoutUser } from "@/services/auth";
import { useRouter } from "expo-router";
import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutUser();
    router.replace("/login");
  };

  return (
    <View>
      <Text style={styles.welcomeText}>Login Successful!</Text>
      <Button title="Log Out" onPress={handleLogout} color="#ea3535"></Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  welcomeText: { fontSize: 22, fontWeight: "bold", marginBottom: 8 },
});
