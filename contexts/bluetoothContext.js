// ble/BleProvider.js
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BleManager } from "react-native-ble-plx";
import { requestBlePermissions } from "../utils/permissions";
import { Buffer } from "buffer";
import { handleBLEError } from "../utils/bleErrorHandler";

const SAVED_DEVICES_KEY = "saved_ble_devices";

export const C_SERVICE_UUID = process.env.EXPO_PUBLIC_SERVICE_UUID;
export const C_CHARACTERISTIC_UUID_RX = process.env.EXPO_PUBLIC_C_CHARACTERISTIC_UUID_RX;
export const C_CHARACTERISTIC_UUID_TX = process.env.EXPO_PUBLIC_C_CHARACTERISTIC_UUID_TX;

// ── JS-side connection timeout ─────────────────────────────────────────────
const CONNECTION_TIMEOUT_MS = 9000;

const connectWithTimeout = (
  manager,
  deviceId,
  timeoutMs = CONNECTION_TIMEOUT_MS,
) =>
  Promise.race([
    manager.connectToDevice(deviceId, { requestMTU: 512 }),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Connection timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);

export const BluetoothContext = createContext(null);

export const BluetoothProvider = ({ children }) => {
  const manager = useRef(new BleManager()).current;
  const monitorSubscription = useRef(null);
  const activeTransactionIdRef = useRef(null);
  const isCleaningUpRef = useRef(false);
  const connectedDeviceIdRef = useRef(null);
  const messageBufferRef = useRef("");
  const isMounted = useRef(true);

  const [savedDevices, setSavedDevices] = useState([]);
  const [scannedDevices, setScannedDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [deviceCharacteristics, setDeviceCharacteristics] = useState(null);
  const [connectingDeviceId, setConnectingDeviceId] = useState(null);
  const [receivedData, setReceivedData] = useState("");
  const [allReceivedData, setAllReceivedData] = useState([]);

  // ── Exposed BLE radio state ────────────────────────────────────────────
  const [bleState, setBleState] = useState("Unknown");

  // Helper function to clear all message buffers and data
  const clearMessageBuffers = useCallback(() => {
    messageBufferRef.current = "";
    safeSet(setReceivedData)("");
    safeSet(setAllReceivedData)([]);
  }, [safeSet]);

  const safeSet = useCallback(
    (setter) =>
      (...args) => {
        if (isMounted.current) setter(...args);
      },
    [],
  );

  // ----------------------------
  // Storage
  // ----------------------------
  const loadSavedDevices = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(SAVED_DEVICES_KEY);
      safeSet(setSavedDevices)(saved ? JSON.parse(saved) : []);
    } catch (err) {
      console.log("[BLE] Error loading saved devices:", err);
      handleBLEError(err, "load_saved", false);
    }
  }, [safeSet]);

  const saveDevice = useCallback(
    async (device) => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_DEVICES_KEY);
        const current = raw ? JSON.parse(raw) : [];
        if (current.some((d) => d.id === device.id)) return;
        const updated = [...current, { id: device.id, name: device.name }];
        await AsyncStorage.setItem(SAVED_DEVICES_KEY, JSON.stringify(updated));
        safeSet(setSavedDevices)(updated);
      } catch (err) {
        console.log("[BLE] Error saving device:", err);
        handleBLEError(err, "save_device", false);
      }
    },
    [safeSet],
  );

  // ----------------------------
  // Scanning
  // ----------------------------
  const startScan = useCallback(() => {
    // Guard: don't attempt scan if radio is off
    if (bleState === "PoweredOff") {
      console.log("[BLE] Scan blocked — Bluetooth is off");
      handleBLEError(new Error("Bluetooth is off"), "scan", false);
      return;
    }
    if (isScanning) return;

    safeSet(setScannedDevices)([]);
    safeSet(setIsScanning)(true);

    manager.startDeviceScan(null, {}, (error, device) => {
      if (error) {
        console.log("[BLE] Scan error:", error);
        handleBLEError(error, "scan_callback", false);
        safeSet(setIsScanning)(false);
        return;
      }
      if (!device?.name) return;
      safeSet(setScannedDevices)((prev) => {
        if (!prev.some((d) => d.id === device.id)) return [...prev, device];
        return prev;
      });
    });

    setTimeout(() => {
      if (isMounted.current) {
        manager.stopDeviceScan();
        safeSet(setIsScanning)(false);
      }
    }, 8000);
  }, [isScanning, manager, safeSet, bleState]);

  // ----------------------------
  // Cleanup
  // ----------------------------
  const performCleanup = useCallback(
    async (deviceId) => {
      if (isCleaningUpRef.current) {
        console.log("[BLE] Cleanup already in progress, skipping");
        return;
      }
      isCleaningUpRef.current = true;
      console.log("[BLE] 🧹 Performing cleanup");

      monitorSubscription.current = null;
      activeTransactionIdRef.current = null;

      const idToCancel = deviceId ?? connectedDeviceIdRef.current;
      if (idToCancel) {
        try {
          await manager.cancelDeviceConnection(idToCancel);
        } catch (e) {
          console.log("[BLE] cancelDeviceConnection swallowed:", e?.message);
          handleBLEError(e, "cleanup_cancel", false);
        }
      }

      try {
        manager.stopDeviceScan();
      } catch (e) {
        handleBLEError(e, "cleanup_stop_scan", false);
      }

      connectedDeviceIdRef.current = null;

      // Clear all message buffers during cleanup
      clearMessageBuffers();

      safeSet(setConnectedDevice)(null);
      safeSet(setDeviceCharacteristics)(null);
      safeSet(setConnectingDeviceId)(null);

      isCleaningUpRef.current = false;
      console.log("[BLE] ✅ Cleanup done");
    },
    [manager, safeSet, clearMessageBuffers],
  );

  // ----------------------------
  // Connection
  // ----------------------------
  const connectToDevice = useCallback(
    async (device) => {
      // Guard: fail fast with a clear error rather than crashing natively
      if (bleState === "PoweredOff") {
        const error = new Error(
          "Bluetooth is off. Please enable Bluetooth and try again.",
        );
        handleBLEError(error, "connect", true);
        throw error;
      }

      console.log("[BLE] 🔗 Connecting to", device.name);
      safeSet(setConnectingDeviceId)(device.id);

      try {
        await performCleanup(null);
        await new Promise((resolve) => setTimeout(resolve, 100));

        const connected = await connectWithTimeout(manager, device.id);

        console.log("[BLE] ✅ Connected, discovering services...");
        connectedDeviceIdRef.current = connected.id;

        connected.onDisconnected((error) => {
          console.log("[BLE] 📴 Device disconnected", error?.message ?? "");
          if (error) {
            handleBLEError(error, "on_disconnected", false);
          }
          performCleanup(null);
        });

        await connected.discoverAllServicesAndCharacteristics();

        const services = await connected.services();
        const targetService = services.find(
          (s) => s.uuid.toLowerCase() === C_SERVICE_UUID.toLowerCase(),
        );

        if (!targetService) throw new Error("Nordic UART service not found");

        const characteristics = await connected.characteristicsForService(
          targetService.uuid,
        );

        let rxChar = null,
          txChar = null;
        characteristics.forEach((char) => {
          const uuid = char.uuid.toLowerCase();
          if (uuid === C_CHARACTERISTIC_UUID_RX.toLowerCase()) rxChar = char;
          else if (uuid === C_CHARACTERISTIC_UUID_TX.toLowerCase())
            txChar = char;
        });

        if (!rxChar || !txChar)
          throw new Error("Missing RX or TX characteristic");

        safeSet(setDeviceCharacteristics)({
          rx: rxChar,
          tx: txChar,
          service: targetService,
        });

        // Clear buffer immediately after successful connection
        clearMessageBuffers();

        if (txChar.isNotifiable) {
          console.log("[BLE] 🔔 Setting up notifications...");

          const transactionId = `monitor-${device.id}-${Date.now()}`;
          activeTransactionIdRef.current = transactionId;

          monitorSubscription.current =
            connected.monitorCharacteristicForService(
              C_SERVICE_UUID,
              C_CHARACTERISTIC_UUID_TX,
              (error, characteristic) => {
                try {
                  if (error) {
                    if (
                      error.errorCode == null ||
                      error.reason?.toLowerCase().includes("cancel") ||
                      error.message?.toLowerCase().includes("cancel")
                    ) {
                      return;
                    }
                    console.warn("[BLE] Monitor error:", error);
                    handleBLEError(error, "monitor", false);
                    return;
                  }

                  if (!characteristic?.value) return;

                  const decodedByte = Buffer.from(
                    characteristic.value,
                    "base64",
                  ).toString("utf8");
                  const charCode = decodedByte.charCodeAt(0);

                  messageBufferRef.current += decodedByte;

                  if (charCode === 3) {
                    const completeMessage = messageBufferRef.current;
                    const readable = messageBufferRef.current
                      .replace(/\x02/g, "")
                      .replace(/\x03/g, "")
                      .trim();

                    console.log("\n\n", readable, "From device");
                    safeSet(setReceivedData)(readable);
                    safeSet(setAllReceivedData)((prev) => [
                      ...prev,
                      {
                        raw: completeMessage,
                        readable,
                        timestamp: new Date().toISOString(),
                      },
                    ]);

                    messageBufferRef.current = "";
                  }
                } catch (err) {
                  console.error("[BLE] Monitor callback error:", err);
                  handleBLEError(err, "monitor_callback", false);
                }
              },
              transactionId,
            );

          console.log("[BLE] ✅ Notification listener active");
        }

        safeSet(setConnectedDevice)(connected);
        safeSet(setConnectingDeviceId)(null);

        await saveDevice({ id: device.id, name: device.name });

        console.log("[BLE] 🎉 Device connected!");
        return {
          device: connected,
          characteristics: { rx: rxChar, tx: txChar, service: targetService },
        };
      } catch (err) {
        console.log("[BLE] ❌ Connection failed:", err.message);
        safeSet(setConnectingDeviceId)(null);
        handleBLEError(err, "connect", true);
        await performCleanup(device.id);
        throw err;
      }
    },
    [
      manager,
      performCleanup,
      saveDevice,
      safeSet,
      bleState,
      clearMessageBuffers,
    ],
  );

  // ----------------------------
  // Send Data
  // ----------------------------
  const sendData = useCallback(
    async (data) => {
      console.log("\n\n", data, "To send", "\n\n");
      if (
        !connectedDevice ||
        !deviceCharacteristics?.rx?.isWritableWithResponse
      ) {
        console.log("[BLE] No connected device or RX not writable");
        return false;
      }
      try {
        const base64Data = Buffer.from(data, "utf8").toString("base64");
        await connectedDevice.writeCharacteristicWithResponseForService(
          C_SERVICE_UUID,
          C_CHARACTERISTIC_UUID_RX,
          base64Data,
        );
        return true;
      } catch (error) {
        console.log("[BLE] ❌ Send error:", error);
        handleBLEError(error, "send_data", false);
        return false;
      }
    },
    [connectedDevice, deviceCharacteristics],
  );

  // ----------------------------
  // Disconnect
  // ----------------------------
  const disconnect = useCallback(async () => {
    console.log("[BLE] 🛑 Disconnecting");
    await performCleanup(null);
    return true;
  }, [performCleanup]);

  // ----------------------------
  // Forget Device
  // ----------------------------
  const forgetDevice = useCallback(
    async (deviceToForget) => {
      try {
        if (connectedDevice?.id === deviceToForget.id) await disconnect();
        const raw = await AsyncStorage.getItem(SAVED_DEVICES_KEY);
        const current = raw ? JSON.parse(raw) : [];
        const updated = current.filter((d) => d.id !== deviceToForget.id);
        await AsyncStorage.setItem(SAVED_DEVICES_KEY, JSON.stringify(updated));
        safeSet(setSavedDevices)(updated);
        return true;
      } catch (err) {
        console.log("[BLE] Error forgetting device:", err);
        handleBLEError(err, "forget_device", false);
        return false;
      }
    },
    [connectedDevice, disconnect, safeSet],
  );

  // ----------------------------
  // Service Check
  // ----------------------------
  const deviceHasRequiredService = useCallback(
    async (deviceId) => {
      try {
        const services = await manager.servicesForDevice(deviceId);
        return services.some(
          (s) => s.uuid.toLowerCase() === C_SERVICE_UUID.toLowerCase(),
        );
      } catch (error) {
        console.log("[BLE] Error checking services:", error);
        handleBLEError(error, "service_check", false);
        return false;
      }
    },
    [manager],
  );

  // ----------------------------
  // Message Parser
  // ----------------------------
  const parseFlyStepMessage = useCallback((message) => {
    if (!message || message.length < 5) return null;
    const charCodes = [];
    for (let i = 0; i < message.length; i++) {
      charCodes.push(message.charCodeAt(i));
    }
    if (charCodes[0] !== 2 || charCodes[charCodes.length - 1] !== 3) {
      return { error: "Invalid format", raw: message };
    }
    const commandChar = String.fromCharCode(charCodes[1]);
    const batteryLevel = charCodes[2] - 48;
    const chargingStatus = charCodes[3] - 48;
    const statusChar = String.fromCharCode(charCodes[4]);
    let messageType = "unknown";
    if (statusChar === "O") messageType = "operation_started";
    else if (statusChar === "E") messageType = "error";
    else if (statusChar === "M") messageType = "measurement";
    else if (statusChar === "U") messageType = "complete";
    return {
      command: commandChar,
      battery: { level: batteryLevel, charging: chargingStatus === 1 },
      status: statusChar,
      messageType,
      raw: message,
      charCodes,
    };
  }, []);

  // ----------------------------
  // Init & Teardown
  // ----------------------------
  useEffect(() => {
    const init = async () => {
      try {
        await requestBlePermissions();
      } catch (err) {
        handleBLEError(err, "permissions", true);
      }
      loadSavedDevices();

      manager.onStateChange((state) => {
        if (isMounted.current) {
          console.log("[BLE] 📡 State:", state);
          setBleState(state); // ← expose radio state to consumers
        }
      }, true); // true = emit current state immediately on subscribe
    };

    init();

    return () => {
      isMounted.current = false;
      performCleanup(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BluetoothContext.Provider
      value={{
        savedDevices,
        scannedDevices,
        connectedDevice,
        connectingDeviceId,
        deviceCharacteristics,
        isScanning,
        receivedData,
        allReceivedData,
        bleState, // ← new
        setReceivedData,

        C_SERVICE_UUID,
        C_CHARACTERISTIC_UUID_RX,
        C_CHARACTERISTIC_UUID_TX,

        startScan,
        connectToDevice,
        disconnect,
        sendData,
        saveDevice,
        loadSavedDevices,
        setScannedDevices,
        deviceHasRequiredService,
        forgetDevice,

        clearReceivedData: () => {
          clearMessageBuffers();
        },
        parseFlyStepMessage,
        testMessageParsing: () => {
          const testMsgs = ["2s00O3", "2s00M04503", "2v10053", "2b20O3"];
          testMsgs.forEach((msg) =>
            console.log("Test:", parseFlyStepMessage(msg)),
          );
        },
        clearConnectedState: () => {
          safeSet(setConnectedDevice)(null);
          safeSet(setDeviceCharacteristics)(null);
          safeSet(setConnectingDeviceId)(null);
          clearMessageBuffers();
        },
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = () => useContext(BluetoothContext);

