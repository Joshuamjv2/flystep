// ble/BleProvider.js
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BleManager } from "react-native-ble-plx";
import { requestBlePermissions } from "../utils/permissions";
import { Buffer } from "buffer";

const SAVED_DEVICES_KEY = "saved_ble_devices";

// Your B4X UUIDs - include these constants
export const C_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const C_CHARACTERISTIC_UUID_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
export const C_CHARACTERISTIC_UUID_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

export const BluetoothContext = createContext(null);

export const BluetoothProvider = ({ children }) => {
  const manager = useRef(new BleManager()).current;

  const [savedDevices, setSavedDevices] = useState([]);
  const [scannedDevices, setScannedDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [deviceCharacteristics, setDeviceCharacteristics] = useState(null);

  // Track which device is connecting
  const [connectingDeviceId, setConnectingDeviceId] = useState(null);

  // Load saved devices
  const loadSavedDevices = async () => {
    try {
      const saved = await AsyncStorage.getItem(SAVED_DEVICES_KEY);
      setSavedDevices(saved ? JSON.parse(saved) : []);
    } catch (err) {
      console.log("Error loading saved devices:", err);
    }
  };

  // Save device to storage
  const saveDevice = async (device) => {
    try {
      const exists = savedDevices.some((d) => d.id === device.id);
      if (exists) return;

      const updated = [...savedDevices, device];
      await AsyncStorage.setItem(SAVED_DEVICES_KEY, JSON.stringify(updated));
      setSavedDevices(updated);
    } catch (err) {
      console.log("Error saving device:", err);
    }
  };

  // Start scanning - filter for your specific service UUID if needed
  const startScan = () => {
    setScannedDevices([]);
    setIsScanning(true);

    // You can optionally filter by service UUIDs
    const scanOptions = {
      // allowDuplicates: false, // Set based on your needs
    };

    manager.startDeviceScan(null, scanOptions, (error, device) => {
      if (error) {
        console.log("Scan error:", error);
        setIsScanning(false);
        return;
      }

      if (!device?.name) return;

      setScannedDevices((prev) => {
        const exists = prev.some((d) => d.id === device.id);
        if (!exists) return [...prev, device];
        return prev;
      });
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 8000);
  };

  // Connect to a BLE device and discover services/characteristics
  const connectToDevice = async (device) => {
    try {
      console.log("Connecting to", device.name);

      // Mark this device as connecting
      setConnectingDeviceId(device.id);

      const connected = await manager.connectToDevice(device.id, {
        requestMTU: 512, // Optional: request larger MTU if needed
        timeout: 10000, // 10 second timeout
      });

      // Discover all services and characteristics
      await connected.discoverAllServicesAndCharacteristics();

      // Get the specific service and characteristics
      const services = await connected.services();
      console.log("Available services:", services);

      let targetService = null;
      let rxCharacteristic = null;
      let txCharacteristic = null;

      // Find your specific service
      for (const service of services) {
        if (service.uuid.toLowerCase() === C_SERVICE_UUID.toLowerCase()) {
          targetService = service;
          break;
        }
      }

      if (targetService) {
        const characteristics = await connected.characteristicsForService(
          targetService.uuid
        );
        console.log("Available characteristics:", characteristics);

        // Find RX and TX characteristics
        for (const char of characteristics) {
          const charUUID = char.uuid.toLowerCase();
          if (charUUID === C_CHARACTERISTIC_UUID_RX.toLowerCase()) {
            rxCharacteristic = char;
          } else if (charUUID === C_CHARACTERISTIC_UUID_TX.toLowerCase()) {
            txCharacteristic = char;
          }
        }

        setDeviceCharacteristics({
          rx: rxCharacteristic,
          tx: txCharacteristic,
          service: targetService,
        });

        // Setup monitoring for TX characteristic if it exists and is readable
        if (txCharacteristic && txCharacteristic.isReadable) {
          connected.monitorCharacteristicForService(
            C_SERVICE_UUID,
            C_CHARACTERISTIC_UUID_TX,
            (error, characteristic) => {
              if (error) {
                console.log("Monitoring error:", error);
                return;
              }
              if (characteristic?.value) {
                console.log("Received data:", characteristic.value);
                // Handle incoming data here
                // You might want to add a callback or state for received data
              }
            }
          );
        }
      }

      setConnectedDevice(connected);
      await saveDevice({
        id: device.id,
        name: device.name,
      });

      return {
        device: connected,
        characteristics: {
          rx: rxCharacteristic,
          tx: txCharacteristic,
          service: targetService,
        },
      };
    } catch (err) {
      console.log("Connection error:", err);
      throw err;
    } finally {
      // Clear connecting state after completion
      setConnectingDeviceId(null);
    }
  };

  // Send data to device via RX characteristic
  const sendData = async (data) => {
    if (!deviceCharacteristics?.rx || !deviceCharacteristics.rx.isWritable) {
      console.log("RX characteristic not available or not writable");
      return false;
    }

    try {
      // Convert string to base64 (react-native-ble-plx expects base64)
      const base64Data = Buffer.from(data, "utf8").toString("base64");

      await connectedDevice.writeCharacteristicWithResponseForService(
        C_SERVICE_UUID,
        C_CHARACTERISTIC_UUID_RX,
        base64Data
      );

      console.log("Data sent successfully");
      return true;
    } catch (error) {
      console.log("Error sending data:", error);
      return false;
    }
  };

  // Disconnect from device
  const disconnect = async () => {
    try {
      if (connectedDevice) {
        await manager.cancelDeviceConnection(connectedDevice.id);
      }
      setConnectedDevice(null);
      setDeviceCharacteristics(null);
    } catch (err) {
      console.log("Disconnect error:", err);
    }
  };

  // Check if device has your specific service
  const deviceHasRequiredService = async (deviceId) => {
    try {
      const services = await manager.servicesForDevice(deviceId);
      return services.some(
        (service) => service.uuid.toLowerCase() === C_SERVICE_UUID.toLowerCase()
      );
    } catch (error) {
      console.log("Error checking services:", error);
      return false;
    }
  };

  // Initialize BLE manager
  useEffect(() => {
    const init = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await requestBlePermissions();
      loadSavedDevices();

      manager.onStateChange((state) => {
        console.log("BLE State:", state);
        if (state === "PoweredOn") {
          // Bluetooth is powered on and ready
          console.log("Bluetooth is powered on");
        } else if (state === "PoweredOff") {
          // Handle Bluetooth turned off
          console.log("Bluetooth is powered off");
          setIsScanning(false);
          setConnectedDevice(null);
        }
      }, true); // 'true' means run the listener immediately
    };

    init();

    return () => manager.destroy();
  }, []);

  return (
    <BluetoothContext.Provider
      value={{
        manager,
        savedDevices,
        scannedDevices,
        connectedDevice,
        connectingDeviceId,
        deviceCharacteristics,
        isScanning,

        // Constants
        C_SERVICE_UUID,
        C_CHARACTERISTIC_UUID_RX,
        C_CHARACTERISTIC_UUID_TX,

        // Methods
        startScan,
        connectToDevice,
        disconnect,
        sendData,
        saveDevice,
        loadSavedDevices,
        setScannedDevices,
        deviceHasRequiredService,
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = () => useContext(BluetoothContext);
