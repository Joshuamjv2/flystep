// screens/ExerciseScreen.js
import { useEffect, useState, useRef } from "react";
import { useColorScheme, BackHandler, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { useBt } from "../../hooks/useBluetooth";
import { useAuth } from "../../hooks/useAuth";
import BtDevices from "../../components/exercise/BTSDevices.jsx";
import ActivitySession from "../../components/exercise/ActivitySession.jsx";
import ThemedView from "../../components/ThemedView";
import ThemedText from "../../components/ThemedText";
import ThemedCard from "../../components/ThemedCard";
import { handleBLEError } from "../../utils/bleErrorHandler.js";
import { t } from "../../constants/translations";

export default function ExerciseScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [selectedDevice, setSelectedDevice] = useState(null);
  const selectedDeviceRef = useRef(selectedDevice);

  // Get user data to check for devices
  const { user, language } = useAuth();

  // ── Auto-connect gate ──────────────────────────────────────────────────
  // If user explicitly disconnects, we block auto-connect until they
  // manually connect again.
  const userDisconnectedRef = useRef(false);

  // Keep ref in sync for use inside BackHandler closure
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  const {
    savedDevices,
    scannedDevices,
    isScanning,
    startScan,
    connectToDevice,
    connectingDeviceId,
    connectedDevice,
    deviceCharacteristics,
    disconnect,
    forgetDevice,
  } = useBt();

  // ── Back button: prevent app exit when on devices view ────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!selectedDeviceRef.current) {
        return true;
      }
      return false;
    });

    return () => handler.remove();
  }, []);

  // ── Auto scan on mount if no saved devices ────────────────────────────
  useEffect(() => {
    if (!savedDevices || savedDevices.length === 0) startScan();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleDeviceSelect = async (device) => {
    try {
      await connectToDevice(device);

      // Successful manual connect — re-enable auto-connect
      userDisconnectedRef.current = false;

      setSelectedDevice(device);
      return true;
    } catch (error) {
      console.log("[Exercise] Connection failed:", error);
      handleBLEError(error, "device_select", true);
      return false;
    }
  };

  const handleDisconnect = async () => {
    // User explicitly disconnected → disable auto reconnect
    userDisconnectedRef.current = true;

    try {
      await disconnect();
    } catch (error) {
      console.log("[Exercise] Disconnect error:", error);
      handleBLEError(error, "disconnect", false);
    } finally {
      setSelectedDevice(null);
    }
  };

  const handleForgetDevice = async (device) => {
    try {
      await forgetDevice(device);

      if (selectedDevice?.id === device.id) {
        userDisconnectedRef.current = true;
        setSelectedDevice(null);
      }
    } catch (error) {
      console.log("[Exercise] Forget device error:", error);
      handleBLEError(error, "forget_device", false);
    }
  };

  // ── Check if user has registered devices ───────────────────────────────
  const hasUserDevices = user?.devices && user.devices.length > 0;

  // ── Render No Devices UI ───────────────────────────────────────────────
  if (!hasUserDevices) {
    return (
      <ThemedView safe style={styles.noDevicesContainer}>
        <View style={styles.noDevicesContent}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: theme.accentSurface },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={64}
              color={theme.title}
            />
          </View>

          <ThemedText
            title
            style={[styles.noDevicesTitle, { color: theme.title }]}
          >
            {t[language]?.ex_no_devices_title || t.en.ex_no_devices_title}
          </ThemedText>

          <ThemedCard
            style={[
              styles.noDevicesCard,
              { backgroundColor: theme.uiBackground },
            ]}
          >
            <Ionicons
              name="bluetooth-outline"
              size={28}
              color={theme.iconColor}
            />
            <ThemedText
              style={[
                styles.noDevicesText,
                { color: theme.subtleText, textAlign: "center" },
              ]}
            >
              {t[language]?.ex_no_devices_desc || t.en.ex_no_devices_desc}
            </ThemedText>
          </ThemedCard>

          <ThemedCard
            style={[styles.infoCard, { backgroundColor: theme.accentSurface }]}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={theme.iconColor}
            />
            <View style={styles.infoTextContainer}>
              <ThemedText
                style={[styles.infoText, { color: theme.subtleText }]}
              >
                {t[language]?.ex_no_devices_contact ||
                  t.en.ex_no_devices_contact}
              </ThemedText>
            </View>
          </ThemedCard>
        </View>
      </ThemedView>
    );
  }

  // ── Render normal flow ─────────────────────────────────────────────────
  if (selectedDevice) {
    return (
      <ActivitySession
        device={selectedDevice}
        connectedDevice={connectedDevice}
        deviceCharacteristics={deviceCharacteristics}
        onDisconnect={handleDisconnect}
        theme={theme}
        clearBuffersIfNoReadings={() => {}} // Add this if needed
      />
    );
  }

  return (
    <BtDevices
      savedDevices={savedDevices}
      scannedDevices={scannedDevices}
      isScanning={isScanning}
      connectingDeviceId={connectingDeviceId}
      connectedDevice={connectedDevice}
      onStartScan={startScan}
      onDeviceSelect={handleDeviceSelect}
      onForgetDevice={handleForgetDevice}
      onDisconnect={handleDisconnect}
      onNavigateToActivities={(device) => setSelectedDevice(device)}
      disableAutoConnect={userDisconnectedRef.current}
      theme={theme}
    />
  );
}

const styles = StyleSheet.create({
  noDevicesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  noDevicesContent: {
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  noDevicesTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  noDevicesCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    width: "100%",
  },
  noDevicesText: {
    fontSize: 16,
    flex: 1,
    lineHeight: 22,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    width: "100%",
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
