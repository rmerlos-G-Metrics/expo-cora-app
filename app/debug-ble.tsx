import React, { useEffect, useState } from "react";
import {
    NativeEventEmitter,
    NativeModules,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import BleManager from "react-native-ble-manager";

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default function DebugBleScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  useEffect(() => {
    BleManager.start({ showAlert: false })
      .then(() => addLog("BLE Manager Initialized"))
      .catch((err) => addLog(`Init Error: ${err}`));

    const discoverSub = bleManagerEmitter.addListener(
      "BleManagerDiscoverPeripheral",
      (peripheral) => {
        addLog(`Discovered: ${peripheral.name || peripheral.id}`);
        setDevices((prev) => {
          if (!prev.find((d) => d.id === peripheral.id)) {
            return [...prev, peripheral];
          }
          return prev;
        });
      },
    );

    const stopSub = bleManagerEmitter.addListener("BleManagerStopScan", () => {
      setIsScanning(false);
      addLog("Scan stopped automatically.");
    });

    return () => {
      discoverSub.remove();
      stopSub.remove();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === "android" && Platform.Version >= 31) {
      addLog("Requesting Android 12+ Permissions (BLUETOOTH + LOCATION)...");
      // NEW: We must request Fine Location here too because neverForLocation is false
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      // NEW: Print the exact status of each permission to the screen!
      addLog(`BLE Scan: ${result["android.permission.BLUETOOTH_SCAN"]}`);
      addLog(`BLE Connect: ${result["android.permission.BLUETOOTH_CONNECT"]}`);
      addLog(`Location: ${result["android.permission.ACCESS_FINE_LOCATION"]}`);

      const allGranted =
        result["android.permission.BLUETOOTH_SCAN"] === "granted" &&
        result["android.permission.BLUETOOTH_CONNECT"] === "granted" &&
        result["android.permission.ACCESS_FINE_LOCATION"] === "granted";

      addLog(`Android 12+ Permissions Granted: ${allGranted}`);
      return allGranted;
    } else if (Platform.OS === "android") {
      addLog("Requesting Android 11 or lower Permissions...");
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      addLog(
        `Location Permission Granted: ${granted === PermissionsAndroid.RESULTS.GRANTED}`,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const startScan = async () => {
    setDevices([]);
    addLog("--- Starting New Scan ---");

    const hasPerms = await requestPermissions();
    if (!hasPerms) {
      addLog("ERROR: Missing required permissions.");
      return;
    }

    try {
      if (Platform.OS === "android") {
        await BleManager.enableBluetooth();
        addLog("Bluetooth is enabled.");
      }

      setIsScanning(true);
      addLog("Calling BleManager.scan()...");
      await BleManager.scan([], 5, false);
      addLog("Scan initiated successfully.");
    } catch (error) {
      setIsScanning(false);
      addLog(`SCAN ERROR: ${JSON.stringify(error)}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BLE Debugger</Text>

      <TouchableOpacity
        style={[styles.button, isScanning && styles.buttonDisabled]}
        onPress={startScan}
        disabled={isScanning}
      >
        <Text style={styles.buttonText}>
          {isScanning ? "Scanning (5s)..." : "Start Raw Scan"}
        </Text>
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <Text>Devices Found: {devices.length}</Text>
      </View>

      <Text style={styles.subtitle}>Debug Logs:</Text>
      <ScrollView style={styles.logBox}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
    paddingTop: 50,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#ccc" },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  statsRow: { marginTop: 15, marginBottom: 10 },
  subtitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
  },
  logBox: { flex: 1, backgroundColor: "#1e1e1e", borderRadius: 8, padding: 10 },
  logText: {
    color: "#00ff00",
    fontFamily: "monospace",
    fontSize: 12,
    marginBottom: 4,
  },
});
