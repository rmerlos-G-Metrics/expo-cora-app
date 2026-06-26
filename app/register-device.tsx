import { registerDeviceAPI } from "@/services/hardware";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BleManager, { Peripheral } from "react-native-ble-manager";

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default function RegisterDeviceScreen() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [devices, setDevices] = useState<Peripheral[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Peripheral | null>(null);

  useEffect(() => {
    BleManager.start({ showAlert: true })
      .then(() => console.log("BleManager initialized standard module."))
      .catch((err) => console.log("BleManager failed to start", err));

    const discoverListener = bleManagerEmitter.addListener(
      "BleManagerDiscoverPeripheral",
      (peripheral: Peripheral) => {
        // Show the device name if available, otherwise fall back to its MAC address/ID
        const deviceName =
          peripheral.name || peripheral.localName || "Unknown BLE Device";

        setDevices((prevDevices) => {
          if (!prevDevices.some((d) => d.id === peripheral.id)) {
            // Create a normalized item so it renders correctly in the list
            return [...prevDevices, { ...peripheral, name: deviceName }];
          }
          return prevDevices;
        });
      },
    );

    const stopListener = bleManagerEmitter.addListener(
      "BleManagerStopScan",
      () => {
        setIsScanning(false);
        console.log("Bluetooth scan completed.");
      },
    );

    return () => {
      discoverListener.remove();
      stopListener.remove();
    };
  }, []);

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === "android" && Platform.Version >= 31) {
      const scanGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      );
      const connectGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      );
      return (
        scanGranted === PermissionsAndroid.RESULTS.GRANTED &&
        connectGranted === PermissionsAndroid.RESULTS.GRANTED
      );
    } else if (Platform.OS === "android") {
      const locationGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return locationGranted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // iOS handles permission prompts automatically on trigger
  };

  // Start Scan Trigger Function
  const startBluetoothScan = async () => {
    if (isScanning || isRegistering) return;

    // 1. Check/Request OS Permissions first
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert(
        "Permission Denied",
        "Bluetooth permissions are required to look for devices.",
      );
      return;
    }

    // 2. NEW: Forcefully prompt the user to turn on Bluetooth if it is off (Android)
    if (Platform.OS === "android") {
      try {
        await BleManager.enableBluetooth();
      } catch (err) {
        Alert.alert(
          "Bluetooth Disabled",
          "Please turn on Bluetooth to connect to your CORA device.",
        );
        return;
      }
    }

    setDevices([]); // Reset list
    setSelectedDevice(null);
    setIsScanning(true);

    // 3. Trigger the BLE Scan
    BleManager.scan({
      serviceUUIDs: [], // Empty array means scan for everything
      seconds: 5,
      allowDuplicates: false,
    })
      .then(() => {
        console.log("Scan started successfully...");
      })
      .catch((err) => {
        // NEW: Show a visual alert if the OS blocks the scan
        console.error("Scan Error:", err);
        setIsScanning(false);
        Alert.alert(
          "Scanner Blocked",
          "Make sure your phone's Location (GPS) toggle is turned ON. Android requires GPS to discover BLE devices.",
        );
      });
  };

  // Backend Registration Pipeline Action
  const handleDeviceRegistration = async () => {
    if (!selectedDevice) {
      Alert.alert("Error", "Please select a device from the list first.");
      return;
    }

    setIsRegistering(true);

    // Pass the actual real Bluetooth hardware values discovered to your backend!
    const hardwareImplantId = selectedDevice.name || "CORA-UNKNOWN";
    const hardwareReaderId = selectedDevice.id; // Mac Address or UUID string

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
