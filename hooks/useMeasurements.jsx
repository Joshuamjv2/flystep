// hooks/useMeasurementSave.js

import { useCallback, useRef, useState } from "react";
import { create_measurement } from "../api/measurements";
import { prepareMeasurementData } from "../utils/measurement_helpers";

export const useMeasurementSave = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const savedReadingsRef = useRef(new Map());

  const saveAthleteMeasurements = useCallback(
    async ({
      athleteId,
      athleteName,
      readings,
      subActivityId,
      deviceId,
      teamId,
      roleId,
      weight,
      height,
      note,
      activityCommand,
      onSuccess,
      onError,
    }) => {
      if (!readings || readings.length === 0) {
        console.log(`[MeasurementSave] No readings to save for ${athleteName}`);
        return null;
      }

      if (!savedReadingsRef.current.has(athleteId)) {
        savedReadingsRef.current.set(athleteId, new Set());
      }
      const savedSet = savedReadingsRef.current.get(athleteId);

      const unsavedReadings = readings.filter(
        (reading) => !savedSet.has(reading.timestamp),
      );

      if (unsavedReadings.length === 0) {
        console.log(
          `[MeasurementSave] All readings already saved for ${athleteName}`,
        );
        return null;
      }

      // Prepare the measurement data
      const measurementData = prepareMeasurementData(
        unsavedReadings,
        subActivityId,
        athleteId,
        deviceId,
        teamId,
        roleId,
        weight,
        height,
        note,
        activityCommand,
      );

      if (!measurementData) {
        console.error(
          `[MeasurementSave] Failed to prepare measurement data for ${athleteName}`,
        );
        return null;
      }

      // Log the request
      console.log("\n" + "=".repeat(80));
      console.log(`📤 SENDING MEASUREMENTS FOR ${athleteName}`);
      console.log("=".repeat(80));
      console.log("REQUEST PAYLOAD:");
      console.log(JSON.stringify(measurementData, null, 2));
      console.log("=".repeat(80) + "\n");

      setIsSaving(true);
      setSaveError(null);

      try {
        // MAKE THE ACTUAL API CALL
        const response = await create_measurement(measurementData);

        console.log("\n" + "=".repeat(80));
        console.log(`✅ MEASUREMENTS SAVED SUCCESSFULLY FOR ${athleteName}`);
        console.log("=".repeat(80));
        console.log("RESPONSE:");
        console.log(JSON.stringify(response, null, 2));
        console.log("=".repeat(80) + "\n");

        // Mark readings as saved
        unsavedReadings.forEach((reading) => {
          savedSet.add(reading.timestamp);
        });

        if (onSuccess) {
          onSuccess(response, unsavedReadings);
        }

        return response;
      } catch (error) {
        console.error("\n" + "=".repeat(80));
        console.error(`❌ FAILED TO SAVE MEASUREMENTS FOR ${athleteName}`);
        console.error("=".repeat(80));
        console.error("ERROR MESSAGE:", error.message);
        if (error.response) {
          console.error("STATUS:", error.response.status);
          console.error(
            "RESPONSE DATA:",
            JSON.stringify(error.response.data, null, 2),
          );
        }
        console.error("=".repeat(80) + "\n");

        setSaveError(error);
        if (onError) {
          onError(error);
        }
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const areReadingsSaved = useCallback((athleteId, readings) => {
    if (!readings || readings.length === 0) return true;

    const savedSet = savedReadingsRef.current.get(athleteId);
    if (!savedSet) return false;

    return readings.every((reading) => savedSet.has(reading.timestamp));
  }, []);

  const getUnsavedCount = useCallback((athleteId, readings) => {
    if (!readings || readings.length === 0) return 0;

    const savedSet = savedReadingsRef.current.get(athleteId);
    if (!savedSet) return readings.length;

    return readings.filter((reading) => !savedSet.has(reading.timestamp))
      .length;
  }, []);

  const clearSavedTracking = useCallback((athleteId = null) => {
    if (athleteId) {
      savedReadingsRef.current.delete(athleteId);
      console.log(
        `[MeasurementSave] Cleared saved tracking for athlete ${athleteId}`,
      );
    } else {
      savedReadingsRef.current.clear();
      console.log("[MeasurementSave] Cleared all saved tracking");
    }
  }, []);

  return {
    saveAthleteMeasurements,
    areReadingsSaved,
    getUnsavedCount,
    clearSavedTracking,
    isSaving,
    saveError,
  };
};
