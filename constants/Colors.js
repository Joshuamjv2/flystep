// Primary:   #2B7BBB (Pantone 285)
// Secondary: #23AEB7 (Pantone 7710) — teal, NOT green
// Text/Dark: #161F28 (Pantone Black 6)
// Tertiary:  #C4B221 (Pantone 7759) — gold accent
// Gradient:  #2B7BBB → #23AEB7
// Font:      Plus Jakarta Sans (Light, Medium, ExtraBold)

export const Colors = {
  // ── Brand primitives ──────────────────────────────────────────────────
  primary: "#2B7BBB", // Pantone 285 — use for large text/icons only (4:1 on white)
  secondary: "#23AEB7", // Pantone 7710 — icons/accents only on light; text-safe on dark
  tertiary: "#C4B221", // Pantone 7759 — gold; text-safe on dark only (~8:1)
  warning: "#CC475A", // Not in brand book — UI utility for destructive actions

  // ── Gradient (primary → secondary, use for hero/splash surfaces) ─────
  gradient: {
    start: "#2B7BBB",
    end: "#23AEB7",
  },

  dark: {
    // Base layers — derived from brand's #161F28 "Seere Text" dark
    background: "#161F28", // brand dark base
    uiBackground: "#1B2530", // cards/surfaces — slightly lifted
    navBackground: "#111820", // nav slightly deeper for separation

    // Text — all pass AA on #161F28 (≥4.5:1)
    title: "#FFFFFF", // 14:1 ✓
    text: "#D6D4E0", // ~9:1 ✓ — softened from pure white
    subtleText: "#8A8A9A", // ~4.6:1 ✓ — muted hints/placeholders

    // Icons
    iconColor: "#8A8A9A", // neutral, matches subtleText
    iconColorFocused: "#23AEB7", // brand secondary — ~7:1 on dark ✓

    // Borders / Dividers
    border: "#2C3A4A", // subtle, slightly blue-tinted to feel on-brand

    // Elevation
    shadow: "rgba(0, 0, 0, 0.5)",

    // Brand accent surfaces (e.g. highlighted cards, badges)
    accentSurface: "rgba(43, 123, 187, 0.15)", // primary tint
  },

  light: {
    // Base layers
    background: "#F3F2F8", // soft off-white, reduces glare
    uiBackground: "#FFFFFF", // cards/surfaces pure white
    navBackground: "#E8E7F0", // slightly darker for structure

    // Text — all pass AA on #FFFFFF / #F3F2F8
    title: "#161F28", // brand dark — 14:1 on white ✓
    text: "#1E2B3A", // body — ~13:1 ✓
    subtleText: "#6B6880", // ~5.3:1 on white ✓

    // Icons
    iconColor: "#6B6880", // matches subtleText
    iconColorFocused: "#2B7BBB", // primary — 4.2:1 on white (large/icon safe ✓)

    // Borders / Dividers
    border: "#D0CED8",

    // Elevation
    shadow: "rgba(0, 0, 0, 0.08)",

    // Brand accent surfaces
    accentSurface: "rgba(43, 123, 187, 0.08)", // primary tint
  },
};
