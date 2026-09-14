// constants/attributeConstants.js

/**
 * Attribute UUIDs directly from the B4A code
 * These match the exact UUIDs used in the original implementation
 */
export const ATTRIBUTE_IDS = {
  // From B4A drop page (riempi_drop)
  TEMPO_VOLO: "d4ebb79e-a0a8-4550-8bc4-e4336b8490a3", // Flight time
  TEMPO_CONTATTO: "f5daa493-5054-4ad2-97b0-d9db95e7cdd6", // Contact time

  // From B4A feet page (salva_dati)
  DISTANZA: "73e0ac8f-b5e8-44f3-9557-2db5bb98c8ce", // Distance
};

// Activity command mapping (same as B4A)
export const ACTIVITY_COMMANDS = {
  SQUAT: "S",
  DROP: "J",
  REACT: "R",
  MULTI: "U",
  FEET: "F",
  DIAG: "D",
};
