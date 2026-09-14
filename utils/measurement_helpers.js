// utils/measurementHelpers.js

import { ATTRIBUTE_IDS, ACTIVITY_COMMANDS } from "../constants/Attributes";

/**
 * Maps a reading to measures based on activity type
 * Uses hardcoded UUIDs exactly like the B4A implementation
 *
 * @param {Object} reading - The parsed reading object
 * @param {string} activityCommand - The activity command (S, J, R, U, F)
 * @returns {Array} Array of measure objects with attribute_id and value
 */
export const mapReadingToMeasures = (reading, activityCommand) => {
  const measures = [];
  const parsed = reading.parsed || {};

  switch (activityCommand?.toUpperCase()) {
    case ACTIVITY_COMMANDS.SQUAT: // SQUAT - only tempo_volo (flight time)
      if (parsed.flightMs != null && parsed.flightMs !== 0) {
        measures.push({
          attribute_id: ATTRIBUTE_IDS.TEMPO_VOLO,
          value: parsed.flightMs.toString(),
        });
        console.log(
          "[Measurement] Squat - added flight time:",
          parsed.flightMs,
        );
      }
      break;

    case ACTIVITY_COMMANDS.DROP: // DROP JUMP - tempo_contatto then tempo_volo
      if (parsed.contactMs != null && parsed.contactMs !== 0) {
        measures.push({
          attribute_id: ATTRIBUTE_IDS.TEMPO_CONTATTO,
          value: parsed.contactMs.toString(),
        });
        console.log(
          "[Measurement] Drop jump - added contact time:",
          parsed.contactMs,
        );
      }
      if (parsed.flightMs != null && parsed.flightMs !== 0) {
        measures.push({
          attribute_id: ATTRIBUTE_IDS.TEMPO_VOLO,
          value: parsed.flightMs.toString(),
        });
        console.log(
          "[Measurement] Drop jump - added flight time:",
          parsed.flightMs,
        );
      }
      break;

    case ACTIVITY_COMMANDS.REACT: // REACTIVE - pairs of tempo_volo and tempo_contatto
    case ACTIVITY_COMMANDS.MULTI: // MULTI JUMP - pairs of tempo_volo and tempo_contatto
      if (parsed.flightMs != null && parsed.flightMs !== 0) {
        measures.push({
          attribute_id: ATTRIBUTE_IDS.TEMPO_VOLO,
          value: parsed.flightMs.toString(),
        });
        console.log(
          "[Measurement] React/Multi - added flight time:",
          parsed.flightMs,
        );
      }
      if (parsed.contactMs != null && parsed.contactMs !== 0) {
        measures.push({
          attribute_id: ATTRIBUTE_IDS.TEMPO_CONTATTO,
          value: parsed.contactMs.toString(),
        });
        console.log(
          "[Measurement] React/Multi - added contact time:",
          parsed.contactMs,
        );
      }
      break;

    case ACTIVITY_COMMANDS.FEET: // FEET - tempo_contatto then distance
      if (parsed.contactMs != null && parsed.contactMs !== 0) {
        measures.push({
          attribute_id: ATTRIBUTE_IDS.TEMPO_CONTATTO,
          value: parsed.contactMs.toString(),
        });
        console.log(
          "[Measurement] Feet - added contact time:",
          parsed.contactMs,
        );
      }
      if (parsed.distanceCm != null && parsed.distanceCm !== 0) {
        measures.push({
          attribute_id: ATTRIBUTE_IDS.DISTANZA,
          value: parsed.distanceCm.toString(),
        });
        console.log("[Measurement] Feet - added distance:", parsed.distanceCm);
      }
      break;

    default:
      console.warn(
        `[Measurement] Unknown activity command: ${activityCommand}`,
      );
  }

  return measures;
};

/**
 * Prepares measurement data for API request
 * Follows the exact structure from B4A implementation
 *
 * @param {Array} readings - Array of reading objects
 * @param {string} subActivityId - UUID of the sub-activity
 * @param {string} athleteId - UUID of the athlete
 * @param {string} deviceId - UUID of the device
 * @param {string} teamId - UUID of the team
 * @param {string} roleId - UUID of the role (optional)
 * @param {number} weight - Athlete's weight in kg
 * @param {number} height - Athlete's height in cm
 * @param {string} note - Optional note
 * @param {string} activityCommand - Activity command letter
 * @returns {Object|null} Measurement data object or null if invalid
 */
export const prepareMeasurementData = (
  readings,
  subActivityId,
  athleteId,
  deviceId,
  teamId,
  roleId,
  weight,
  height,
  note,
  activityCommand,
) => {
  console.log("[Measurement] Preparing measurement data:", {
    readingsCount: readings?.length,
    subActivityId,
    athleteId,
    deviceId,
    teamId,
    activityCommand,
  });

  // Validation checks (same as B4A)
  if (!readings || readings.length === 0) {
    console.error("[Measurement] No readings to prepare");
    return null;
  }

  if (!subActivityId) {
    console.error("[Measurement] Missing sub_activity_id");
    return null;
  }

  if (!athleteId || athleteId === "unknown") {
    console.error("[Measurement] Missing or invalid athlete_id:", athleteId);
    return null;
  }

  if (!deviceId) {
    console.error("[Measurement] Missing device_id");
    return null;
  }

  if (!teamId) {
    console.error("[Measurement] Missing team_id");
    return null;
  }

  const measures = [];

  // For each reading, create measures based on activity type
  // readings.forEach((reading, index) => {
  //   const readingMeasures = mapReadingToMeasures(reading, activityCommand);

  //   readingMeasures.forEach((measure) => {
  //     if (index === 0){
  //       // first item in the pair takes start as
  //     }
  //     measures.push({
  //       attribute_id: measure.attribute_id,
  //       value: measure.value,
  //       start: index === 0, // First reading has start: true, rest false (matches B4A)
  //     });
  //   });
  // });

  readings.forEach((reading, readingIndex) => {
    const readingMeasures = mapReadingToMeasures(reading, activityCommand);

    readingMeasures.forEach((measure, measureIndex) => {
      let start = false;

      if (readingIndex === 0 && measureIndex === 0) {
        start = true;
      }

      measures.push({
        attribute_id: measure.attribute_id,
        value: measure.value,
        start,
      });
    });
  });

  if (measures.length === 0) {
    console.error("[Measurement] No valid measures extracted from readings");
    return null;
  }

  // Build the exact same structure as B4A's allData Map
  const measurementData = {
    sub_activity_id: subActivityId,
    athlete_id: athleteId,
    device_id: deviceId,
    team_id: teamId,
    weight: weight || 0,
    height: height || 0,
    measures: measures,
  };

  // Add optional fields if provided (matches B4A)
  if (roleId && roleId !== "unknown") {
    measurementData.role_id = roleId;
  }

  if (note && note.trim()) {
    measurementData.note = note;
  }

  console.log("[Measurement] Final measurement data prepared:", {
    ...measurementData,
    measuresCount: measures.length,
  });

  return measurementData;
};

/**
 * Validates if a reading has any measurable attributes
 */
export const hasValidAttributes = (reading, activityCommand) => {
  const measures = mapReadingToMeasures(reading, activityCommand);
  return measures.length > 0;
};
