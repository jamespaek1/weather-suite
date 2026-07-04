import type {
  AirQuality,
  AppError,
  CurrentWeather,
  DayPoint,
  HourPoint,
  Place,
  Units,
  WeatherBundle,
} from "../types";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

/** Error that carries a structured cause for the UI. */
export class WeatherError extends Error {
  appError: AppError;
  constructor(appError: AppError) {
    super(appError.kind);
    this.appError = appError;
  }
}

async function getJson(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new WeatherError({
      kind: "network",
      message: "Couldn't reach the weather service. Check your connection.",
    });
  }
  if (!res.ok) {
    throw new WeatherError({
      kind: "network",
      message: `The weather service responded with an error (${res.status}).`,
    });
  }
  return res.json();
}

/**
 * If the user typed coordinates ("33.75, -84.39" or "33.75 -84.39"),
 * return them directly instead of hitting the geocoder.
 */
export function parseCoordinates(query: string): { latitude: number; longitude: number } | null {
  const m = query
    .trim()
    .match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const latitude = parseFloat(m[1]);
  const longitude = parseFloat(m[2]);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new WeatherError({
      kind: "bad-input",
      message: "Those coordinates are out of range (lat -90..90, lon -180..180).",
    });
  }
  return { latitude, longitude };
}

/**
 * Detect a ZIP / postal code. Returns { country, code } or null.
 * - A bare 5-digit code (optionally ZIP+4) is treated as US.
 * - "<code>, <2-letter country>" (e.g. "75008, fr", "SW1A 1AA, gb") works
 *   internationally. The code part must contain a digit, so plain
 *   "City, CC" inputs fall through to the name geocoder untouched.
 */
export function parsePostalCode(query: string): { country: string; code: string } | null {
  const q = query.trim();
  const withCountry = q.match(/^(?=[^,]*\d)([A-Za-z0-9][A-Za-z0-9 -]{0,9})\s*,\s*([A-Za-z]{2})$/);
  if (withCountry) {
    return { code: withCountry[1].trim(), country: withCountry[2].toLowerCase() };
  }
  const usZip = q.match(/^(\d{5})(?:-\d{4})?$/);
  if (usZip) return { code: usZip[1], country: "us" };
  return null;
}

/** Resolve a ZIP / postal code to a place via Zippopotam.us (free, no key). */
export async function lookupPostalCode(loc: { country: string; code: string }): Promise<Place> {
  const url = `https://api.zippopotam.us/${loc.country}/${encodeURIComponent(loc.code)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new WeatherError({
      kind: "network",
      message: "Couldn't reach the postal-code lookup service.",
    });
  }
  if (res.status === 404) {
    throw new WeatherError({ kind: "not-found", query: `${loc.code} (${loc.country.toUpperCase()})` });
  }
  if (!res.ok) {
    throw new WeatherError({ kind: "network", message: `Postal-code lookup failed (${res.status}).` });
  }
  const data = await res.json();
  const p = data.places?.[0];
  if (!p) {
    throw new WeatherError({ kind: "not-found", query: `${loc.code} (${loc.country.toUpperCase()})` });
  }
  const country: string = data.country ?? loc.country.toUpperCase();
  const state: string = p.state ?? p["state abbreviation"] ?? "";
  return {
    id: `zip-${loc.country}-${loc.code}`,
    name: p["place name"],
    region: [state, country].filter(Boolean).join(", "),
    country,
    latitude: parseFloat(p.latitude),
    longitude: parseFloat(p.longitude),
  };
}

/** Search places by name (city, town, landmark). Returns up to 5 matches. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `${GEO_URL}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const data = await getJson(url);
  const results = data.results;
  if (!Array.isArray(results) || results.length === 0) return [];
  return results.map((r: any): Place => ({
    id: String(r.id),
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    country: r.country ?? "",
    countryCode: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }));
}

function unitParams(units: Units): string {
  if (units === "imperial") {
    return "temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch";
  }
  return "temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm";
}

/** Index of the hourly entry that matches "now" so the hourly strip starts at the current hour. */
function findStartIndex(times: string[], currentTime: string): number {
  const exact = times.indexOf(currentTime);
  if (exact !== -1) return exact;
  const nowMs = Date.now();
  const idx = times.findIndex((t) => new Date(t).getTime() >= nowMs);
  return idx === -1 ? 0 : idx;
}

/** Air quality is a separate endpoint; failure here is non-fatal. */
async function fetchAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
  try {
    const url = `${AIR_URL}?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5&timezone=auto`;
    const data = await getJson(url);
    const c = data.current ?? {};
    return {
      usAqi: c.us_aqi ?? null,
      pm2_5: c.pm2_5 ?? null,
    };
  } catch {
    return null; // degrade gracefully — the rest of the app still works
  }
}

/** Fetch the full weather bundle for a place. */
export async function fetchWeather(place: Place, units: Units): Promise<WeatherBundle> {
  const { latitude, longitude } = place;
  const current =
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation," +
    "weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility";
  const hourly = "temperature_2m,precipitation_probability,weather_code,is_day";
  const daily =
    "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset," +
    "uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max";

  const url =
    `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&current=${current}&hourly=${hourly}&daily=${daily}` +
    `&timezone=auto&forecast_days=7&${unitParams(units)}`;

  const [data, airQuality] = await Promise.all([
    getJson(url),
    fetchAirQuality(latitude, longitude),
  ]);

  const timezone: string = data.timezone ?? place.timezone ?? "auto";

  const cur = data.current ?? {};
  const currentWeather: CurrentWeather = {
    temperature: cur.temperature_2m,
    apparentTemperature: cur.apparent_temperature,
    weatherCode: cur.weather_code,
    isDay: cur.is_day === 1,
    humidity: cur.relative_humidity_2m ?? null,
    windSpeed: cur.wind_speed_10m ?? null,
    windGust: cur.wind_gusts_10m ?? null,
    windDirection: cur.wind_direction_10m ?? null,
    pressure: cur.pressure_msl ?? null,
    cloudCover: cur.cloud_cover ?? null,
    visibility: cur.visibility ?? null,
    precipitation: cur.precipitation ?? null,
  };

  // Hourly: next 24 hours from now.
  const h = data.hourly ?? {};
  const times: string[] = h.time ?? [];
  const start = findStartIndex(times, cur.time);
  const hourlyPoints: HourPoint[] = [];
  for (let i = start; i < Math.min(start + 24, times.length); i++) {
    hourlyPoints.push({
      time: times[i],
      temperature: h.temperature_2m?.[i],
      weatherCode: h.weather_code?.[i],
      isDay: h.is_day?.[i] === 1,
      precipProbability: h.precipitation_probability?.[i] ?? null,
    });
  }

  // Daily: take 5 days for the headline forecast.
  const d = data.daily ?? {};
  const dayTimes: string[] = d.time ?? [];
  const dailyPoints: DayPoint[] = [];
  for (let i = 0; i < Math.min(5, dayTimes.length); i++) {
    dailyPoints.push({
      date: dayTimes[i],
      weatherCode: d.weather_code?.[i],
      tempMax: d.temperature_2m_max?.[i],
      tempMin: d.temperature_2m_min?.[i],
      sunrise: d.sunrise?.[i],
      sunset: d.sunset?.[i],
      uvIndexMax: d.uv_index_max?.[i] ?? null,
      precipProbabilityMax: d.precipitation_probability_max?.[i] ?? null,
      precipSum: d.precipitation_sum?.[i] ?? null,
      windMax: d.wind_speed_10m_max?.[i] ?? null,
    });
  }

  return {
    place,
    units,
    current: currentWeather,
    hourly: hourlyPoints,
    daily: dailyPoints,
    airQuality,
    timezone,
  };
}
