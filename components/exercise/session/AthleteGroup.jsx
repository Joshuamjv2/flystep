// components/exercise/session/AthleteGroup.jsx
//
// History row display MUST match ReadingsCard order (meta.liveOrder).
// We render values dynamically based on getActivityMeta().liveOrder.

import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedText from "../../ThemedText";
import { Colors } from "../../../constants/Colors";
import {
  getActivityMeta,
  getAttributeValue,
  findAttributeLabel,
} from "./ParseMessage";
import { t } from "../../../constants/translations";
import { useAuth } from "../../../hooks/useAuth";

// ── Single value line inside a reading row ─────────────────────────────────
const ValueLine = ({ label, value, unit, theme, accent = false }) => (
  <View style={styles.valueLine}>
    <ThemedText style={[styles.attrName, { color: theme.subtleText }]}>
      {label}
    </ThemedText>

    <ThemedText
      style={[
        styles.attrValue,
        { color: accent ? Colors.secondary : theme.text },
      ]}
    >
      {value != null ? `${value} ${unit ?? ""}`.trim() : "—"}
    </ThemedText>
  </View>
);

// ── Single reading row ─────────────────────────────────────────────────────
const ReadingRow = ({
  msg,
  index,
  activityCommand,
  attributes,
  theme,
  onRemove,
  athleteId,
}) => {
  const meta = getActivityMeta(activityCommand);
  const parsed = msg?.parsed ?? {};
  const derived = parsed?.derived ?? {};

  const mergedParsed = {
    ...parsed,
    derived: {
      heightCm: derived.heightCm ?? parsed.heightCm ?? null,
      distanceCm: derived.distanceCm ?? parsed.distanceCm ?? null,
      power: derived.power ?? parsed.power ?? null,
    },
  };

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      {/* Index */}
      <ThemedText style={[styles.rowIndex, { color: theme.subtleText }]}>
        #{index + 1}
      </ThemedText>

      <View style={styles.valuesColumn}>
        {(meta.liveOrder ?? []).map((key) => {
          const { value, unit } = getAttributeValue(key, mergedParsed);

          const apiLabel = findAttributeLabel(attributes, key);

          const finalLabel =
            key === "height"
              ? (apiLabel ?? "height")
              : key === "power"
                ? (apiLabel ?? "power")
                : key === "distance"
                  ? (apiLabel ?? "distance")
                  : apiLabel;

          return (
            <ValueLine
              key={key}
              label={finalLabel}
              value={value}
              unit={unit}
              theme={theme}
              accent={key === "power"}
            />
          );
        })}
      </View>

      {/* CHANGE #3: Conditional dismiss button or saved indicator */}
      {msg.saved ? (
        <View
          style={[
            styles.savedIndicator,
            { backgroundColor: theme.accentSurface },
          ]}
        >
          <Ionicons name="checkmark" size={11} color={Colors.secondary} />
        </View>
      ) : (
        <Pressable
          hitSlop={8}
          onPress={() => onRemove(athleteId, msg.timestamp)}
          style={({ pressed }) => [
            styles.dismiss,
            {
              backgroundColor: theme.uiBackground,
              borderColor: theme.border,
              opacity: pressed ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="close" size={11} color={theme.subtleText} />
        </Pressable>
      )}
    </View>
  );
};

// ── Athlete group ──────────────────────────────────────────────────────────
export default function AthleteGroup({
  athleteId,
  athleteName,
  athleteMessages,
  activityCommand,
  attributes,
  theme,
  isLatest,
  onRemove,
}) {
  const { language } = useAuth();

  return (
    <View
      style={[
        styles.group,
        {
          backgroundColor: theme.background,
          borderColor: isLatest ? Colors.primary : theme.border,
          borderWidth: isLatest ? 1.5 : 1,
        },
      ]}
    >
      {/* Group header */}
      <View style={[styles.groupHeader, { borderBottomColor: theme.border }]}>
        <View
          style={[
            styles.groupAvatar,
            { backgroundColor: isLatest ? Colors.primary : theme.border },
          ]}
        >
          <ThemedText
            style={[
              styles.groupAvatarText,
              { color: isLatest ? "#fff" : theme.subtleText },
            ]}
          >
            {athleteName
              .split(" ")
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("")
              .slice(0, 2)}
          </ThemedText>
        </View>

        <ThemedText style={[styles.groupName, { color: theme.title }]}>
          {athleteName}
        </ThemedText>

        <ThemedText style={[styles.groupCount, { color: theme.subtleText }]}>
          {athleteMessages.length}{" "}
          {athleteMessages.length !== 1
            ? t[language]?.ex_readings || t.en.ex_readings
            : t[language]?.ex_reading || t.en.ex_reading}
        </ThemedText>
      </View>

      {athleteMessages.map((msg, index) => (
        <ReadingRow
          key={msg.timestamp}
          msg={msg}
          index={index}
          activityCommand={activityCommand}
          attributes={attributes}
          theme={theme}
          onRemove={onRemove}
          athleteId={athleteId}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarText: { fontSize: 10, fontWeight: "700" },
  groupName: { flex: 1, fontSize: 13, fontWeight: "700" },
  groupCount: { fontSize: 11 },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIndex: { fontSize: 10, minWidth: 24, textAlign: "right", paddingTop: 2 },
  valuesColumn: { flex: 1, gap: 5, paddingLeft: 12 },
  valueLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  attrName: { fontSize: 12, fontWeight: "600", flex: 1 },
  attrValue: { fontSize: 13, fontWeight: "800" },

  dismiss: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    marginTop: 2,
  },
  // CHANGE #4: New style for saved indicator
  savedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    marginTop: 2,
  },
});
