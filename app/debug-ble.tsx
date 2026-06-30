import base64 from "base-64"; // For decoding BLE payloads
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BleManager, Device, Subscription } from "react-native-ble-plx";

//const bleManager = new BleManager();

// Your exact UUIDs from the ESP32 Code
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const IDENTITY_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const COMMAND_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
const DATA_TX_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26aa";

export default function TabOneScreen() {
  const bleManager = useMemo(() => new BleManager(), []);

  useEffect(() => {
    return () => {
      bleManager.destroy();
    };
  }, [bleManager]);

  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [devicesList, setDevicesList] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [logMessage, setLogMessage] = useState<string>("Ready to scan");

  // Terminal State
  const [deviceIdentity, setDeviceIdentity] = useState<string>(
    "Loading Identity...",
  );
  const [dataStream, setDataStream] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [monitorSubscription, setMonitorSubscription] =
    useState<Subscription | null>(null);

  useEffect(() => {
    return () => {
      bleManager.destroy();
      if (monitorSubscription) monitorSubscription.remove();
    };
  }, []);

  // --- 1. PERMISSIONS & SCANNING ---
  const requestBluetoothPermissions = async () => {
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
    return true;
  };

  const startScan = async () => {
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      setLogMessage("❌ Bluetooth Permissions Denied");
      return;
    }

    setDevicesList([]);
    setLogMessage("🔍 Scanning for CORA-READER-DEV...");
    setIsScanning(true);

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        setLogMessage(`❌ Scan Error: ${error.message}`);
        setIsScanning(false);
        return;
      }

      if (device && device.name) {
        setDevicesList((prev) => {
          if (!prev.some((d) => d.id === device.id)) {
            return [...prev, device];
          }
          return prev;
        });
      }
    });

    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
      setLogMessage("Scan finished");
    }, 10000);
  };

  // --- 2. CONNECTION & SETUP ---
  const connectToDevice = async (device: Device) => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
    setLogMessage(`🔌 Connecting to ${device.name}...`);

    try {
      const connected = await device.connect();

      if (Platform.OS === "android") {
        await connected.requestMTU(512);
      }

      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);
      setLogMessage(`✅ Connected`);

      // Setup Terminal Data
      await readDeviceIdentity(connected);
      setupDataStreamListener(connected);
    } catch (error: any) {
      setLogMessage(`❌ Connection Failed: ${error.message}`);
    }
  };

  const disconnectDevice = async () => {
    if (!connectedDevice) return;
    try {
      if (monitorSubscription) {
        monitorSubscription.remove();
        setMonitorSubscription(null);
      }
      await bleManager.cancelDeviceConnection(connectedDevice.id);
      setConnectedDevice(null);
      setDataStream([]); // Clear old terminal data
      setLogMessage("Disconnected");
    } catch (error) {
      setConnectedDevice(null);
    }
  };

  // --- 3. TERMINAL FUNCTIONS ---
  const readDeviceIdentity = async (device: Device) => {
    try {
      const char = await device.readCharacteristicForService(
        SERVICE_UUID,
        IDENTITY_CHAR_UUID,
      );
      if (char?.value) {
        const decoded = base64.decode(char.value);
        setDeviceIdentity(decoded);
      }
    } catch (error) {
      console.error("Failed to read identity:", error);
      setDeviceIdentity("Error reading identity");
    }
  };

  const setupDataStreamListener = (device: Device) => {
    // Open a persistent listener on the DATA_TX channel
    const sub = device.monitorCharacteristicForService(
      SERVICE_UUID,
      DATA_TX_CHAR_UUID,
      (error, characteristic) => {
        if (error) {
          console.error("Notification Error:", error);
          return;
        }

        if (characteristic?.value) {
          const decodedValue = base64.decode(characteristic.value);

          if (decodedValue === "END_OF_SYNC") {
            setIsSyncing(false);
            setLogMessage("✅ Sync Complete");
          } else {
            // Append incoming data to the top of the list
            setDataStream((prev) => [decodedValue, ...prev]);
          }
        }
      },
    );
    setMonitorSubscription(sub);
  };

  const triggerSync = async () => {
    if (!connectedDevice) return;
    setIsSyncing(true);
    setLogMessage("⏳ Requesting Sync...");
    setDataStream([]);

    try {
      // Encode "SYNC" to Base64 to write to the command characteristic
      const commandBase64 = base64.encode("SYNC");

      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        COMMAND_CHAR_UUID,
        commandBase64,
      );
      setLogMessage("📡 Downloading data...");
    } catch (error: any) {
      setIsSyncing(false);
      setLogMessage(`❌ Sync Request Failed: ${error.message}`);
    }
  };

  // --- UI RENDERERS ---
  const renderDeviceItem = ({ item }: { item: Device }) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => connectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceMac}>{item.id}</Text>
      </View>
      <Text style={styles.connectText}>Connect →</Text>
    </TouchableOpacity>
  );

  const renderDataRow = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.dataRow}>
      <Text style={styles.dataText}>{item}</Text>
    </View>
  );

  // If connected, show TERMINAL. Otherwise, show SCANNER.
  if (connectedDevice) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>CORA TERMINAL</Text>

        {/* Header Block */}
        <View style={styles.identityBox}>
          <Text style={styles.identityLabel}>Hardware Identity:</Text>
          <Text style={styles.identityValue}>{deviceIdentity}</Text>
        </View>

        {/* Sync Controls */}
        <TouchableOpacity
          style={[
            styles.button,
            styles.syncButton,
            isSyncing && styles.buttonDisabled,
          ]}
          onPress={triggerSync}
          disabled={isSyncing}
        >
          <Text style={styles.buttonText}>
            {isSyncing ? "Syncing In Progress..." : "Start Data Sync"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.statusTextTerminal}>{logMessage}</Text>

        {/* Data Stream Window */}
        <View style={styles.terminalWindow}>
          <FlatList
            data={dataStream}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderDataRow}
            contentContainerStyle={styles.terminalContent}
            ListEmptyComponent={
              <Text style={styles.emptyTerminal}>No data synced yet.</Text>
            }
          />
        </View>

        <TouchableOpacity
          style={styles.disconnectTextBtn}
          onPress={disconnectDevice}
        >
          <Text style={styles.disconnectText}>End Session</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // DEFAULT SCANNER VIEW
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device Scanner</Text>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{logMessage}</Text>
        {isScanning && (
          <ActivityIndicator
            size="small"
            color="#007AFF"
            style={{ marginTop: 10 }}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, isScanning && styles.buttonDisabled]}
        onPress={startScan}
        disabled={isScanning}
      >
        <Text style={styles.buttonText}>
          {isScanning ? "Scanning..." : "Scan Devices"}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={devicesList}
        keyExtractor={(item) => item.id}
        renderItem={renderDeviceItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !isScanning ? (
            <Text style={styles.emptyText}>No devices discovered yet.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },

  // Scanner Styles
  statusBox: {
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
    alignItems: "center",
  },
  statusText: { fontSize: 14, color: "#666", fontWeight: "500" },
  listContainer: { paddingTop: 15, paddingBottom: 30 },
  deviceCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    elevation: 1,
  },
  deviceInfo: { flexDirection: "column" },
  deviceName: { fontSize: 16, fontWeight: "bold", color: "#222" },
  deviceMac: { fontSize: 12, color: "#888", marginTop: 4 },
  connectText: { fontSize: 14, color: "#007AFF", fontWeight: "600" },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    fontSize: 14,
  },

  // Button Styles
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    borderRadius: 25,
    width: "100%",
    marginBottom: 10,
  },
  buttonDisabled: { backgroundColor: "#A0CFFF" },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },

  // Terminal Styles
  identityBox: {
    backgroundColor: "#2C2C2E",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    marginBottom: 20,
  },
  identityLabel: { color: "#A1A1A6", fontSize: 12, marginBottom: 4 },
  identityValue: { color: "#32D74B", fontSize: 18, fontWeight: "bold" },
  syncButton: { backgroundColor: "#5E5CE6", marginBottom: 10 },
  statusTextTerminal: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "500",
  },
  terminalWindow: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    borderRadius: 10,
    padding: 10,
    width: "100%",
    marginBottom: 20,
  },
  terminalContent: { paddingBottom: 20 },
  dataRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingVertical: 8,
  },
  dataText: {
    color: "#00FF41",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  emptyTerminal: {
    color: "#666",
    textAlign: "center",
    marginTop: 20,
    fontStyle: "italic",
  },
  disconnectTextBtn: { padding: 15, marginBottom: 20 },
  disconnectText: {
    color: "#FF453A",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});
