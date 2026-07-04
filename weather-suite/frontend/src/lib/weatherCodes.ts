/**
 * Open-Meteo reports conditions as WMO weather codes.
 * We collapse them into a small set of visual GROUPS, each of which maps to
 * an icon and a day/night sky theme.
 */
export type WeatherGroup =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

interface CodeInfo {
  label: string;
  group: WeatherGroup;
}

const CODE_MAP: Record<number, CodeInfo> = {
  0: { label: "Clear sky", group: "clear" },
  1: { label: "Mainly clear", group: "clear" },
  2: { label: "Partly cloudy", group: "partly" },
  3: { label: "Overcast", group: "cloudy" },
  45: { label: "Fog", group: "fog" },
  48: { label: "Rime fog", group: "fog" },
  51: { label: "Light drizzle", group: "drizzle" },
  53: { label: "Drizzle", group: "drizzle" },
  55: { label: "Heavy drizzle", group: "drizzle" },
  56: { label: "Freezing drizzle", group: "drizzle" },
  57: { label: "Freezing drizzle", group: "drizzle" },
  61: { label: "Light rain", group: "rain" },
  63: { label: "Rain", group: "rain" },
  65: { label: "Heavy rain", group: "rain" },
  66: { label: "Freezing rain", group: "rain" },
  67: { label: "Freezing rain", group: "rain" },
  71: { label: "Light snow", group: "snow" },
  73: { label: "Snow", group: "snow" },
  75: { label: "Heavy snow", group: "snow" },
  77: { label: "Snow grains", group: "snow" },
  80: { label: "Light showers", group: "rain" },
  81: { label: "Showers", group: "rain" },
  82: { label: "Violent showers", group: "rain" },
  85: { label: "Snow showers", group: "snow" },
  86: { label: "Heavy snow showers", group: "snow" },
  95: { label: "Thunderstorm", group: "thunder" },
  96: { label: "Thunderstorm, hail", group: "thunder" },
  99: { label: "Thunderstorm, hail", group: "thunder" },
};

export function describeCode(code: number): CodeInfo {
  return CODE_MAP[code] ?? { label: "Unknown", group: "cloudy" };
}

export interface SkyTheme {
  /** CSS custom properties applied to the app root. */
  vars: Record<string, string>;
  isNight: boolean;
  group: WeatherGroup;
}

/**
 * Two-stop background gradients per condition, switched for day vs night.
 * `--ink` is the primary text color chosen for contrast against the sky;
 * `--accent` highlights interactive + key data.
 */
export function skyTheme(group: WeatherGroup, isDay: boolean): SkyTheme {
  const night = !isDay;

  // Palette per group. [dayTop, dayBottom, nightTop, nightBottom, accentDay, accentNight]
  const palettes: Record<WeatherGroup, [string, string, string, string, string, string]> = {
    clear:   ["#3E90D6", "#9AD0F0", "#101a3a", "#2a2350", "#FFB454", "#F0C674"],
    partly:  ["#5B93C4", "#A9C6DD", "#16203f", "#2f2c4e", "#FFC36B", "#E7C98C"],
    cloudy:  ["#6E7E91", "#A7B4C2", "#1c2230", "#333a48", "#DCE3EA", "#C3CDDA"],
    fog:     ["#8694A1", "#C2CBD3", "#222831", "#3b424c", "#E3E8EC", "#C9D1D8"],
    drizzle: ["#4C6275", "#8AA0B0", "#161e28", "#2c3947", "#8FD0E6", "#7FB3D5"],
    rain:    ["#3C4C5E", "#6E8295", "#0f1620", "#27323f", "#7FB8E0", "#6FA8D5"],
    snow:    ["#7E96AE", "#D2DEE9", "#222a36", "#414e5e", "#FFFFFF", "#E9F1F8"],
    thunder: ["#2C3140", "#545C70", "#0c0e16", "#26283a", "#FFD166", "#FFCE54"],
  };

  const [dT, dB, nT, nB, aD, aN] = palettes[group];
  const top = night ? nT : dT;
  const bottom = night ? nB : dB;
  const accent = night ? aN : aD;

  // Light skies get dark ink; dark skies get light ink.
  const lightSky = !night && (group === "clear" || group === "partly" || group === "snow" || group === "fog");
  const ink = lightSky ? "#13233b" : "#f4f8ff";
  const inkSoft = lightSky ? "rgba(19,35,59,0.62)" : "rgba(244,248,255,0.68)";
  const cardBg = lightSky ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.10)";
  const cardBorder = lightSky ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.16)";
  const cardStrong = lightSky ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.16)";

  return {
    isNight: night,
    group,
    vars: {
      "--sky-top": top,
      "--sky-bottom": bottom,
      "--accent": accent,
      "--ink": ink,
      "--ink-soft": inkSoft,
      "--card-bg": cardBg,
      "--card-border": cardBorder,
      "--card-strong": cardStrong,
    },
  };
}
