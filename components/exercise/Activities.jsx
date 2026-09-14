// components/exercise/Activities.jsx
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  FlatList,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedView from "../ThemedView";
import ThemedText from "../ThemedText";
import ThemedCard from "../ThemedCard";
import { useAuth } from "../../hooks/useAuth";
import { useActivities } from "../../hooks/useActivities"; // ← new hook
import SubActivities from "./SubActivities.jsx/SubActivities";
import { t } from "../../constants/translations";

export default function Activities({
  device,
  connectedDevice,
  deviceCharacteristics,
  onDisconnect,
  theme,
}) {
  const [selectedActivity, setSelectedActivity] = useState(null);
  const isRealDevice = device && !device.isSimulated;
  const { deviceTypes, language } = useAuth();
  const isMounted = useRef(true);
  const isDisconnecting = useRef(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const backAction = () => {
      handleBackPress();
      return true;
    };
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );
    return () => backHandler.remove();
  }, []);

  // Match device name to a device type to get its ID
  const selectedDeviceType = deviceTypes.find(
    (dt) => dt.name?.toLowerCase() === device?.name?.toLowerCase(),
  );

  // ─ Cache-first activities
  // Shows cached data instantly, refreshes from API in background
  const {
    activities: deviceActivities,
    isLoading,
    error,
  } = useActivities(selectedDeviceType?.id, language);

  const handleBackPress = () => {
    if (isDisconnecting.current) return;
    if (selectedActivity) {
      setSelectedActivity(null);
    } else {
      handleDisconnect();
    }
  };

  const handleDisconnect = async () => {
    if (isDisconnecting.current) return;
    isDisconnecting.current = true;
    try {
      await onDisconnect();
    } catch (error) {
      console.log("[Activities] Disconnect error:", error);
    } finally {
      if (isMounted.current) isDisconnecting.current = false;
    }
  };

  if (selectedActivity) {
    return (
      <SubActivities
        activity={selectedActivity}
        theme={theme}
        onBack={() => setSelectedActivity(null)}
        device={device}
        deviceCharacteristics={deviceCharacteristics}
      />
    );
  }

  const renderActivityItem = ({ item }) => (
    <Pressable
      onPress={() => setSelectedActivity(item)}
      style={({ pressed }) => [
        styles.activityCard,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <ThemedCard style={styles.activityCardInner}>
        <View style={styles.activityContent}>
          <ThemedText title style={styles.activityName}>
            {item.activity.name}
          </ThemedText>

          {item.activity.description && (
            <ThemedText style={styles.activityDescription}>
              {item.activity.description}
            </ThemedText>
          )}

          {item.duration && (
            <View style={styles.activityMeta}>
              <Ionicons name="time-outline" size={14} color={theme.iconColor} />
              <ThemedText style={styles.activityDuration}>
                {item.duration}
              </ThemedText>
            </View>
          )}
        </View>
      </ThemedCard>
    </Pressable>
  );

  return (
    <ThemedView safe style={styles.container}>
      {/* HEADER */}
      <ThemedView style={styles.header}>
        <Pressable
          onPress={handleBackPress}
          style={styles.backButton}
          disabled={isDisconnecting.current}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDisconnecting.current ? theme.subtleText : theme.iconColor}
          />
        </Pressable>

        <ThemedText title style={styles.title}>
          {device?.name}{" "}
          {t[language]?.ex_activities_title
            ?.toLowerCase()
            .replace("available ", "") ||
            t.en.ex_activities_title.toLowerCase().replace("available ", "")}
        </ThemedText>

        <View style={styles.connectionStatus}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isDisconnecting.current
                  ? theme.subtleText
                  : "#23aeb7",
              },
            ]}
          />
          <ThemedText style={styles.statusText}>
            {isDisconnecting.current
              ? t[language]?.ex_disconnect_status || t.en.ex_disconnect_status
              : isRealDevice
                ? t[language]?.ex_connected || t.en.ex_connected
                : t[language]?.ex_simulated || t.en.ex_simulated}
          </ThemedText>
        </View>
      </ThemedView>

      {/* DEVICE INFO */}
      <ThemedCard style={styles.deviceInfoCard}>
        <ThemedView style={styles.deviceHeader}>
          <Ionicons
            name="fitness-outline"
            size={32}
            color={isDisconnecting.current ? theme.subtleText : theme.iconColor}
          />
          <View style={styles.deviceDetails}>
            <ThemedText title style={styles.deviceName}>
              {device?.name}
              {isDisconnecting.current &&
                ` (${t[language]?.ex_disconnect_status || t.en.ex_disconnect_status})`}
            </ThemedText>
            <ThemedText style={styles.deviceModel}>
              {isDisconnecting.current
                ? t[language]?.ex_disconnect_status || t.en.ex_disconnect_status
                : isRealDevice
                  ? "BLE Connected"
                  : t[language]?.ex_simulated || t.en.ex_simulated}
            </ThemedText>
            {isRealDevice &&
              deviceCharacteristics &&
              !isDisconnecting.current && (
                <ThemedText style={styles.bleInfo}>
                  Service:{" "}
                  {deviceCharacteristics.service ? "Available" : "Not Found"}
                  {deviceCharacteristics.rx && " • TX Ready"}
                  {deviceCharacteristics.tx && " • RX Ready"}
                </ThemedText>
              )}
          </View>
        </ThemedView>
      </ThemedCard>

      {/* ACTIVITIES LIST */}
      <ThemedText title style={styles.sectionLabel}>
        {t[language]?.ex_activities_title || t.en.ex_activities_title}
      </ThemedText>

      {/* Show spinner only on first load with no cache — if cache exists,
          isLoading is false before the API call even returns */}
      {isLoading && deviceActivities.length === 0 ? (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.iconColor} />
          <ThemedText style={styles.loadingText}>
            {t[language]?.ex_loading_activities || t.en.ex_loading_activities}
          </ThemedText>
        </ThemedView>
      ) : deviceActivities.length > 0 ? (
        <FlatList
          data={deviceActivities}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderActivityItem}
          numColumns={2}
          columnWrapperStyle={styles.activitiesGrid}
          contentContainerStyle={styles.activitiesList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ThemedView style={styles.emptyContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.iconColor}
          />
          <ThemedText style={styles.emptyText}>
            {t[language]?.ex_no_activities || t.en.ex_no_activities}
          </ThemedText>
        </ThemedView>
      )}

      {/* Disconnecting overlay */}
      {isDisconnecting.current && (
        <View style={styles.disconnectingOverlay}>
          <ActivityIndicator size="large" color={theme.iconColor} />
          <ThemedText style={styles.disconnectingText}>
            {t[language]?.ex_disconnect_from_device ||
              t.en.ex_disconnect_from_device}
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    position: "relative",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 10,
    marginBottom: 25,
  },
  deviceName: { textTransform: "capitalize" },
  backButton: { padding: 8 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    textTransform: "capitalize",
  },
  connectionStatus: { flexDirection: "row", alignItems: "center" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, opacity: 0.7, textTransform: "capitalize" },
  deviceInfoCard: { padding: 16, marginBottom: 20 },
  deviceHeader: { flexDirection: "row", alignItems: "center" },
  deviceDetails: { marginLeft: 12, flex: 1 },
  deviceModel: { fontSize: 14, opacity: 0.7, marginTop: 2 },
  bleInfo: { fontSize: 12, opacity: 0.6, marginTop: 4 },
  sectionLabel: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, opacity: 0.7 },
  activitiesList: { paddingBottom: 20 },
  activitiesGrid: { justifyContent: "space-between" },
  activityCard: { width: "48%", marginBottom: 16 },
  activityCardInner: {
    padding: 16,
    borderRadius: 12,
    height: 140,
    justifyContent: "center",
  },
  activityContent: { alignItems: "center", justifyContent: "center", flex: 1 },
  activityName: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  activityDescription: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 16,
  },
  activityMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  activityDuration: { fontSize: 11, opacity: 0.6, marginLeft: 4 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: { fontSize: 16, opacity: 0.7, textAlign: "center", marginTop: 16 },
  disconnectingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  disconnectingText: {
    color: "white",
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
});
