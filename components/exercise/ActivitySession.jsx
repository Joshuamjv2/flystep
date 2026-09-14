// components/exercise/ActivitySession.jsx

import {
  View,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  StyleSheet,
} from "react-native";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import ThemedView from "../ThemedView";
import ThemedText from "../ThemedText";
import { useBt } from "../../hooks/useBluetooth";
import { useAuth } from "../../hooks/useAuth";
import { useActivities } from "../../hooks/useActivities";
import { useTeamMembers } from "../../hooks/useTeamMembers";
import { useActivityAttributes } from "../../hooks/useAttributes";
import { attributesCacheKey } from "../../hooks/useActivities";
import { activity_attributes } from "../../api/attributes";
import { finish_measurement } from "../../api/measurements";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../../constants/Colors";
import { useMeasurementSave } from "../../hooks/useMeasurements";
import { t } from "../../constants/translations";

import {
  parseActivityMessage,
  calcPower,
  getActivityMeta,
  COMMANDS,
} from "./session/ParseMessage";
import ChipRow from "./session/ChipRow";
import AthleteDropdown from "./session/AthleteDropDown";
import SessionHeader from "./session/SessionHeader";
import ReadingsCard from "./session/ReadingsCard";
import DescriptionCard from "./session/DescriptionCard";
import DisconnectButton from "./session/DisconnectionButton";
import StickyActions from "./session/StickyActions";

export default function ActivitySession({
  device,
  connectedDevice,
  deviceCharacteristics,
  onDisconnect,
  theme,
  clearBuffersIfNoReadings,
}) {
  const isRealDevice = device && !device.isSimulated;

  const { deviceTypes, language, selectedTeam, user } = useAuth();
  const {
    teamMembers = [],
    selectedMember,
    setSelectedMember,
    isLoading: membersLoading,
  } = useTeamMembers(selectedTeam?.id);

  const selectedDeviceType = deviceTypes.find(
    (dt) => dt.name?.toLowerCase() === device?.name?.toLowerCase(),
  );
  const { activities, isLoading: activitiesLoading } = useActivities(
    selectedDeviceType?.id,
    language,
  );

  // ── Selection ──────────────────────────────────────────────────────────
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedSubActivity, setSelectedSubActivity] = useState(null);
  const [timerDuration, setTimerDuration] = useState(null); // Single source of truth for timer

  // ── Session state ──────────────────────────────────────────────────────
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [isPositionOk, setIsPositionOk] = useState(false);
  const [warnNoAthlete, setWarnNoAthlete] = useState(false);

  // ── Live derived values (shown in ReadingsCard live section) ───────────
  const [liveHeightCm, setLiveHeightCm] = useState(null);
  const [liveFlightMs, setLiveFlightMs] = useState(null);
  const [liveContactMs, setLiveContactMs] = useState(null);
  const [liveDistanceCm, setLiveDistanceCm] = useState(null);

  // ── Power accumulator (react/multi only) ──────────────────────────────
  const [sumFlightS, setSumFlightS] = useState(0);
  const [sumContactS, setSumContactS] = useState(0);
  const [nJumps, setNJumps] = useState(0);

  // ── History ────────────────────────────────────────────────────────────
  const [messagesByAthlete, setMessagesByAthlete] = useState({});
  const [athleteNames, setAthleteNames] = useState({});
  const [athleteOrder, setAthleteOrder] = useState([]);

  // ── BLE command tracking ───────────────────────────────────────────────
  const [current_command, setCurrentCommand] = useState("");
  const [currentSendString, setCurrentSendString] = useState("");

  const isSwitchingAthlete = useRef(false);
  const athleteSwitchTimeout = useRef(null);
  const isMounted = useRef(true);
  const isDisconnecting = useRef(false);

  const { attributes } = useActivityAttributes(activeId, language);
  const { sendData, receivedData } = useBt();

  // ── Measurement saving hook ───────────────────────────────────────────
  const {
    saveAthleteMeasurements,
    areReadingsSaved,
    getUnsavedCount,
    clearSavedTracking,
    isSaving: isSavingMeasurements,
    saveError,
  } = useMeasurementSave();

  // Derive the activity command from the selected activity's operation_value
  const activityCommand = useMemo(
    () => selectedActivity?.activity?.operation_value?.toUpperCase() ?? "",
    [selectedActivity],
  );
  const activityMeta = useMemo(
    () => getActivityMeta(activityCommand),
    [activityCommand],
  );

  // ─────────────────────────────────────────────────────────────
  // CHANGE #TIMER: Multi-jump countdown timer state
  // ─────────────────────────────────────────────────────────────
  const [countdownSeconds, setCountdownSeconds] = useState(null);
  const countdownIntervalRef = useRef(null);

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownSeconds(null);
  }, []);

  const startCountdown = useCallback(
    (seconds) => {
      if (!seconds || Number.isNaN(seconds)) return;

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      setCountdownSeconds(seconds);

      countdownIntervalRef.current = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev == null) return prev;
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [setCountdownSeconds],
  );

  // ── Cleanup ────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (athleteSwitchTimeout.current)
        clearTimeout(athleteSwitchTimeout.current);

      // CHANGE #TIMER: cleanup timer
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // ── Reset when activity changes ────────────────────────────────────────
  useEffect(() => {
    setSelectedSubActivity(null);
    setTimerDuration(null); // Reset timer duration when activity changes
    setActive(false);
    setPaused(false);
    setActiveId(null);
    clearLiveValues();
    clearHistory();
    setCurrentCommand("");
    setCurrentSendString("");
    clearSavedTracking(); // Clear saved tracking when activity changes

    // CHANGE #TIMER: reset timer
    clearCountdown();

    if (clearBuffersIfNoReadings) {
      clearBuffersIfNoReadings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedActivity]);

  const clearLiveValues = () => {
    setLiveHeightCm(null);
    setLiveFlightMs(null);
    setLiveContactMs(null);
    setLiveDistanceCm(null);
    setHasError(false);
    setIsPositionOk(false);
    setSumFlightS(0);
    setSumContactS(0);
    setNJumps(0);
  };

  const clearHistory = () => {
    setMessagesByAthlete({});
    setAthleteNames({});
    setAthleteOrder([]);
  };

  // ── Prefetch attributes ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedActivity) return;
    const subs = selectedActivity.activity?.sub_activities ?? [];
    if (!subs.length) return;
    const prefetch = async () => {
      await Promise.allSettled(
        subs.map(async (sub) => {
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
              `[ActivitySession] Prefetch failed for ${sub.id}:`,
              e?.message,
            );
          }
        }),
      );
    };
    prefetch();
  }, [selectedActivity]);

  // ── Incoming BLE data ──────────────────────────────────────────────────
  useEffect(() => {
    if (!receivedData || !current_command) return;
    if (isSwitchingAthlete.current) return;

    if (!receivedData.toUpperCase().startsWith(current_command.toUpperCase()))
      return;

    const parsed = parseActivityMessage(receivedData, activityCommand);
    if (!parsed) return;

    if (parsed.status === "E") {
      setHasError(true);
      setIsPositionOk(false);

      if (active && !paused) {
        sendData("N");
        setPaused(true);

        // Reset timer to original duration on error
        if (timerDuration) {
          clearCountdown();
          setCountdownSeconds(timerDuration);
        }
      }
      return;
    }
    if (parsed.status === "O") {
      setHasError(false);
      setIsPositionOk(false);
      return;
    }
    if (parsed.status === "U") {
      return;
    }
    if (parsed.status !== "M") return;

    setHasError(false);
    setIsPositionOk(true);
    if (parsed.heightCm != null) setLiveHeightCm(parsed.heightCm);
    if (parsed.flightMs != null) setLiveFlightMs(parsed.flightMs);
    if (parsed.contactMs != null) setLiveContactMs(parsed.contactMs);
    if (parsed.distanceCm != null) setLiveDistanceCm(parsed.distanceCm);

    let currentPower = null;
    if (activityMeta.showPower && parsed.flightMs && parsed.contactMs) {
      const fS = parseInt(parsed.flightMs, 10) / 1000;
      const cS = parseInt(parsed.contactMs, 10) / 1000;
      setSumFlightS((prev) => {
        const newSum = prev + fS;
        setSumContactS((prevC) => {
          const newCSum = prevC + cS;
          setNJumps((prevN) => {
            const newN = prevN + 1;
            currentPower = calcPower(newSum, newCSum, newN);
            return newN;
          });
          return newCSum;
        });
        return newSum;
      });
    }

    if (receivedData.length > 5) {
      const athleteId = selectedMember?.id ?? "unknown";
      const athleteDisplayName = selectedMember
        ? `${selectedMember.last_name ?? ""} ${selectedMember.first_name ?? ""}`.trim()
        : t[language]?.ex_unknown_athlete || t.en.ex_unknown_athlete;

      setAthleteNames((prev) =>
        prev[athleteId] ? prev : { ...prev, [athleteId]: athleteDisplayName },
      );

      // CHANGE #1: Add saved: false to new readings
      setMessagesByAthlete((prev) => {
        const existing = prev[athleteId] ?? [];
        return {
          ...prev,
          [athleteId]: [
            ...existing,
            {
              timestamp: new Date().toISOString(),
              raw: receivedData,
              saved: false, // ← NEW: Track if reading has been saved
              parsed: {
                flightMs: parsed.flightMs,
                contactMs: parsed.contactMs,
                heightCm: parsed.heightCm,
                distanceCm: parsed.distanceCm,
                power: currentPower,
              },
            },
          ],
        };
      });

      setAthleteOrder((prev) => {
        const without = prev.filter((id) => id !== athleteId);
        return [athleteId, ...without];
      });
    }

    console.log("[BLE parsed]", parsed, "cmd:", activityCommand);
  }, [
    receivedData,
    current_command,
    activityCommand,
    activityMeta,
    selectedMember,
    language,
  ]);

  // ── Back / disconnect ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => handler.remove();
  }, [active]);

  const handleBack = useCallback(() => {
    if (active) handleExit();
    else handleDisconnect();
  }, [active]);

  const handleDisconnect = useCallback(async () => {
    if (isDisconnecting.current) return;
    isDisconnecting.current = true;
    try {
      await onDisconnect();
    } catch (e) {
      console.log("[ActivitySession] Disconnect error:", e);
    } finally {
      if (isMounted.current) isDisconnecting.current = false;
    }
  }, [onDisconnect]);

  // Save readings for an athlete
  const saveReadingsForAthlete = useCallback(
    (athleteId, athleteReadings, athleteName, isExit = false) => {
      if (!athleteReadings || athleteReadings.length === 0) return;

      if (areReadingsSaved(athleteId, athleteReadings)) {
        console.log(
          `[ActivitySession] Readings already saved for ${athleteName}`,
        );
        return;
      }

      // Get athlete data from selectedMember
      const memberUserId = selectedMember?.id;
      const athleteWeight = selectedMember?.weight
        ? parseFloat(selectedMember.weight)
        : 0;
      const athleteHeight = selectedMember?.height
        ? parseFloat(selectedMember.height)
        : 0;
      const loggedInUserRoleId = selectedTeam?.role?.id;

      // Get device UUID from user.devices by matching MAC address
      let deviceUuid = null;
      const deviceMac = device?.id;
      const deviceName = device?.name;

      // First, try to match by MAC address from user.devices
      if (user?.devices && user.devices.length > 0) {
        const matchedDevice = user.devices.find((d) => {
          if (
            deviceMac &&
            d.mac_address &&
            d.mac_address.toLowerCase() === deviceMac.toLowerCase()
          ) {
            return true;
          }
          if (
            deviceName &&
            d.device_type?.name &&
            d.device_type.name.toLowerCase() === deviceName.toLowerCase()
          ) {
            return true;
          }
          return false;
        });

        if (matchedDevice) {
          deviceUuid = matchedDevice.id;
        }
      }

      // Fallback to deviceTypes if not found in user.devices
      if (!deviceUuid && deviceTypes.length > 0) {
        const matchedDeviceType = deviceTypes.find((dt) => {
          if (
            deviceMac &&
            dt.mac_address &&
            dt.mac_address.toLowerCase() === deviceMac.toLowerCase()
          ) {
            return true;
          }
          if (
            deviceName &&
            dt.name &&
            dt.name.toLowerCase() === deviceName.toLowerCase()
          ) {
            return true;
          }
          return false;
        });

        if (matchedDeviceType) {
          deviceUuid = matchedDeviceType.id;
        }
      }

      if (!deviceUuid) {
        console.error(`❌ Could not find device UUID for: ${deviceName}`);
        return;
      }

      if (!memberUserId) {
        console.error(`❌ Missing athlete user ID for ${athleteName}`);
        return;
      }

      // FIRE AND FORGET - Don't await, just start the save in background
      saveAthleteMeasurements({
        athleteId: memberUserId,
        athleteName:
          `${selectedMember?.last_name || ""} ${selectedMember?.first_name || ""}`.trim(),
        readings: athleteReadings,
        subActivityId: selectedSubActivity?.id,
        deviceId: deviceUuid,
        teamId: selectedTeam?.id,
        roleId: loggedInUserRoleId,
        weight: athleteWeight,
        height: athleteHeight,
        note: "",
        activityCommand: activityCommand,
        onSuccess: (response, savedReadings) => {
          console.log(
            `✅ Background save successful: ${savedReadings.length} readings for ${athleteName}`,
          );

          // CHANGE #2: Mark readings as saved in state
          setMessagesByAthlete((prev) => {
            const athleteReadingsState = prev[athleteId] || [];
            const updatedReadings = athleteReadingsState.map((reading) => {
              if (
                savedReadings.some(
                  (saved) => saved.timestamp === reading.timestamp,
                )
              ) {
                return { ...reading, saved: true };
              }
              return reading;
            });
            return { ...prev, [athleteId]: updatedReadings };
          });
        },
        onError: (error) => {
          console.error(`❌ Background save failed for ${athleteName}:`, error);
        },
      });
    },
    [
      selectedSubActivity,
      device,
      user,
      deviceTypes,
      selectedTeam,
      selectedMember,
      activityCommand,
      saveAthleteMeasurements,
      areReadingsSaved,
    ],
  );

  // ── Command handlers ───────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (!selectedMember) {
      setWarnNoAthlete(true);
      return;
    }
    if (!selectedSubActivity) return;

    clearLiveValues();
    clearHistory();
    clearSavedTracking(); // Clear saved tracking for new session

    // CHANGE #TIMER: reset + start countdown using timerDuration
    clearCountdown();
    if (timerDuration) {
      startCountdown(timerDuration);
    }

    if (clearBuffersIfNoReadings) {
      clearBuffersIfNoReadings();
    }

    const cmd = selectedActivity.activity.operation_value || "n";
    const send =
      cmd.toUpperCase() + (selectedSubActivity.operation_value || "");

    setCurrentCommand(cmd.toUpperCase());
    setCurrentSendString(send);
    setActiveId(selectedSubActivity.id ?? null);
    console.log("\n\n\n", selectedSubActivity, "selected now");
    setActive(true);
    setPaused(false);
    sendData(send);
  }, [
    selectedMember,
    selectedSubActivity,
    timerDuration,
    selectedActivity,
    sendData,
    clearBuffersIfNoReadings,
    clearSavedTracking,
    clearCountdown,
    startCountdown,
  ]);

  const handleStop = useCallback(() => {
    sendData("N");
    setPaused(true);

    // CHANGE #TIMER: stop countdown while paused
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [sendData]);

  const handleResume = useCallback(() => {
    if (!currentSendString) return;

    // If there was an error, reset timer to original duration before resuming
    if (hasError && timerDuration && countdownSeconds !== timerDuration) {
      clearCountdown();
      setCountdownSeconds(timerDuration);
    }

    sendData(currentSendString);
    setPaused(false);
    setHasError(false); // Clear error state

    // Resume countdown if timer exists and hasn't finished
    if (
      timerDuration &&
      countdownSeconds != null &&
      countdownSeconds > 0 &&
      !countdownIntervalRef.current
    ) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev == null) return prev;
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [
    currentSendString,
    sendData,
    countdownSeconds,
    timerDuration,
    hasError,
    clearCountdown,
  ]);

  const sendSessionEmail = useCallback(async () => {
    try {
      const emailEnabled = await AsyncStorage.getItem(
        "@settings_email_updates",
      );
      if (emailEnabled !== "true") return;

      const recipientEmail = await AsyncStorage.getItem(
        "@settings_email_address",
      );
      if (!recipientEmail) return;

      const totalReadings = Object.values(messagesByAthlete).reduce(
        (sum, arr) => sum + arr.length,
        0,
      );
      if (totalReadings === 0) return;

      const coachName =
        user?.first_name && user?.last_name
          ? `${user.first_name} ${user.last_name}`
          : user?.email?.split("@")[0] || "Coach";

      let teamName = selectedTeam?.name ?? null;
      if (!teamName && user?.teams?.length > 0) {
        teamName = user.teams[0]?.team?.name ?? null;
      }

      // ── FIX: operation_value coerced to string on both activity and sub_activity
      const activityInfo = {
        id: selectedActivity?.activity?.id || "",
        name: selectedActivity?.activity?.name || "",
        operation_value:
          selectedActivity?.activity?.operation_value != null
            ? String(selectedActivity.activity.operation_value)
            : null,
      };

      const subActivityInfo = selectedSubActivity
        ? {
            id: selectedSubActivity?.id || "",
            name: selectedSubActivity?.name || "",
            operation_value:
              selectedSubActivity?.operation_value != null
                ? String(selectedSubActivity.operation_value)
                : null,
          }
        : null;

      const athletesData = Object.entries(messagesByAthlete).map(
        ([athleteId, readings]) => ({
          athlete_id: athleteId,
          athlete_name:
            athleteNames[athleteId] ??
            (t[language]?.ex_unknown_athlete || t.en.ex_unknown_athlete),
          readings: readings.map((r) => ({
            timestamp: r.timestamp,
            flight_ms: r.parsed?.flightMs ? Number(r.parsed.flightMs) : null,
            contact_ms: r.parsed?.contactMs ? Number(r.parsed.contactMs) : null,
            height_cm: r.parsed?.heightCm ? Number(r.parsed.heightCm) : null,
            distance_cm: r.parsed?.distanceCm
              ? Number(r.parsed.distanceCm)
              : null,
            power: r.parsed?.power ? Number(r.parsed.power) : null,
            saved: r.saved || false,
          })),
        }),
      );

      const payload = {
        coach_email: recipientEmail,
        coach_name: coachName,
        team_name: teamName,
        language: language,
        activity: activityInfo,
        sub_activity: subActivityInfo,
        created_at: new Date().toISOString(),
        athletes: athletesData,
      };

      console.log("[Email] Sending payload:", JSON.stringify(payload, null, 2));
      const response = await finish_measurement(payload);
      console.log("[Email] Sent successfully:", response);
    } catch (err) {
      console.error("[Email] Failed to send session email:\n\n", err);
    }
  }, [
    user,
    selectedTeam,
    selectedActivity,
    selectedSubActivity,
    messagesByAthlete,
    athleteNames,
    language,
  ]);
  const handleExit = useCallback(() => {
    // Send 'N' command to stop the session on the device
    if (sendData && active) {
      console.log("[ActivitySession] Sending 'N' command on exit");
      sendData("N");
    }

    // Clear timer
    clearCountdown();

    // Start saving all unsaved readings - don't await, let them run in background
    if (Object.keys(messagesByAthlete).length > 0) {
      console.log(
        "[ActivitySession] Starting background saves for unsaved readings",
      );

      for (const [athleteId, readings] of Object.entries(messagesByAthlete)) {
        if (readings.length > 0 && !areReadingsSaved(athleteId, readings)) {
          const athleteName =
            athleteNames[athleteId] ||
            t[language]?.ex_unknown_athlete ||
            t.en.ex_unknown_athlete;
          // Fire and forget - don't await
          saveReadingsForAthlete(athleteId, readings, athleteName, true);
        }
      }
    }

    sendSessionEmail();
    console.log("\n\n", "Session emails >>>>");

    // Immediately clear UI state (don't wait for saves)
    setActive(false);
    setPaused(false);
    setActiveId(null);
    clearLiveValues();
    clearHistory();
    setCurrentCommand("");
    setCurrentSendString("");
    clearSavedTracking();

    if (clearBuffersIfNoReadings) {
      clearBuffersIfNoReadings();
    }
  }, [
    sendData,
    active,
    clearBuffersIfNoReadings,
    messagesByAthlete,
    athleteNames,
    saveReadingsForAthlete,
    areReadingsSaved,
    clearSavedTracking,
    clearCountdown,
    language,
  ]);

  const handleClear = useCallback(() => {
    clearHistory();
    clearLiveValues();
    clearSavedTracking(); // Clear saved tracking when clearing all readings

    // CHANGE #TIMER: clear timer on clear all
    clearCountdown();

    if (clearBuffersIfNoReadings) {
      clearBuffersIfNoReadings();
    }
  }, [clearBuffersIfNoReadings, clearSavedTracking, clearCountdown]);

  // ── Remove a single reading ────────────────────────────────────────────
  const handleRemoveReading = useCallback(
    (athleteId, timestamp) => {
      setMessagesByAthlete((prev) => {
        const existing = prev[athleteId] ?? [];
        const updated = existing.filter((msg) => msg.timestamp !== timestamp);

        if (updated.length === 0) {
          const { [athleteId]: _, ...rest } = prev;
          setAthleteOrder((order) => order.filter((id) => id !== athleteId));
          setAthleteNames((names) => {
            const { [athleteId]: __, ...restNames } = names;
            return restNames;
          });

          const remainingCount = Object.values(rest).reduce(
            (sum, arr) => sum + arr.length,
            0,
          );
          if (remainingCount === 0) {
            clearLiveValues();
            clearSavedTracking(); // Clear tracking when no readings left

            // CHANGE #TIMER: clear timer when nothing left
            clearCountdown();

            if (clearBuffersIfNoReadings) {
              clearBuffersIfNoReadings();
            }
          }

          return rest;
        }

        const currentAthleteId = selectedMember?.id ?? "unknown";
        if (athleteId === currentAthleteId && updated.length > 0) {
          const last = updated[updated.length - 1].parsed;
          if (last.heightCm != null) setLiveHeightCm(last.heightCm);
          if (last.flightMs != null) setLiveFlightMs(last.flightMs);
          if (last.contactMs != null) setLiveContactMs(last.contactMs);
          if (last.distanceCm != null) setLiveDistanceCm(last.distanceCm);
        } else if (athleteId === currentAthleteId && updated.length === 0) {
          clearLiveValues();
        }

        return { ...prev, [athleteId]: updated };
      });
    },
    [
      selectedMember,
      clearBuffersIfNoReadings,
      clearSavedTracking,
      clearCountdown,
    ],
  );

  // ── Athlete switch mid-session ─────────────────────────────────────────
  const handleAthleteSwitch = useCallback(
    (chip) => {
      const nextAthlete = chip.raw;
      const previousAthleteId = selectedMember?.id;

      // Save measurements for previous athlete before switching - FIRE AND FORGET
      if (
        active &&
        previousAthleteId &&
        messagesByAthlete[previousAthleteId]?.length > 0
      ) {
        const previousReadings = messagesByAthlete[previousAthleteId];
        const previousAthleteName =
          athleteNames[previousAthleteId] ||
          t[language]?.ex_unknown_athlete ||
          t.en.ex_unknown_athlete;

        // Don't await - just start the save in background
        saveReadingsForAthlete(
          previousAthleteId,
          previousReadings,
          previousAthleteName,
        );
      }

      // Switch to new athlete immediately (don't wait for save)
      setSelectedMember(nextAthlete);
      if (warnNoAthlete) setWarnNoAthlete(false);

      // CHANGE #TIMER: reset timer on athlete switch using timerDuration
      clearCountdown();
      if (active && timerDuration) {
        startCountdown(timerDuration);
      }

      // Handle BLE session switching
      if (active && !paused && currentSendString) {
        isSwitchingAthlete.current = true;
        sendData("N");
        if (athleteSwitchTimeout.current)
          clearTimeout(athleteSwitchTimeout.current);
        athleteSwitchTimeout.current = setTimeout(() => {
          if (!isMounted.current) return;
          sendData(currentSendString);
          setPaused(false);
          isSwitchingAthlete.current = false;
        }, 300);
      }
    },
    [
      active,
      paused,
      currentSendString,
      sendData,
      setSelectedMember,
      warnNoAthlete,
      selectedMember,
      messagesByAthlete,
      athleteNames,
      saveReadingsForAthlete,
      clearCountdown,
      timerDuration,
      startCountdown,
      language,
    ],
  );

  // ── Chip data ──────────────────────────────────────────────────────────
  const activityChips = useMemo(
    () =>
      (activities ?? []).map((a) => ({
        id: a.activity?.id ?? a.activity?.name,
        label: a.activity?.name,
        raw: a,
      })),
    [activities],
  );

  console.log("\n\n\n!", selectedActivity?.activity.id);

  const subActivityChips = useMemo(() => {
    const subs = selectedActivity?.activity?.sub_activities ?? [];
    const activityId = selectedActivity?.activity?.id;

    const multi_jump_id = "af550580-8db6-49b5-b855-3da4a8f334e9";

    const sortedSubs =
      activityId === multi_jump_id
        ? [...subs].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        : subs;

    return sortedSubs.map((s) => {
      const name = s.name || "";

      // CHANGE: First check if the sub-activity has a 'time' property directly
      let time = s.time || null;

      // If not, and it's multi_jump, try to extract from name
      if (time === null && activityId === multi_jump_id) {
        const match = name.match(/\d+/);
        time = match ? parseInt(match[0], 10) : null;
      }

      console.log(
        `[subActivityChips] ${s.name} - time:`,
        time,
        "from:",
        s.time
          ? "direct property"
          : activityId === multi_jump_id
            ? "extracted from name"
            : "none",
      );

      const res = {
        id: s.id ?? s.name,
        label: s.name,
        raw: s,
        time,
      };
      return res;
    });
  }, [selectedActivity]);

  const memberChips = useMemo(
    () =>
      teamMembers.map((m) => {
        const initials = [m?.last_name, m?.first_name]
          .filter(Boolean)
          .map((w) => w[0]?.toUpperCase())
          .join("");
        return {
          id: m?.id,
          label: `${m?.last_name ?? ""} ${m?.first_name ?? ""}`.trim(),
          avatar: initials,
          raw: m,
        };
      }),
    [teamMembers],
  );

  const isLoading = activitiesLoading || membersLoading;
  const totalReadingsCount = useMemo(
    () =>
      Object.values(messagesByAthlete).reduce(
        (sum, arr) => sum + arr.length,
        0,
      ),
    [messagesByAthlete],
  );

  const currentPower = useMemo(() => {
    if (!activityMeta.showPower) return null;

    const currentAthleteId = selectedMember?.id ?? "unknown";
    const athleteMessages = messagesByAthlete[currentAthleteId];

    if (athleteMessages && athleteMessages.length > 0) {
      const lastReading = athleteMessages[athleteMessages.length - 1];
      if (lastReading?.parsed?.power != null) {
        return lastReading.parsed.power;
      }
    }

    return null;
  }, [activityMeta.showPower, messagesByAthlete, selectedMember]);

  const canStart =
    !!selectedActivity && !!selectedSubActivity && !!selectedMember && !active;
  const showReadings = active || totalReadingsCount > 0;

  return (
    <ThemedView safe style={styles.container}>
      <SessionHeader
        device={device}
        theme={theme}
        isRealDevice={isRealDevice}
        onBackPress={handleBack}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.subtleText }]}>
            {t[language]?.loading || t.en.loading}
          </ThemedText>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ChipRow
              label={t[language]?.activity_label || t.en.activity_label}
              chips={activityChips}
              selectedId={
                selectedActivity
                  ? (selectedActivity.activity?.id ??
                    selectedActivity.activity?.name)
                  : null
              }
              onSelect={(chip) => setSelectedActivity(chip.raw)}
              theme={theme}
              disabled={active}
            />

            {selectedActivity && (
              <ChipRow
                label={`${activityMeta.label} — ${t[language]?.sub_activity_label || t.en.sub_activity_label}`}
                chips={subActivityChips}
                selectedId={
                  selectedSubActivity
                    ? (selectedSubActivity.id ?? selectedSubActivity.name)
                    : null
                }
                onSelect={(chip) => {
                  if (!active) {
                    setSelectedSubActivity(chip.raw);
                    setTimerDuration(chip.time); // Single source of truth for timer
                  }
                }}
                theme={theme}
                disabled={active}
              />
            )}

            <AthleteDropdown
              theme={theme}
              chips={memberChips}
              selectedId={selectedMember?.id ?? null}
              onSelect={handleAthleteSwitch}
              label={
                active
                  ? t[language]?.athlete_switch_hint || t.en.athlete_switch_hint
                  : t[language]?.athlete || t.en.athlete
              }
              warn={warnNoAthlete}
            />

            {selectedSubActivity && !active && totalReadingsCount === 0 ? (
              <DescriptionCard
                theme={theme}
                selectedSubActivity={selectedSubActivity}
              />
            ) : showReadings ? (
              <ReadingsCard
                theme={theme}
                activityCommand={activityCommand}
                heightCm={liveHeightCm}
                flightMs={liveFlightMs}
                contactMs={liveContactMs}
                distanceCm={liveDistanceCm}
                power={currentPower}
                paused={paused}
                attributes={attributes}
                active={active}
                hasError={hasError}
                isPositionOk={isPositionOk}
                totalReadingsCount={totalReadingsCount}
                athleteOrder={athleteOrder}
                athleteNames={athleteNames}
                messagesByAthlete={messagesByAthlete}
                onClear={handleClear}
                onRemoveReading={handleRemoveReading}
                onBuffersClearNeeded={clearBuffersIfNoReadings}
                countdownSeconds={countdownSeconds}
              />
            ) : null}

            <DisconnectButton theme={theme} onDisconnect={handleDisconnect} />
          </ScrollView>

          <StickyActions
            theme={theme}
            active={active}
            paused={paused}
            canStart={canStart}
            selectedActivity={selectedActivity}
            selectedSubActivity={selectedSubActivity}
            onStart={handleStart}
            onStop={handleStop}
            onResume={handleResume}
            onExit={handleExit}
          />
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
});
