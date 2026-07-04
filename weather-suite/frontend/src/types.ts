/** A geocoding match returned by the location search. */
export interface Place {
  id: string;
  name: string;
  /** e.g. "California, United States" */
  region: string;
  country: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export type Units = "metric" | "imperial";

/** One entry in the hourly outlook. */
export interface HourPoint {
  time: string; // ISO local time
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  precipProbability: number | null;
}

/** One day in the multi-day forecast. */
export interface DayPoint {
  date: string; // ISO date (local)
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number | null;
  precipProbabilityMax: number | null;
  precipSum: number | null;
  windMax: number | null;
}

/** Current conditions for a place. */
export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  isDay: boolean;
  humidity: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  pressure: number | null;
  cloudCover: number | null;
  visibility: number | null; // meters
  precipitation: number | null;
}

export interface AirQuality {
  usAqi: number | null;
  pm2_5: number | null;
}

/** Everything the UI needs after a successful fetch. */
export interface WeatherBundle {
  place: Place;
  units: Units;
  current: CurrentWeather;
  hourly: HourPoint[];
  daily: DayPoint[];
  airQuality: AirQuality | null;
  /** IANA timezone resolved by the API for this place. */
  timezone: string;
}

/** Discriminated error type so the UI can react to the cause. */
export type AppError =
  | { kind: "not-found"; query: string }
  | { kind: "network"; message: string }
  | { kind: "geolocation"; message: string }
  | { kind: "bad-input"; message: string };
