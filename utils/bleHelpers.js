// utils/bleHelpers.js
import {
  C_SERVICE_UUID,
  C_CHARACTERISTIC_UUID_RX,
  C_CHARACTERISTIC_UUID_TX,
} from "../ble/BleProvider";

// Helper to convert string to base64 (since btoa isn't available in React Native)
export const stringToBase64 = (str) => {
  return Buffer.from(str).toString("base64");
};

// Helper to convert base64 to string
export const base64ToString = (base64) => {
  return Buffer.from(base64, "base64").toString("ascii");
};

// Check if a device matches your expected service
export const isCompatibleDevice = (device) => {
  // You might want to check device name, service UUIDs, or other identifiers
  return (
    device.name?.toLowerCase().includes("flystep") ||
    device.name?.toLowerCase().includes("your-device-name")
  );
};
