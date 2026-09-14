// utils/bleErrorHandler.js

import { Alert, Platform } from "react-native";

// Track if we're in production
const isProduction = !__DEV__;

// Don't show duplicate alerts for the same error within 2 seconds
const recentErrors = new Map();

export const handleBLEError = (error, context = "", showAlert = false) => {
  const errorKey = `${context}_${error?.message || "unknown"}`;
  const now = Date.now();

  // Prevent duplicate alerts in quick succession
  if (recentErrors.has(errorKey) && now - recentErrors.get(errorKey) < 2000) {
    return;
  }

  recentErrors.set(errorKey, now);
  setTimeout(() => recentErrors.delete(errorKey), 2000);

  // Always log the error
  console.error(`[BLE Error][${context}]:`, error?.message || error);

  // Only show alerts for user-facing errors
  const shouldShowAlert =
    showAlert && (context === "connect" || context === "permissions");

  if (shouldShowAlert) {
    let message = "An unexpected error occurred";
    let title = "Connection Error";

    if (error?.message) {
      const msg = error.message.toLowerCase();
      if (msg.includes("timeout")) {
        message = "Connection timed out. Please try again.";
      } else if (
        msg.includes("bluetooth is off") ||
        msg.includes("powered off")
      ) {
        message = "Please turn on Bluetooth to continue.";
        title = "Bluetooth Off";
      } else if (msg.includes("permission")) {
        message = "Bluetooth permission required. Please grant permission.";
      }
    }

    Alert.alert(title, message, [{ text: "OK" }]);
  }
};

// Setup global error handlers
export const setupGlobalBLEErrorHandling = () => {
  if (Platform.OS !== "web" && ErrorUtils) {
    const originalHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error, isFatal) => {
      const errorMessage = error?.message?.toLowerCase() || "";

      if (
        errorMessage.includes("ble") ||
        errorMessage.includes("bluetooth") ||
        errorMessage.includes("connection")
      ) {
        console.log("BLE Error caught by global handler:", error);

        if (isFatal && !isProduction) {
          Alert.alert(
            "Connection Error",
            "There was a problem with the Bluetooth connection.",
            [{ text: "OK" }],
          );
        }
      } else {
        originalHandler(error, isFatal);
      }
    });
  }
};
