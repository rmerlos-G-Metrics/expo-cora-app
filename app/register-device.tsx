import { registerDeviceAPI } from "@/services/hardware";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// Import from react-native-ble-plx instead of react-native-ble-manager
import { BleManager, Device } from "react-native-ble-plx";

export default function RegisterDeviceScreen() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // 1. Instantiate the BleManager safely using useMemo
  const bleManager = useMemo(() => new BleManager(), []);

  // 2. Handle cleanup on unmount
  useEffect(() => {
    return () => {
      bleManager.stopDeviceScan();
      bleManager.destroy();
    };
  }, [bleManager]);

  // 3. Request permissions adapted for PLX (matching your working implementation)
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      const apiLevel = Platform.Version;
      if (apiLevel >= 31) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        return (
          result["android.permission.BLUETOOTH_CONNECT"] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          result["android.permission.BLUETOOTH_SCAN"] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true; // iOS handles automatically
  };

  // 4. Start Scan Trigger Function
  const startBluetoothScan = async () => {
    if (isScanning || isRegistering) return;

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert(
        "Permission Denied",
        "Bluetooth permissions are required to look for devices.",
      );
      return;
    }

    setDevices([]); // Reset list
    setSelectedDevice(null);
    setIsScanning(true);

    // react-native-ble-plx uses a direct callback loop for streaming discovered peripherals
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error("Scan Error:", error.message);
        setIsScanning(false);
        Alert.alert(
          "Scanner Error",
          error.message ||
            "Make sure your location services and Bluetooth are turned ON.",
        );
        return;
      }

      if (device && device.name) {
        setDevices((prevDevices) => {
          if (!prevDevices.some((d) => d.id === device.id)) {
            return [...prevDevices, device];
          }
          return prevDevices;
        });
      }
    });

    // Automatically stop scan after 5 seconds (matching original behavior)
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
      console.log("Bluetooth scan completed.");
    }, 5000);
  };

  // 5. Backend Registration Pipeline Action
  const handleDeviceRegistration = async () => {
    if (!selectedDevice) {
      Alert.alert("Error", "Please select a device from the list first.");
      return;
    }

    // Stop scanning if it's still running before proceeding
    bleManager.stopDeviceScan();
    setIsScanning(false);
    setIsRegistering(true);

    const hardwareImplantId = selectedDevice.name || "CORA-UNKNOWN";
    const hardwareReaderId = selectedDevice.id; // Mac Address (Android) or UUID (iOS)

    const result = await registerDeviceAPI(hardwareImplantId, hardwareReaderId);
    setIsRegistering(false);

    if (result.success) {
      Alert.alert(
        "Success",
        `Device ${hardwareImplantId} registered successfully!`,
        [{ text: "Done", onPress: () => router.replace("/home") }],
      );
    } else {
      Alert.alert("Registration Failed", result.error);
    }
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Bluetooth Pairing</Text>
        <Text style={styles.description}>
          Tap 'Scan for Devices' to discover your hardware, select it from the
          list, and link it to your account.
        </Text>

        {/* Scan Status and Control Button */}
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.buttonDisabled]}
          onPress={startBluetoothScan}
          disabled={isScanning || isRegistering}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Scan for Devices</Text>
          )}
        </TouchableOpacity>

        {/* Device List Array Render */}
        <Text style={styles.sectionTitle}>
          Discovered Devices ({devices.length})
        </Text>
        <View style={styles.listContainer}>
          {devices.length === 0 ? (
            <Text style={styles.emptyText}>
              {isScanning
                ? "Listening for signals..."
                : "No devices found. Press Scan."}
            </Text>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedDevice?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.deviceItem,
                      isSelected && styles.deviceItemSelected,
                    ]}
                    onPress={() => !isRegistering && setSelectedDevice(item)}
                    disabled={isRegistering}
                  >
                    <Text
                      style={[
                        styles.deviceName,
                        isSelected && styles.textSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.deviceMac,
                        isSelected && styles.textSelected,
                      ]}
                    >
                      {item.id}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>

        {/* Confirm Register Button Section */}
        {selectedDevice && (
          <TouchableOpacity
            style={[
              styles.registerButton,
              isRegistering && styles.buttonDisabled,
            ]}
            onPress={handleDeviceRegistration}
            disabled={isRegistering || isScanning}
          >
            {isRegistering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Register: {selectedDevice.name}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={isScanning || isRegistering}
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
    maxHeight: "85%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#333",
  },
  description: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  scanButton: {
    backgroundColor: "#463e4b",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  listContainer: {
    height: 200,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: "#fafafa",
    padding: 4,
  },
  emptyText: {
    textAlign: "center",
    color: "#aaa",
    marginTop: 80,
    fontSize: 14,
  },
  deviceItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    borderRadius: 6,
    marginBottom: 4,
  },
  deviceItemSelected: {
    backgroundColor: "#555566",
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  deviceMac: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  textSelected: {
    color: "#fff",
  },
  registerButton: {
    backgroundColor: "green",
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
