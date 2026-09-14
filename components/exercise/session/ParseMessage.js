// components/exercise/session/ParseMessage.js

export const COMMANDS = {
  SQUAT: "S",
  DROP: "J",
  REACT: "R",
  MULTI: "U",
  FEET: "F",
  DIAG: "D",
};

// remove non-digit chars from a numeric substring
const onlyDigits = (str) => {
  if (!str) return null;
  const cleaned = str.replace(/\D/g, "");
  return cleaned.length ? cleaned : null;
};

// ── Height from flight time ───────────────────────────────────────────────
// h = (g × t²) / 8  where g=9.81 m/s², t in seconds, result in cm
export const calcJumpHeight = (flightMs) => {
  const t = parseInt(flightMs, 10);
  if (isNaN(t) || t === 0) return null;

  const t_s = t / 1000;
  return Math.round(((9.81 * t_s * t_s) / 8) * 100 * 10) / 10;
};

// ── Bosco power ───────────────────────────────────────────────────────────
// P = (96.2361 × Σflight_s × (Σflight_s + Σcontact_s)) / (4 × n × Σcontact_s)
export const calcPower = (sumFlightS, sumContactS, nJumps) => {
  if (!nJumps || !sumContactS) return null;

  return (
    Math.round(
      ((96.2361 * sumFlightS * (sumFlightS + sumContactS)) /
        (4 * nJumps * sumContactS)) *
        100,
    ) / 100
  );
};

// ── Feet distance ─────────────────────────────────────────────────────────
export const calcFeetDistance = (ledBits) => {
  if (!ledBits || ledBits.length < 23) return null;

  const firstLit = ledBits.indexOf("1");
  if (firstLit === -1) return null;

  return Math.round(((firstLit + 1) * 3.8 + 5) * 10) / 10;
};

// ── Activity metadata ─────────────────────────────────────────────────────
export const getActivityMeta = (command) => {
  switch (command?.toUpperCase()) {
    case COMMANDS.SQUAT:
      return {
        label: "Squat Jump",
        showPower: false,
        multiReading: false,
        liveOrder: ["height", "ft"], // ✅ FIXED
      };

    case COMMANDS.DROP:
      return {
        label: "Drop Jump",
        showPower: false,
        multiReading: false,
        liveOrder: ["height", "ct"], // Drop uses contact
      };

    case COMMANDS.MULTI:
      return {
        label: "Multi Jump",
        showPower: true,
        multiReading: true,
        liveOrder: ["height", "ct", "ft", "power"],
      };

    case COMMANDS.FEET:
      return {
        label: "Feet / Photocell",
        showPower: false,
        multiReading: false,
        liveOrder: ["ct", "distance"],
      };

    case COMMANDS.REACT:
      return {
        label: "Reactive Strength",
        showPower: true,
        multiReading: true,
        liveOrder: ["height", "ct", "power"],
      };

    default:
      return {
        label: "Measurement",
        showPower: false,
        multiReading: false,
        liveOrder: ["ft"],
      };
  }
};

// ── Find attribute label from API attributes ───────────────────────────────
export const findAttributeLabel = (attributes, key) => {
  if (!Array.isArray(attributes)) return key;

  const wanted = key.toLowerCase();

  const match = attributes.find((a) => {
    const name = (a?.name ?? "").toLowerCase();
    const code = (a?.code ?? "").toLowerCase();
    const shortName = (a?.short_name ?? "").toLowerCase();

    return (
      code === wanted ||
      shortName === wanted ||
      name === wanted ||
      name.includes(wanted)
    );
  });

  if (!match) return key;

  return match.short_name ?? match.code ?? match.name ?? key;
};

// ── Get attribute value by key ─────────────────────────────────────────────
export const getAttributeValue = (key, parsedData) => {
  const {
    flightMs,
    contactMs,
    derived = {},
    heightCm,
    distanceCm,
    power,
  } = parsedData ?? {};

  const resolvedHeight = derived.heightCm ?? heightCm ?? null;
  const resolvedDistance = derived.distanceCm ?? distanceCm ?? null;
  const resolvedPower = derived.power ?? power ?? null;

  switch (key) {
    case "ct":
      return { value: contactMs ?? null, unit: "ms" };

    case "ft":
      return { value: flightMs ?? null, unit: "ms" };

    case "height":
      return { value: resolvedHeight, unit: "cm" };

    case "distance":
      return { value: resolvedDistance, unit: "cm" };

    case "power":
      return { value: resolvedPower, unit: "W/kg" };

    default:
      return { value: null, unit: null };
  }
};

// ── Full message parse ────────────────────────────────────────────────────
export const parseActivityMessage = (raw) => {
  if (!raw || raw.length < 4) return null;

  const command = raw[0]?.toUpperCase() ?? "";
  const battery1 = raw[1] ?? null;
  const battery2 = raw[2] ?? null;
  const status = raw[3]?.toUpperCase() ?? null;

  if (!command || !status) return null;

  // status-only packets
  if (status !== "M") {
    return {
      status,
      raw,
      command,
      battery1,
      battery2,

      flightMs: null,
      contactMs: null,
      heightCm: null,
      distanceCm: null,
      ledBits: null,

      derived: {
        heightCm: null,
        distanceCm: null,
        power: null,
      },
    };
  }

  // ── FEET ────────────────────────────────────────────────────────────────
  if (command === COMMANDS.FEET) {
    const ledBits = raw.slice(5, 28); // 23 chars
    const contactRaw = raw.slice(28, 32);
    const contactMs = onlyDigits(contactRaw);

    const distanceCm = calcFeetDistance(ledBits);

    return {
      status,
      raw,
      command,
      battery1,
      battery2,

      flightMs: null,
      contactMs,
      heightCm: null,
      distanceCm,
      ledBits,

      derived: {
        heightCm: null,
        distanceCm,
        power: null,
      },
    };
  }

  // ── SQUAT ───────────────────────────────────────────────────────────────
  if (command === COMMANDS.SQUAT) {
    const flightRaw = raw.slice(4, 8);
    const flightMs = onlyDigits(flightRaw);

    const heightCm = flightMs ? calcJumpHeight(flightMs) : null;

    return {
      status,
      raw,
      command,
      battery1,
      battery2,

      flightMs,
      contactMs: null,
      heightCm,
      distanceCm: null,
      ledBits: null,

      derived: {
        heightCm,
        distanceCm: null,
        power: null,
      },
    };
  }

  // ── DROP / REACT / MULTI ────────────────────────────────────────────────
  const flightRaw = raw.slice(4, 8);
  const contactRaw = raw.slice(8, 12);

  const flightMs = onlyDigits(flightRaw);
  const contactMs = onlyDigits(contactRaw);

  const heightCm = flightMs ? calcJumpHeight(flightMs) : null;

  return {
    status,
    raw,
    command,
    battery1,
    battery2,

    flightMs,
    contactMs,
    heightCm,
    distanceCm: null,
    ledBits: null,

    derived: {
      heightCm,
      distanceCm: null,
      power: null,
    },
  };
};
