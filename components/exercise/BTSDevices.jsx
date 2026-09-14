import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import ThemedView from "../ThemedView";
import ThemedText from "../ThemedText";
import ThemedCard from "../ThemedCard";
import { useBt } from "../../hooks/useBluetooth";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../hooks/useAuth";
import { t } from "../../constants/translations";

const AUTO_CONNECT_TIMEOUT_MS = 7000;

// ── DeviceCard ─────────────────────────────────────────────────────────────
const DeviceCard = memo(
  ({
    device,
    saved,
    connectingDeviceId,
    autoConnectingId,
    connectedDevice,
    theme,
    onDevicePress,
    onConnectedDevicePress,
    onForgetPress,
    onDisconnect,
    isSmallPhone,
  }) => {
    const { language } = useAuth();
    const isConnecting = connectingDeviceId === device.id;
    const isAutoConnecting = autoConnectingId === device.id;
    const isConnected = connectedDevice?.id === device.id;
    const isBusy = isConnecting || isAutoConnecting;

    console.log("\n\n", "Language : \n", language, "\n\n")

    return (
      <Pressable
        onPress={() => {
          if (isBusy) return;
          if (isConnected) {
            onConnectedDevicePress(device);
            return;
          }
          onDevicePress(device);
        }}
        onLongPress={() => saved && !isBusy && onForgetPress(device)}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <ThemedCard
          style={[
            styles.deviceCard,
            isSmallPhone && styles.deviceCardSmall,
            isConnected && styles.connectedDeviceCard,
          ]}
        >
          <View style={styles.iconLeft}>
            <Ionicons
              name={saved ? "bookmark-outline" : "bluetooth-outline"}
              size={isSmallPhone ? 20 : 24}
              color={theme.iconColor}
            />
          </View>

          <View style={styles.deviceInfo}>
            <ThemedText
              title
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.deviceName,
                isSmallPhone && styles.deviceNameSmall,
              ]}
            >
              {device.name || "Unnamed Device"}
              {isConnected &&
                ` • ${t[language]?.ex_connected || t.en.ex_connected}`}
            </ThemedText>

            <ThemedText
              numberOfLines={1}
              ellipsizeMode="middle"
              style={[styles.deviceId, isSmallPhone && styles.deviceIdSmall]}
            >
              {device.id}
              {device.isSimulated &&
                ` • ${t[language]?.ex_simulated || t.en.ex_simulated}`}
            </ThemedText>
          </View>

          {isBusy ? (
            <View style={styles.connectingRow}>
              <ActivityIndicator size="small" color={theme.iconColor} />
              <ThemedText
                style={[
                  styles.connectingLabel,
                  isSmallPhone && styles.connectingLabelSmall,
                ]}
              >
                {isAutoConnecting
                  ? t[language]?.auto_connecting || t.en.auto_connecting
                  : t[language]?.connecting || t.en.connecting}
              </ThemedText>
            </View>
          ) : isConnected ? (
            <View style={styles.ctaRow}>
              {saved && (
                <Pressable
                  hitSlop={8}
                  onPress={() => onForgetPress(device)}
                  style={({ pressed }) => [
                    styles.ctaButton,
                    styles.ctaForget,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
                  {!isSmallPhone && (
                    <ThemedText style={[styles.ctaLabel, { color: "#FF6B6B" }]}>
                      {t[language]?.forget_device || t.en.forget_device}
                    </ThemedText>
                  )}
                </Pressable>
              )}

              <Pressable
                hitSlop={8}
                onPress={() => onDisconnect(device)}
                style={({ pressed }) => [
                  styles.ctaButton,
                  styles.ctaDisconnect,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={14}
                  color="#FF9800"
                />
                {!isSmallPhone && (
                  <ThemedText style={[styles.ctaLabel, { color: "#FF9800" }]}>
                    {t[language]?.disconnect_device || t.en.disconnect_device}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          ) : (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.iconColor}
              style={{ opacity: 0.4 }}
            />
          )}
        </ThemedCard>
      </Pressable>
    );
  },
);

// ── BtDevices ──────────────────────────────────────────────────────────────
export default function BtDevices({
  savedDevices,
  scannedDevices,
  isScanning,
  connectingDeviceId,
  connectedDevice,
  onStartScan,
  onDeviceSelect,
  onForgetDevice,
  onDisconnect,
  onNavigateToActivities,
  disableAutoConnect = false,
  theme,
}) {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 360 || height < 700;
  const { language } = useAuth();

  const { bleState } = useBt();
  const bleOff = bleState === "PoweredOff";

  const [autoConnectingId, setAutoConnectingId] = useState(null);

  const isMounted = useRef(true);
  const connectedDeviceRef = useRef(connectedDevice);
  const autoConnectingRef = useRef(false);
  const hasAutoConnected = useRef(false);

  useEffect(() => {
    connectedDeviceRef.current = connectedDevice;
  }, [connectedDevice]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ── Auto scan on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!savedDevices.length) return;
    if (connectedDeviceRef.current) return;
    if (bleOff) return;
    if (disableAutoConnect) return;
    onStartScan();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-connect when a saved device appears in scan results ──────────
  useEffect(() => {
    if (!scannedDevices.length) return;
    if (!savedDevices.length) return;
    if (connectedDeviceRef.current) return;
    if (autoConnectingRef.current) return;
    if (hasAutoConnected.current) return;
    if (bleOff) return;
    if (disableAutoConnect) return;

    const match = scannedDevices.find((scanned) =>
      savedDevices.some((saved) => saved.id === scanned.id),
    );
    if (!match) return;

    autoConnectingRef.current = true;
    hasAutoConnected.current = true;

    const attempt = async () => {
      if (!isMounted.current) return;
      setAutoConnectingId(match.id);

      try {
        const success = await Promise.race([
          onDeviceSelect(match),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Auto-connect timed out")),
              AUTO_CONNECT_TIMEOUT_MS,
            ),
          ),
        ]);

        if (!success && isMounted.current) {
          console.log(
            "[AutoConnect] Device found but connection returned false",
          );
        }
      } catch (err) {
        console.log("[AutoConnect] Failed:", err?.message);
      } finally {
        if (isMounted.current) setAutoConnectingId(null);
        autoConnectingRef.current = false;
      }
    };

    attempt();
  }, [scannedDevices]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleDevicePress = useCallback(
    async (device) => {
      if (bleOff) {
        Alert.alert(
          t[language]?.bluetooth_off_title || t.en.bluetooth_off_title,
          t[language]?.bluetooth_off_connect_message ||
            t.en.bluetooth_off_connect_message,
          [{ text: t[language]?.cancel || t.en.cancel }],
        );
        return;
      }

      try {
        const success = await onDeviceSelect(device);
        if (!success)
          Alert.alert(
            t[language]?.connection_failed_title ||
              t.en.connection_failed_title,
            t[language]?.connect_failed_message || t.en.connect_failed_message,
          );
      } catch (err) {
        Alert.alert(
          t[language]?.connection_error_title || t.en.connection_error_title,
          err?.message ??
            (t[language]?.connection_error_message ||
              t.en.connection_error_message),
        );
      }
    },
    [onDeviceSelect, bleOff, language],
  );

  const handleConnectedDevicePress = useCallback(
    (device) => {
      onNavigateToActivities?.(device);
    },
    [onNavigateToActivities],
  );

  const handleForgetPress = useCallback(
    (device) => {
      Alert.alert(
        t[language]?.forget_device_title || t.en.forget_device_title,
        t[language]?.forget_device_message || t.en.forget_device_message,
        [
          { text: t[language]?.cancel || t.en.cancel, style: "cancel" },
          {
            text: t[language]?.forget_device || t.en.forget_device,
            style: "destructive",
            onPress: () => onForgetDevice(device),
          },
        ],
      );
    },
    [onForgetDevice, language],
  );

  const handleDisconnect = useCallback(
    (device) => {
      Alert.alert(
        t[language]?.disconnect_title || t.en.disconnect_title,
        t[language]?.disconnect_message || t.en.disconnect_message,
        [
          { text: t[language]?.cancel || t.en.cancel, style: "cancel" },
          {
            text: t[language]?.disconnect_device || t.en.disconnect_device,
            style: "destructive",
            onPress: () => onDisconnect(device),
          },
        ],
      );
    },
    [onDisconnect, language],
  );

  const cardProps = useMemo(
    () => ({
      connectingDeviceId,
      autoConnectingId,
      connectedDevice,
      theme,
      onDevicePress: handleDevicePress,
      onConnectedDevicePress: handleConnectedDevicePress,
      onForgetPress: handleForgetPress,
      onDisconnect: handleDisconnect,
      isSmallPhone,
    }),
    [
      connectingDeviceId,
      autoConnectingId,
      connectedDevice,
      theme,
      handleDevicePress,
      handleConnectedDevicePress,
      handleForgetPress,
      handleDisconnect,
      isSmallPhone,
    ],
  );

  const renderSaved = useCallback(
    ({ item }) => <DeviceCard device={item} saved {...cardProps} />,
    [cardProps],
  );

  const renderScanned = useCallback(
    ({ item }) => <DeviceCard device={item} saved={false} {...cardProps} />,
    [cardProps],
  );

  return (
    <ThemedView
      safe
      style={[styles.container, isSmallPhone && styles.containerSmall]}
    >
      <ThemedText
        title
        style={[styles.header, isSmallPhone && styles.headerSmall]}
      >
        {t[language]?.bluetooth_devices_title || t.en.bluetooth_devices_title}
      </ThemedText>

      {bleOff && (
        <View style={styles.bleBanner}>
          <Ionicons name="bluetooth-outline" size={16} color="#fff" />
          <ThemedText style={styles.bleBannerText}>
            {t[language]?.bluetooth_off_message || t.en.bluetooth_off_message}
          </ThemedText>
        </View>
      )}

      <View style={styles.sectionsContainer}>
        <View style={styles.sectionHalf}>
          <ThemedText
            title
            style={[
              styles.sectionLabel,
              isSmallPhone && styles.sectionLabelSmall,
            ]}
          >
            {t[language]?.saved_devices || t.en.saved_devices}
          </ThemedText>

          <FlatList
            data={savedDevices}
            keyExtractor={(item) => item.id}
            renderItem={renderSaved}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingBottom: 10,
              flexGrow: savedDevices.length === 0 ? 1 : 0,
            }}
            ListEmptyComponent={
              <ThemedText style={styles.emptyState}>
                {t[language]?.no_saved_devices || t.en.no_saved_devices}
              </ThemedText>
            }
          />
        </View>

        <View style={styles.sectionHalf}>
          <ThemedText
            title
            style={[
              styles.sectionLabel,
              isSmallPhone && styles.sectionLabelSmall,
            ]}
          >
            {t[language]?.available_devices || t.en.available_devices}
          </ThemedText>

          {isScanning && (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color={theme.iconColor} />
              <ThemedText style={styles.scanText}>
                {t[language]?.scanning || t.en.scanning}
              </ThemedText>
            </View>
          )}

          <FlatList
            data={scannedDevices}
            keyExtractor={(item) => item.id}
            renderItem={renderScanned}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingBottom: 80,
              flexGrow: scannedDevices.length === 0 ? 1 : 0,
            }}
            ListEmptyComponent={
              !isScanning ? (
                <ThemedText style={styles.emptyState}>
                  {t[language]?.no_devices_found || t.en.no_devices_found}
                </ThemedText>
              ) : null
            }
          />
        </View>
      </View>

      <Pressable
        onPress={() => {
          if (bleOff) {
            Alert.alert(
              t[language]?.bluetooth_off_title || t.en.bluetooth_off_title,
              t[language]?.bluetooth_off_scan_message ||
                t.en.bluetooth_off_scan_message,
            );
            return;
          }
          onStartScan();
        }}
        style={({ pressed }) => [
          styles.fab,
          isSmallPhone && styles.fabSmall,
          { opacity: pressed ? 0.5 : bleOff ? 0.4 : 1 },
        ]}
      >
        <Ionicons name="search-outline" size={26} color={theme.iconColor} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  containerSmall: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 6 },

  header: { fontSize: 24, fontWeight: "700", marginTop: 10, marginBottom: 18 },
  headerSmall: { fontSize: 20, marginBottom: 12 },

  bleBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.warning,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  bleBannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  sectionsContainer: { flex: 1, gap: 10 },
  sectionHalf: { flex: 1 },
  sectionLabel: { fontSize: 16, fontWeight: "600", marginBottom: 10 },
  sectionLabelSmall: { fontSize: 14, marginBottom: 8 },

  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderRadius: 12,
  },
  deviceCardSmall: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  connectedDeviceCard: { borderColor: "#4CAF50", borderWidth: 1.5 },

  iconLeft: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  deviceInfo: { flex: 1, minWidth: 0 },
  deviceName: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  deviceNameSmall: { fontSize: 14 },
  deviceId: { fontSize: 12, opacity: 0.6, marginTop: 2, flexShrink: 1 },
  deviceIdSmall: { fontSize: 11 },

  scanningRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  scanText: { marginLeft: 8, fontSize: 14, opacity: 0.7 },

  emptyState: {
    textAlign: "center",
    paddingVertical: 20,
    fontSize: 14,
    opacity: 0.6,
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  fabSmall: { right: 14, bottom: 18, width: 52, height: 52, borderRadius: 26 },

  connectingRow: { flexDirection: "row", alignItems: "center" },
  connectingLabel: { marginLeft: 6, opacity: 0.7, fontSize: 13 },
  connectingLabelSmall: { fontSize: 11 },

  ctaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ctaForget: { backgroundColor: "rgba(255,107,107,0.1)" },
  ctaDisconnect: { backgroundColor: "rgba(255,152,0,0.1)" },
  ctaLabel: { fontSize: 12, fontWeight: "600" },
});
