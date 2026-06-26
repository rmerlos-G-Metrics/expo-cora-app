import { registerDeviceAPI } from "@/services/hardware";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function RegisterDeviceScreen() {
  const router = useRouter();
  const [pairingStatus, setPairingStatus] = useState<
    "idle" | "scanning" | "registering" | "success"
  >("idle");

  const handlePairAndRegister = async () => {
    // 1. Simulate Hardware Pairing (e.g., Bluetooth scanning)
    setPairingStatus("scanning");

    // Simulating a 2-second scan delay...
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // In the future, the scanner will yield these values:
    const scannedImplantId = "CORA-005";
    const scannedReaderId = "READ-005";

    // 2. Register Device with Backend
    setPairingStatus("registering");
    const result = await registerDeviceAPI(scannedImplantId, scannedReaderId);

    if (result.success) {
      setPairingStatus("success");
      Alert.alert("Success", "Device paired and registered successfully!", [
        { text: "Done", onPress: () => router.replace("/home") },
      ]);
    } else {
      setPairingStatus("idle");
      Alert.alert("Registration Failed", result.error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Add New Device</Text>
        <Text style={styles.description}>
          Turn on your CORA reader and ensure it is nearby. Press the button
          below to scan and pair your hardware securely.
        </Text>

        <View style={styles.statusContainer}>
          {pairingStatus === "scanning" && (
            <>
              <ActivityIndicator size="large" color="#555566" />
              <Text style={styles.statusText}>Scanning for devices...</Text>
            </>
          )}
          {pairingStatus === "registering" && (
            <>
              <ActivityIndicator size="large" color="#555566" />
              <Text style={styles.statusText}>
                Securing connection with server...
              </Text>
            </>
          )}
          {pairingStatus === "success" && (
            <Text style={[styles.statusText, { color: "green" }]}>
              Device Linked!
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            pairingStatus !== "idle" && styles.buttonDisabled,
          ]}
          onPress={handlePairAndRegister}
          disabled={pairingStatus !== "idle"}
        >
          <Text style={styles.buttonText}>
            {pairingStatus === "idle"
              ? "Pair & Register Device"
              : "Please wait..."}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={pairingStatus !== "idle"}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#dedeee",
  },
  card: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#333",
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  statusContainer: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  statusText: {
    marginTop: 12,
    fontSize: 16,
    color: "#555566",
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#555566",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: "#a0a0aa",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    padding: 12,
    alignItems: "center",
  },
  cancelText: {
    color: "#888",
    fontSize: 16,
    fontWeight: "600",
  },
});
