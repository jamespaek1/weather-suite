import { chooseSource, parseCoordinates } from "./validation.js";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`Upstream weather service error (${res.status}).`);
    err.status = 502;
    throw err;
  }
  return res.json();
}

/** Geocode a place name to its top match. */
export async function geocode(name) {
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const data = await getJson(url);
  const r = data.results?.[0];
  if (!r) return null;
  return {
    resolvedName: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    country: r.country ?? "",
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? "auto",
  };
}

/** Geocode a name to up to `count` matches (for autocomplete). */
export async function geocodeMany(name, count = 5) {
  if (!name || name.trim().length < 2) return [];
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=${count}&language=en&format=json`;
  const data = await getJson(url);
  return (data.results ?? []).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/**
 * Resolve a location string to a place object (coordinates or geocoded name).
 * Throws { status: 404 } when a name can't be found.
 */
export async function resolveLocation(input) {
  const coords = parseCoordinates(input); // may throw 400 for bad range
  if (coords) {
    return {
      resolvedName: `${coords.latitude}, ${coords.longitude}`,
      region: "Pinned coordinates",
      country: "",
      latitude: coords.latitude,
      longitude: coords.longitude,
      timezone: "auto",
    };
  }
  const place = await geocode(input);
  if (!place) {
    const err = new Error(`No place found for "${input}". Try a city, landmark, or coordinates.`);
    err.status = 404;
    throw err;
  }
  return place;
}

const DAILY_VARS =
  "weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean," +
  "precipitation_sum,wind_speed_10m_max,sunrise,sunset";

function normalizeDaily(data) {
  const d = data.daily ?? {};
  const dates = d.time ?? [];
  return dates.map((date, i) => ({
    date,
    weatherCode: d.weather_code?.[i] ?? null,
    tempMax: d.temperature_2m_max?.[i] ?? null,
    tempMin: d.temperature_2m_min?.[i] ?? null,
    tempMean: d.temperature_2m_mean?.[i] ?? null,
    precipSum: d.precipitation_sum?.[i] ?? null,
    windMax: d.wind_speed_10m_max?.[i] ?? null,
    sunrise: d.sunrise?.[i] ?? null,
    sunset: d.sunset?.[i] ?? null,
  }));
}

/**
 * Fetch daily weather for a coordinate + date range.
 * Picks the archive (historical) or forecast product automatically.
 */
export async function fetchRange(latitude, longitude, startDate, endDate, units = "metric") {
  const source = chooseSource(startDate, endDate);
  const base = source === "archive" ? ARCHIVE_URL : FORECAST_URL;
  const unitParams =
    units === "imperial"
      ? "temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch"
      : "temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm";

  const url =
    `${base}?latitude=${latitude}&longitude=${longitude}` +
    `&daily=${DAILY_VARS}&timezone=auto&start_date=${startDate}&end_date=${endDate}&${unitParams}`;

  const data = await getJson(url);
  return {
    source,
    timezone: data.timezone ?? "auto",
    units,
    days: normalizeDaily(data),
  };
}

/** Current air quality (US AQI + PM2.5). Non-fatal: returns null on failure. */
export async function fetchAirQuality(latitude, longitude) {
  try {
    const url = `${AIR_URL}?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10&timezone=auto`;
    const data = await getJson(url);
    const c = data.current ?? {};
    return { usAqi: c.us_aqi ?? null, pm2_5: c.pm2_5 ?? null, pm10: c.pm10 ?? null };
  } catch {
    return null;
  }
}
