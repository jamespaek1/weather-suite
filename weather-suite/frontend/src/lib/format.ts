import type { Units } from "../types";

export function tempUnit(units: Units): string {
  return units === "metric" ? "°C" : "°F";
}

export function speedUnit(units: Units): string {
  return units === "metric" ? "km/h" : "mph";
}

export function distanceUnit(units: Units): string {
  return units === "metric" ? "km" : "mi";
}

export function round(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  const f = Math.pow(10, digits);
  return String(Math.round(n * f) / f);
}

/** Open-Meteo gives visibility in meters; present it in km/mi. */
export function formatVisibility(meters: number | null, units: Units): string {
  if (meters === null || Number.isNaN(meters)) return "–";
  if (units === "metric") return `${round(meters / 1000, 1)} km`;
  return `${round(meters / 1609.34, 1)} mi`;
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export function windDirection(deg: number | null): string {
  if (deg === null || Number.isNaN(deg)) return "";
  return COMPASS[Math.round(deg / 22.5) % 16];
}

/** Short UV guidance — one of the "non-obvious" things travelers should check. */
export function uvDescriptor(uv: number | null): { label: string; advice: string } {
  if (uv === null || Number.isNaN(uv)) return { label: "–", advice: "" };
  if (uv < 3) return { label: "Low", advice: "No protection needed" };
  if (uv < 6) return { label: "Moderate", advice: "Sunscreen midday" };
  if (uv < 8) return { label: "High", advice: "Cover up, SPF 30+" };
  if (uv < 11) return { label: "Very high", advice: "Avoid midday sun" };
  return { label: "Extreme", advice: "Stay in the shade" };
}

/** US EPA AQI bands. */
export function aqiDescriptor(aqi: number | null): { label: string; advice: string } {
  if (aqi === null || Number.isNaN(aqi)) return { label: "–", advice: "" };
  if (aqi <= 50) return { label: "Good", advice: "Air is clean" };
  if (aqi <= 100) return { label: "Moderate", advice: "Fine for most" };
  if (aqi <= 150) return { label: "Sensitive", advice: "Caution if sensitive" };
  if (aqi <= 200) return { label: "Unhealthy", advice: "Limit exertion" };
  if (aqi <= 300) return { label: "Very unhealthy", advice: "Avoid outdoor effort" };
  return { label: "Hazardous", advice: "Stay indoors" };
}

/** Format an ISO datetime to a destination-local clock time, e.g. "3 PM". */
export function formatHour(iso: string, timezone: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
    timeZone: timezone,
  }).format(d);
}

/** Format an ISO time to "6:42 AM" for sunrise/sunset. */
export function formatClock(iso: string, timezone: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(d);
}

/** Day label for forecast cards: "Today", "Tomorrow", or weekday + date. */
export function formatDayLabel(isoDate: string, timezone: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  const d = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).format(d);
}

export function formatDayDate(isoDate: string, timezone: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(d);
}
