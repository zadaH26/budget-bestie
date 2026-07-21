import type { HeadingFontId, ThemeChartStyle, ThemePreset } from "../types/domain";

export const LIGHT_PALETTE = {
  bg: "#ede9f5",
  panel: "#ddd6ea",
  panel2: "#f7f4fc",
  card: "#ffffff",
  border: "rgba(35, 20, 54, 0.14)",
  text: "#1f132f",
  muted: "rgba(31, 19, 47, 0.62)",
  accent: "#b787e6",
  good: "#1fa27a",
  warn: "#c58735",
  bad: "#c94a72",
};

export const DARK_PALETTE = {
  bg: "#090a16",
  panel: "#12142a",
  panel2: "#0f1226",
  card: "#1a1e3a",
  border: "rgba(238, 235, 255, 0.16)",
  text: "#f0efff",
  muted: "rgba(240, 239, 255, 0.72)",
  accent: "#8b7bff",
  good: "#2ccf9d",
  warn: "#f0bb69",
  bad: "#ff7aa7",
};

export let PALETTE = LIGHT_PALETTE;

function sanitizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const s = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

export const HEADING_FONT_OPTIONS: Array<{ id: HeadingFontId; label: string; stack: string }> = [
  {
    id: "serif",
    label: "Serif Editorial",
    stack: "Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif",
  },
  {
    id: "modern",
    label: "Modern Sans",
    stack: "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "classic",
    label: "Classic Serif",
    stack: "Georgia, 'Times New Roman', Times, serif",
  },
];

export const DEFAULT_UI_RADIUS = 14;
export const DEFAULT_UI_SHADOW = 10;
export const DEFAULT_UI_GLASS = 92;
export const DEFAULT_UI_MOTION_MS = 220;
export const COLOR_SWATCHES = [
  "#f6edf9",
  "#ecdff5",
  "#decdf1",
  "#cfb8eb",
  "#be9fe3",
  "#ab88da",
  "#d8b8eb",
  "#e6c1dd",
  "#f0c6d8",
  "#f4d2df",
  "#e7d0f5",
  "#d4d8f8",
  "#c4def8",
  "#b8e7f1",
  "#bde6df",
  "#d0e8d1",
  "#f2e2c6",
  "#f0ceb8",
  "#ffffff",
  "#f6f6fb",
  "#ececf6",
  "#d8d8e8",
  "#26253f",
  "#11142d",
];

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "lavender_bloom",
    label: "Lavender Bloom",
    note: "",
    mode: "light",
    accent: "#b787e6",
    bg: "#ede9f5",
    panel: "#ddd6ea",
    panel2: "#f7f4fc",
    card: "#ffffff",
  },
  {
    id: "violet_night",
    label: "Violet Night",
    note: "",
    mode: "dark",
    accent: "#8b7bff",
    bg: "#090a16",
    panel: "#12142a",
    panel2: "#0f1226",
    card: "#1a1e3a",
  },
  {
    id: "rose_mist",
    label: "Rose Mist",
    note: "",
    mode: "light",
    accent: "#d892c0",
    bg: "#cbc7d2",
    panel: "#d8d3df",
    panel2: "#eeebf4",
    card: "#ffffff",
  },
  {
    id: "frost_lilac",
    label: "Frost Lilac",
    note: "",
    mode: "light",
    accent: "#b29be8",
    bg: "#c9c6d4",
    panel: "#d6d2e1",
    panel2: "#efecf7",
    card: "#ffffff",
  },
  {
    id: "enterprise_blue",
    label: "Enterprise Blue",
    note: "",
    mode: "light",
    accent: "#3d86f0",
    bg: "#e8f1ff",
    panel: "#d9e7fb",
    panel2: "#f4f8ff",
    card: "#ffffff",
  },
  {
    id: "neon_pay",
    label: "Neon Pay",
    note: "",
    mode: "dark",
    accent: "#785dff",
    bg: "#080a1a",
    panel: "#121530",
    panel2: "#0e122d",
    card: "#1a1f45",
  },
];

export function resolveActiveThemePresetId(
  mode: "light" | "dark",
  accent: string,
  bg: string,
  panel: string,
  panel2: string,
  card: string,
  presets: ThemePreset[] = THEME_PRESETS
): string | null {
  return (
    presets.find(
      (preset) =>
        preset.mode === mode &&
        preset.accent.toLowerCase() === accent.toLowerCase() &&
        preset.bg.toLowerCase() === bg.toLowerCase() &&
        preset.panel.toLowerCase() === panel.toLowerCase() &&
        preset.panel2.toLowerCase() === panel2.toLowerCase() &&
        preset.card.toLowerCase() === card.toLowerCase()
    )?.id ?? null
  );
}

export function chartStyleForTheme(presetId: string | null, isDark: boolean, accent: string): ThemeChartStyle {
  const fallbackAccent = sanitizeHexColor(accent, isDark ? "#8b7bff" : "#b787e6");

  switch (presetId) {
    case "lavender_bloom":
      return {
        pie: ["#c8afe9", "#e6bdd8", "#d5c6f2", "#f0d8e8", "#b9d0f5", "#cfd6ef"],
        trend: "#9f7add",
        trendSoft: "#d5a5cb",
        bar: "#b88fe4",
        goal: "#8f70d2",
        plan: "#ca9acc",
        gap: "#c95679",
        band: "#c6b4e8",
      };
    case "rose_mist":
      return {
        pie: [
          "#d98db8",
          "#bda6e4",
          "#ebb2d1",
          "#c9b4ea",
          "#f0c5db",
          "#b79fdd",
          "#f4bfd0",
          "#ccb2ef",
          "#e8a7c8",
          "#b69ee8",
        ],
        trend: "#c786bb",
        trendSoft: "#b39fe6",
        bar: "#d58fbe",
        goal: "#be7eb6",
        plan: "#a992de",
        gap: "#c44f76",
        band: "#d9b6d9",
      };
    case "frost_lilac":
      return {
        pie: [
          "#b19ae1",
          "#cfafe6",
          "#c5b3eb",
          "#e6bcda",
          "#adc0f0",
          "#d8c1ea",
          "#c2a9e9",
          "#e0b9e1",
          "#b5c2f5",
          "#d4b5ec",
        ],
        trend: "#a68add",
        trendSoft: "#d0a8d6",
        bar: "#b79ce7",
        goal: "#9a82d7",
        plan: "#c4a0d4",
        gap: "#bf5077",
        band: "#c7b8eb",
      };
    case "enterprise_blue":
      return {
        pie: ["#64a9ff", "#8bc0ff", "#6dd2d6", "#9ed0ff", "#7a9ef5", "#7bc7f1"],
        trend: "#4f95f2",
        trendSoft: "#78b0f8",
        bar: "#4b90f0",
        goal: "#4f95f2",
        plan: "#33b5c6",
        gap: "#d7576f",
        band: "#8dbcf7",
      };
    case "violet_night":
      return {
        pie: ["#8e7bff", "#ca86ff", "#6bb7ff", "#a191ff", "#e69cff", "#60d3ca"],
        trend: "#9b89ff",
        trendSoft: "#c58dff",
        bar: "#8f7cff",
        goal: "#9f8aff",
        plan: "#52d2b0",
        gap: "#ff7aa7",
        band: "#b5a8ff",
      };
    case "neon_pay":
      return {
        pie: ["#8069ff", "#b782ff", "#5d9dff", "#9f7eff", "#f08acf", "#4ec9cd"],
        trend: "#8573ff",
        trendSoft: "#b58aff",
        bar: "#7c68ff",
        goal: "#9182ff",
        plan: "#54d0b2",
        gap: "#ff7aa7",
        band: "#a89cfb",
      };
    default:
      return {
        pie: [
          fallbackAccent,
          isDark ? "#9f8bff" : "#d59cc9",
          isDark ? "#57b8ff" : "#b6c2f2",
          isDark ? "#57d0ba" : "#e6b7d5",
          isDark ? "#f0aa72" : "#f2c5dc",
          isDark ? "#7db9ff" : "#cfb3ec",
        ],
        trend: fallbackAccent,
        trendSoft: isDark ? "#b692ff" : "#d1a3ce",
        bar: fallbackAccent,
        goal: fallbackAccent,
        plan: isDark ? "#58d2b3" : "#be9cd8",
        gap: isDark ? "#ff7ea8" : "#c84f77",
        band: isDark ? "#ab9fff" : "#cab7e8",
      };
  }
}

export let UI_THEME = {
  radius: DEFAULT_UI_RADIUS,
  shadow: DEFAULT_UI_SHADOW,
  glass: DEFAULT_UI_GLASS,
  motionMs: DEFAULT_UI_MOTION_MS,
  headingFontStack: HEADING_FONT_OPTIONS[0].stack,
  isDark: false,
};

export type Palette = typeof LIGHT_PALETTE;
export type UiThemeSettings = typeof UI_THEME;

export function setPalette(nextPalette: Palette) {
  PALETTE = nextPalette;
}

export function setUiTheme(nextTheme: UiThemeSettings) {
  UI_THEME = nextTheme;
}
