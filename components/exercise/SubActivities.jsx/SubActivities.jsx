import {
  View,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import ThemedView from "../../ThemedView";
import ThemedText from "../../ThemedText";
import ThemedCard from "../../ThemedCard";
import { Ionicons } from "@expo/vector-icons";
import { useBt } from "../../../hooks/useBluetooth";
import { useTeamMembers } from "../../../hooks/useTeamMembers";
import { useActivityAttributes } from "../../../hooks/useAttributes";
import { attributesCacheKey } from "../../../hooks/useActivities";
import { activity_attributes } from "../../../api/attributes";
import { Colors } from "../../../constants/Colors";
import { useAuth } from "../../../hooks/useAuth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { t } from "../../../constants/translations";

// ── Message parsing ────────────────────────────────────────────────────────
// Extracts numeric payload after "M", preserving leading zeros.
// 8-char payload → two 4-char values (one per attribute).
// Otherwise → single value fallback.
// Returns: string[] e.g. ["0245", "0180"] or ["04503"]
const parseMessageValues = (receivedData) => {
  const mIndex = receivedData.toUpperCase().indexOf("M");
  if (mIndex === -1) return null;

  const raw = receivedData
    .slice(mIndex + 1)
    .replace(/[oe]$/i, "")
    .trim();
  if (!raw) return null;

  if (raw.length === 8) return [raw.slice(0, 4), raw.slice(4, 8)];
  return [raw];
};

// ── Athlete chip row ───────────────────────────────────────────────────────
// Inline horizontal list of member avatars — tap to select.
// Much faster than a modal when standing outdoors.
const AthleteChips = ({ members, selectedMember, onSelect, theme }) => {
  const { language } = useAuth();
  const getInitials = (firstName = "", lastName = "") =>
    [firstName, lastName]
      .filter(Boolean)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");

  if (!members.length) {
    return (
      <ThemedText style={[styles.chipsEmpty, { color: theme.subtleText }]}>
        {t[language]?.ex_no_team_members || t.en.ex_no_team_members}
      </ThemedText>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      {members.map((member, index) => {
        const isSelected = selectedMember?.id === member?.id;
        console.log(selectedMember);
        return (
          <Pressable
            key={member?.id ?? index}
            onPress={() => onSelect(member)}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected
                  ? Colors.primary
                  : theme.accentSurface,
                borderColor: isSelected ? Colors.primary : theme.border,
              },
            ]}
          >
            {/* Avatar circle */}
            <View
              style={[
                styles.chipAvatar,
                {
                  backgroundColor: isSelected
                    ? "rgba(255,255,255,0.25)"
                    : theme.border,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.chipAvatarText,
                  { color: isSelected ? "#fff" : theme.subtleText },
                ]}
              >
                {getInitials(member?.last_name, member?.first_name)}
              </ThemedText>
            </View>

            {/* Name */}
            <ThemedText
              numberOfLines={1}
              style={[
                styles.chipName,
                { color: isSelected ? "#fff" : theme.text },
              ]}
            >
              {member?.last_name ?? "Unknown"}
            </ThemedText>

            {isSelected && (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color="#fff"
                style={{ marginLeft: 2 }}
              />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
export default function SubActivities({ activity, onBack, theme }) {
  const { selectedTeam, language } = useAuth();
  const subActivities = activity?.activity.sub_activities || [];

  const [active, setActive] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [message, setMessage] = useState([]); // string[] mapped 1:1 to attributes
  const [messages, setMessages] = useState([]); // accumulated readings
  const [current_command, setCurrentCommand] = useState("R1");
  const [hasError, setHasError] = useState(false);
  const [warnNoAthlete, setWarnNoAthlete] = useState(false);

  // ── Pulse animation (no athlete selected warning) ──────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  useEffect(() => {
    if (warnNoAthlete) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [warnNoAthlete]);

  const {
    teamMembers = [],
    selectedMember,
    setSelectedMember,
    isLoading: membersLoading,
  } = useTeamMembers(selectedTeam?.id);

  useEffect(() => {
    if (selectedMember && warnNoAthlete) setWarnNoAthlete(false);
  }, [selectedMember]);

  const { attributes } = useActivityAttributes(activeId);
  const { sendData, receivedData } = useBt();
  const isReady = !membersLoading;

  // ── Prefetch attributes for all sub-activities on mount ────────────────
  useEffect(() => {
    if (!subActivities.length) return;
    const prefetch = async () => {
      await Promise.allSettled(
        subActivities.map(async (sub) => {
          if (!sub?.id) return;
          const cKey = attributesCacheKey(sub.id);
          try {
            const existing = await AsyncStorage.getItem(cKey);
            if (existing) return;
          } catch (_) {}
          try {
            const attrs = await activity_attributes(sub.id);
            await AsyncStorage.setItem(cKey, JSON.stringify(attrs));
          } catch (e) {
            console.warn(
              `[SubActivities] Prefetch failed for ${sub.id}:`,
              e?.message,
            );
          }
        }),
      );
    };
    prefetch();
  }, []);

  // ── Incoming message handler ───────────────────────────────────────────
  useEffect(() => {
    if (!receivedData) return;

    const belongsToCommand = receivedData
      .toUpperCase()
      .startsWith(current_command.toUpperCase());
    if (!belongsToCommand) return;

    const lastChar = receivedData.slice(-1).toLowerCase();
    if (lastChar === "e") setHasError(true);
    else if (lastChar === "o") setHasError(false);

    const values = parseMessageValues(receivedData);
    if (values) {
      setMessage(values);
      if (receivedData.length > 5) {
        setMessages((prev) => [
          ...prev,
          { values, raw: receivedData, timestamp: new Date().toISOString() },
        ]);
      }
    }

    console.log(receivedData, "From the device");
  }, [receivedData, current_command]);

  // ── Command handlers ───────────────────────────────────────────────────
  const handleStart = (sub_activity) => {
    if (!selectedMember) {
      setWarnNoAthlete(true);
      return;
    }

    const command_str = activity.activity.operation_value || "n";
    const send =
      command_str.toUpperCase() + (sub_activity.operation_value || "");
    console.log(send, "sent command");

    setCurrentCommand(command_str.toUpperCase());
    setActive(sub_activity.name);
    setActiveId(sub_activity.id ?? null);
    setHasError(false);
    setMessage([]);
    setMessages([]);
    sendData(send);
  };

  // Stop: send command only — data stays visible
  const handleStop = () => {
    sendData("N");
  };

  // Exit: clear all state — no command sent
  const handleExit = () => {
    setActive(null);
    setActiveId(null);
    setMessage([]);
    setHasError(false);
    setMessages([]);
  };

  // ── Card renderer ──────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const isActive = item.name === active;

    return (
      <ThemedCard
        style={[
          styles.subCard,
          {
            backgroundColor: theme.uiBackground,
            borderColor: isActive && hasError ? Colors.warning : theme.border,
            borderWidth: isActive && hasError ? 2 : 1,
          },
        ]}
      >
        {/* Card header row */}
        <View style={styles.cardHeader}>
          <ThemedText title style={[styles.subName, { color: theme.title }]}>
            {item.name}
          </ThemedText>
          {isActive && (
            <View
              style={[
                styles.activeBadge,
                {
                  backgroundColor: Colors.secondary + "22",
                  borderColor: Colors.secondary,
                },
              ]}
            >
              <View
                style={[
                  styles.activeDot,
                  { backgroundColor: Colors.secondary },
                ]}
              />
              <ThemedText
                style={[styles.activeBadgeText, { color: Colors.secondary }]}
              >
                {t[language]?.sub_active || t.en.sub_active}
              </ThemedText>
            </View>
          )}
        </View>

        {item.description && (
          <ThemedText style={[styles.subDesc, { color: theme.subtleText }]}>
            {item.description}
          </ThemedText>
        )}

        {/* ── Athlete selector — always visible in card ─────────────────
            Inline chips: tap to select, no modal needed.
            Pulses with warning border when no athlete selected on start.  */}
        <View
          style={[
            styles.athleteSection,
            {
              borderColor:
                warnNoAthlete && !selectedMember
                  ? Colors.warning
                  : theme.border,
              backgroundColor: theme.background,
            },
          ]}
        >
          <ThemedText
            style={[styles.athleteLabel, { color: theme.subtleText }]}
          >
            {t[language]?.athlete || t.en.athlete}
          </ThemedText>
          <AthleteChips
            members={teamMembers}
            selectedMember={selectedMember}
            onSelect={setSelectedMember}
            theme={theme}
          />
        </View>

        {/* ── Live attribute readings — shown when active ───────────────
            Each attribute maps to message[index].
            Values are raw strings (leading zeros preserved), unit = ms.  */}
        {isActive && (
          <>
            {attributes.length > 0 ? (
              <View
                style={[
                  styles.attributesRow,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.accentSurface,
                  },
                ]}
              >
                {attributes.map((attr, index) => {
                  const val = message[index] ?? "—";
                  const isLast = index === attributes.length - 1;

                  return (
                    <View
                      key={attr.id}
                      style={[
                        styles.attributeCell,
                        !isLast && {
                          borderRightWidth: StyleSheet.hairlineWidth,
                          borderRightColor: theme.border,
                          marginRight: 12,
                          paddingRight: 12,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.attributeName,
                          { color: theme.subtleText },
                        ]}
                      >
                        {attr.name}
                      </ThemedText>

                      <View style={styles.attributeValueRow}>
                        <ThemedText
                          style={[
                            styles.attributeValue,
                            { color: hasError ? Colors.warning : theme.title },
                          ]}
                        >
                          {val}
                        </ThemedText>
                        {/* Always show ms — values are milliseconds */}
                        <ThemedText
                          style={[
                            styles.attributeUnit,
                            { color: theme.subtleText },
                          ]}
                        >
                          ms
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <ThemedText
                style={[styles.emptyText, { color: theme.subtleText }]}
              >
                {t[language]?.sub_no_attributes || t.en.sub_no_attributes}
              </ThemedText>
            )}

            {/* ── Reading history ──────────────────────────────────────── 
                Chronological order (oldest first, newest at bottom).
                No timestamp shown. Values in ms with leading zeros.       */}
            {messages.length > 0 && (
              <View style={styles.historyContainer}>
                <View style={styles.historyHeader}>
                  <ThemedText
                    style={[styles.historyLabel, { color: theme.subtleText }]}
                  >
                    {t[language]?.sub_readings || t.en.sub_readings} (
                    {messages.length})
                  </ThemedText>
                  <Pressable
                    onPress={() => {
                      setMessages([]);
                      setMessage([]);
                      setHasError(false);
                    }}
                    style={[
                      styles.clearButton,
                      {
                        backgroundColor: theme.uiBackground,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.clearButtonText,
                        { color: theme.subtleText },
                      ]}
                    >
                      {t[language]?.sub_clear || t.en.sub_clear}
                    </ThemedText>
                  </Pressable>
                </View>

                {/* Oldest first — newest at bottom */}
                {messages.map((msg, index) => {
                  const isNewest = index === messages.length - 1;
                  return (
                    <View
                      key={msg.timestamp}
                      style={[
                        styles.historyRow,
                        {
                          borderBottomColor: theme.border,
                          backgroundColor: isNewest
                            ? theme.accentSurface
                            : "transparent",
                          borderRadius: isNewest ? 6 : 0,
                          paddingHorizontal: isNewest ? 8 : 0,
                        },
                      ]}
                    >
                      <View style={styles.historyValues}>
                        {msg.values.map((v, vi) => (
                          <ThemedText
                            key={vi}
                            style={[
                              styles.historyValue,
                              {
                                color: isNewest
                                  ? hasError
                                    ? Colors.warning
                                    : Colors.primary
                                  : theme.text,
                                fontWeight: isNewest ? "700" : "400",
                              },
                            ]}
                          >
                            {/* Raw string — leading zeros preserved */}
                            {v} ms{vi < msg.values.length - 1 ? "  ·  " : ""}
                          </ThemedText>
                        ))}
                      </View>

                      {/* Reading index instead of time */}
                      <ThemedText
                        style={[
                          styles.historyIndex,
                          { color: theme.subtleText },
                        ]}
                      >
                        #{index + 1}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Stop + Exit buttons ──────────────────────────────────── */}
            <View style={styles.actionRow}>
              {/* Stop: sends N, keeps data */}
              <Pressable
                onPress={handleStop}
                style={[
                  styles.actionButton,
                  { backgroundColor: Colors.warning, flex: 1 },
                ]}
              >
                <Ionicons name="stop-circle-outline" size={16} color="#fff" />
                <ThemedText style={styles.actionButtonText}>
                  {t[language]?.stop || t.en.stop}
                </ThemedText>
              </Pressable>

              {/* Exit: clears state, no command */}
              <Pressable
                onPress={handleExit}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: theme.uiBackground,
                    borderColor: theme.border,
                    borderWidth: 1,
                    flex: 1,
                  },
                ]}
              >
                <Ionicons name="close-outline" size={16} color={theme.text} />
                <ThemedText
                  style={[styles.actionButtonText, { color: theme.text }]}
                >
                  {t[language]?.exit || t.en.exit}
                </ThemedText>
              </Pressable>
            </View>
          </>
        )}

        {/* Start button — only shown when not active */}
        {!isActive && (
          <Pressable
            onPress={() => handleStart(item)}
            style={[styles.startButton, { backgroundColor: Colors.primary }]}
          >
            <ThemedText style={styles.startButtonText}>
              {t[language]?.start || t.en.start}
            </ThemedText>
          </Pressable>
        )}
      </ThemedCard>
    );
  };

  return (
    <ThemedView safe style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.iconColor} />
        </Pressable>

        <ThemedText
          title
          numberOfLines={1}
          style={[styles.title, { color: theme.title }]}
        >
          {activity.activity.name}
        </ThemedText>
      </View>

      {/* ── Global loading gate ──────────────────────────────────────────── */}
      {!isReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.subtleText }]}>
            {t[language]?.sub_loading_team || t.en.sub_loading_team}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={subActivities}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 10,
    gap: 8,
  },
  backButton: { padding: 6 },
  title: { flex: 1, fontSize: 18, fontWeight: "700" },

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14 },

  // ── Sub-activity card ────────────────────────────────────────────────────
  subCard: { padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1 },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  subName: { fontSize: 15, fontWeight: "600", flex: 1 },
  subDesc: { fontSize: 12, marginBottom: 10, lineHeight: 17 },

  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeBadgeText: { fontSize: 10, fontWeight: "700" },

  // ── Athlete section ──────────────────────────────────────────────────────
  athleteSection: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  athleteLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  // ── Athlete chips ────────────────────────────────────────────────────────
  chipsRow: { gap: 8, paddingRight: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  chipAvatarText: { fontSize: 9, fontWeight: "700" },
  chipName: { fontSize: 13, fontWeight: "500", maxWidth: 80 },
  chipsEmpty: { fontSize: 12, paddingVertical: 4 },

  // ── Attributes — inline flex row ─────────────────────────────────────────
  attributesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  attributeCell: { flex: 1 },
  attributeName: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  attributeValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  attributeValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  attributeUnit: { fontSize: 13, fontWeight: "600" },

  // ── History ──────────────────────────────────────────────────────────────
  historyContainer: { marginBottom: 10 },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  historyLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyValues: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  historyValue: { fontSize: 17 }, // bumped from 14
  historyIndex: { fontSize: 10 }, // replaces historyTime

  // ── Clear button ─────────────────────────────────────────────────────────
  clearButton: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  clearButtonText: { fontSize: 11, fontWeight: "500" },

  // ── Stop + Exit action row ───────────────────────────────────────────────
  actionRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  // ── Start button ─────────────────────────────────────────────────────────
  startButton: {
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  startButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  // ── Empty ────────────────────────────────────────────────────────────────
  emptyText: { fontSize: 12, paddingVertical: 10 },
});
