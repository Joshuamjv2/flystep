// components/exercise/session/ReadingsCard.jsx

import { View, Pressable, StyleSheet } from "react-native";
import { useEffect, useMemo, useRef } from "react";
import ThemedText from "../../ThemedText";
import ThemedCard from "../../ThemedCard";
import AthleteGroup from "./AthleteGroup";
import {
  getActivityMeta,
  getAttributeValue,
  findAttributeLabel,
  calcJumpHeight,
} from "./ParseMessage";
import { Colors } from "../../../constants/Colors";
import { t } from "../../../constants/translations";
import { useAuth } from "../../../hooks/useAuth";

// ── One metric row ─────────────────────────────────────────────────────────
const MetricRow = ({ label, value, unit, highlight, theme, large = false }) => (
  <View style={[styles.liveRow, { borderBottomColor: theme.border }]}>
    <ThemedText style={[styles.liveName, { color: theme.subtleText }]}>
      {label}
    </ThemedText>

    <ThemedText
      style={[
        large ? styles.liveValueLarge : styles.liveValue,
        { color: highlight ?? theme.title },
      ]}
    >
      {value != null ? `${value}` : "—"}
      {value != null && unit ? (
        <ThemedText style={[styles.liveUnit, { color: theme.subtleText }]}>
          {" "}
          {unit}
        </ThemedText>
      ) : null}
    </ThemedText>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE NORMALIZER
// ─────────────────────────────────────────────────────────────────────────────
const normalizeAthleteMessages = (messagesByAthlete) => {
  if (!messagesByAthlete) return {};

  const updated = {};

  Object.entries(messagesByAthlete).forEach(([athleteId, msgs]) => {
    if (!Array.isArray(msgs)) {
      updated[athleteId] = msgs;
      return;
    }

    const sorted = [...msgs].sort(
      (a, b) => (a?.timestamp ?? 0) - (b?.timestamp ?? 0),
    );

    let lastKnown = {
      flightMs: null,
      contactMs: null,
      heightCm: null,
      distanceCm: null,
      power: null,
    };

    updated[athleteId] = sorted.map((m) => {
      const parsed = m?.parsed ?? {};
      const derived = parsed?.derived ?? {};

      const flightMs = parsed.flightMs ?? lastKnown.flightMs;
      const contactMs = parsed.contactMs ?? lastKnown.contactMs;

      const heightCm =
        derived.heightCm ??
        parsed.heightCm ??
        (flightMs ? calcJumpHeight(flightMs) : null) ??
        lastKnown.heightCm;

      const distanceCm =
        derived.distanceCm ?? parsed.distanceCm ?? lastKnown.distanceCm;

      const power = derived.power ?? parsed.power ?? lastKnown.power;

      lastKnown = { flightMs, contactMs, heightCm, distanceCm, power };

      return {
        ...m,
        parsed: {
          ...parsed,
          flightMs,
          contactMs,
          derived: {
            heightCm,
            distanceCm,
            power,
          },
        },
      };
    });
  });

  return updated;
};

export default function ReadingsCard({
  theme,
  activityCommand,
  attributes,
  heightCm,
  flightMs,
  contactMs,
  distanceCm,
  power,
  paused,
  active,
  hasError,
  isPositionOk,
  totalReadingsCount,
  athleteOrder,
  athleteNames,
  messagesByAthlete,
  onClear,
  onRemoveReading,
  onBuffersClearNeeded,
  countdownSeconds, // CHANGE #TIMER
}) {
  const { language } = useAuth();
  const cmd = activityCommand?.toUpperCase();
  const meta = getActivityMeta(cmd);

  console.log(countdownSeconds, "Seconds timer");

  const processedAthletesRef = useRef({});
  const prevAthleteRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // NORMALIZED BUFFER
  // ─────────────────────────────────────────────────────────────────────────
  const normalizedMessages = useMemo(
    () => normalizeAthleteMessages(messagesByAthlete),
    [messagesByAthlete],
  );

  // Clear buffers when readings array becomes empty
  useEffect(() => {
    if (totalReadingsCount === 0 && onBuffersClearNeeded) {
      onBuffersClearNeeded();
    }
  }, [totalReadingsCount, onBuffersClearNeeded]);

  // Get the latest reading values for live display
  const latestReadingValues = useMemo(() => {
    if (totalReadingsCount === 0) {
      return {
        heightCm: null,
        flightMs: null,
        contactMs: null,
        distanceCm: null,
        power: null,
      };
    }

    // Get the latest athlete (first in order)
    const latestAthleteId = athleteOrder?.[0];
    if (!latestAthleteId)
      return {
        heightCm: null,
        flightMs: null,
        contactMs: null,
        distanceCm: null,
        power: null,
      };

    const athleteMessages = normalizedMessages[latestAthleteId];
    if (!athleteMessages?.length)
      return {
        heightCm: null,
        flightMs: null,
        contactMs: null,
        distanceCm: null,
        power: null,
      };

    const lastMessage = athleteMessages[athleteMessages.length - 1];
    const parsed = lastMessage?.parsed || {};
    const derived = parsed?.derived || {};

    return {
      heightCm: derived.heightCm ?? parsed.heightCm ?? null,
      flightMs: parsed.flightMs ?? null,
      contactMs: parsed.contactMs ?? null,
      distanceCm: derived.distanceCm ?? parsed.distanceCm ?? null,
      power: derived.power ?? parsed.power ?? null,
    };
  }, [totalReadingsCount, athleteOrder, normalizedMessages]);

  // Use either the direct props (for active session) or latest reading values
  const displayHeightCm = active ? heightCm : latestReadingValues.heightCm;
  const displayFlightMs = active ? flightMs : latestReadingValues.flightMs;
  const displayContactMs = active ? contactMs : latestReadingValues.contactMs;
  const displayDistanceCm = active
    ? distanceCm
    : latestReadingValues.distanceCm;
  const displayPower = active ? power : latestReadingValues.power;

  const highlightColor = hasError
    ? Colors.warning
    : isPositionOk
      ? Colors.secondary
      : theme.title;

  const borderColor = hasError ? Colors.warning : "green";

  const handleLeavingAthlete = (athleteId) => {
    if (!athleteId) return;
    if (processedAthletesRef.current[athleteId]) return;

    processedAthletesRef.current[athleteId] = true;

    const name =
      athleteNames?.[athleteId] ??
      (t[language]?.ex_unknown_athlete || t.en.ex_unknown_athlete);
    const msgs = normalizedMessages?.[athleteId] ?? [];

    console.log("📌 Leaving athlete:", athleteId, name);
    console.log("📌 Athlete messages (normalized):", msgs);
  };

  useEffect(() => {
    const currentAthleteId = athleteOrder?.[0] ?? null;
    const prevAthleteId = prevAthleteRef.current;

    if (!prevAthleteId && currentAthleteId) {
      handleLeavingAthlete(currentAthleteId);
      prevAthleteRef.current = currentAthleteId;
      return;
    }

    if (
      prevAthleteId &&
      currentAthleteId &&
      prevAthleteId !== currentAthleteId
    ) {
      handleLeavingAthlete(prevAthleteId);
      prevAthleteRef.current = currentAthleteId;
    }
  }, [athleteOrder, athleteNames, normalizedMessages]);

  const liveRows = useMemo(() => {
    const order = meta.liveOrder ?? [];

    const parsedLive = {
      flightMs: displayFlightMs,
      contactMs: displayContactMs,
      heightCm: displayHeightCm,
      distanceCm: displayDistanceCm,
      derived: {
        heightCm: displayHeightCm,
        distanceCm: displayDistanceCm,
        power: displayPower,
      },
    };

    return order.map((key) => {
      const { value, unit } = getAttributeValue(key, parsedLive);
      const apiLabel = findAttributeLabel(attributes, key);

      const finalLabel =
        key === "height"
          ? (apiLabel ?? "height")
          : key === "power"
            ? (apiLabel ?? "power")
            : key === "distance"
              ? (apiLabel ?? "distance")
              : apiLabel;

      return { key, label: finalLabel, value, unit };
    });
  }, [
    meta.liveOrder,
    attributes,
    displayFlightMs,
    displayContactMs,
    displayHeightCm,
    displayDistanceCm,
    displayPower,
  ]);

  // CHANGE #TIMER: format countdown
  const formattedCountdown = useMemo(() => {
    if (countdownSeconds == null) return null;
    const mins = Math.floor(countdownSeconds / 60);
    const secs = countdownSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [countdownSeconds]);

  const showCountdown = countdownSeconds != null;

  return (
    <ThemedCard
      style={[
        styles.card,
        {
          backgroundColor: theme.uiBackground,
          borderColor,
          borderWidth: active && (hasError || isPositionOk) ? 2 : 1,
          opacity: paused ? 0.75 : 1,
        },
      ]}
    >
      {showCountdown && (
        <View
          style={[
            styles.timerBox,
            {
              backgroundColor: theme.accentSurface,
              borderColor: theme.border,
            },
          ]}
        >
          <ThemedText style={[styles.timerLabel, { color: theme.subtleText }]}>
            {t[language]?.ex_timer || t.en.ex_timer}
          </ThemedText>
          <ThemedText style={[styles.timerValue, { color: theme.title }]}>
            {formattedCountdown}
          </ThemedText>
        </View>
      )}

      <View
        style={[
          styles.liveContainer,
          { backgroundColor: theme.accentSurface, borderRadius: 10 },
        ]}
      >
        {liveRows.map((row, idx) => (
          <MetricRow
            key={`${row.key}-${idx}`}
            label={row.label}
            value={row.value}
            unit={row.unit}
            highlight={row.key === "power" ? Colors.secondary : highlightColor}
            theme={theme}
            large={row.key === "height"}
          />
        ))}
      </View>

      {totalReadingsCount > 0 && (
        <View style={styles.history}>
          <View style={styles.historyHeader}>
            <ThemedText
              style={[styles.historyLabel, { color: theme.subtleText }]}
            >
              {t[language]?.sub_readings || t.en.sub_readings} (
              {totalReadingsCount})
            </ThemedText>

            <Pressable
              onPress={onClear}
              style={[
                styles.clearBtn,
                {
                  backgroundColor: theme.uiBackground,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText
                style={[styles.clearBtnText, { color: theme.subtleText }]}
              >
                {t[language]?.ex_clear_all || t.en.ex_clear_all}
              </ThemedText>
            </Pressable>
          </View>

          {athleteOrder.map((athleteId, i) => {
            const msgs = normalizedMessages[athleteId];
            if (!msgs?.length) return null;

            return (
              <AthleteGroup
                key={athleteId}
                athleteId={athleteId}
                athleteName={
                  athleteNames[athleteId] ??
                  (t[language]?.ex_unknown_athlete || t.en.ex_unknown_athlete)
                }
                athleteMessages={msgs}
                activityCommand={cmd}
                attributes={attributes}
                theme={theme}
                isLatest={i === 0}
                onRemove={onRemoveReading}
              />
            );
          })}
        </View>
      )}
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  liveContainer: { overflow: "hidden", marginBottom: 4 },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  liveName: { fontSize: 12, fontWeight: "700", flex: 1 },
  liveValue: { fontSize: 18, fontWeight: "800" },
  liveValueLarge: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  liveUnit: { fontSize: 12, fontWeight: "500" },
  history: { marginTop: 12 },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  historyLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  clearBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  clearBtnText: { fontSize: 11 },

  // CHANGE #TIMER: timer display styles
  timerBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
});
