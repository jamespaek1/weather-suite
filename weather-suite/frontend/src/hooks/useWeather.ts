import { useCallback, useRef, useState } from "react";
import type { AppError, Place, Units, WeatherBundle } from "../types";
import {
  WeatherError,
  fetchWeather,
  lookupPostalCode,
  parseCoordinates,
  parsePostalCode,
  searchPlaces,
} from "../lib/openMeteo";

type Status = "idle" | "loading" | "success" | "error";

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export function useWeather() {
  const [units, setUnits] = useState<Units>("metric");
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<WeatherBundle | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const lastPlace = useRef<Place | null>(null);

  const load = useCallback(async (place: Place, unitsArg: Units) => {
    lastPlace.current = place;
    setStatus("loading");
    setError(null);
    try {
      const bundle = await fetchWeather(place, unitsArg);
      setData(bundle);
      setStatus("success");
    } catch (e) {
      const appError: AppError =
        e instanceof WeatherError
          ? e.appError
          : { kind: "network", message: "Something went wrong. Please try again." };
      setError(appError);
      setStatus("error");
    }
  }, []);

  /** Free-text submit: coordinates if it parses, otherwise geocode the name. */
  const runQuery = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      setStatus("loading");
      setError(null);
      try {
        const coords = parseCoordinates(q);
        if (coords) {
          const place: Place = {
            id: `coord-${coords.latitude},${coords.longitude}`,
            name: `${fmt(coords.latitude)}, ${fmt(coords.longitude)}`,
            region: "Pinned coordinates",
            country: "",
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
          await load(place, units);
          return;
        }
        const postal = parsePostalCode(q);
        if (postal) {
          const place = await lookupPostalCode(postal);
          await load(place, units);
          return;
        }
        const matches = await searchPlaces(q);
        if (matches.length === 0) {
          setError({ kind: "not-found", query: q });
          setStatus("error");
          return;
        }
        await load(matches[0], units);
      } catch (e) {
        const appError: AppError =
          e instanceof WeatherError
            ? e.appError
            : { kind: "network", message: "Something went wrong. Please try again." };
        setError(appError);
        setStatus("error");
      }
    },
    [load, units]
  );

  const selectPlace = useCallback(
    (place: Place) => {
      void load(place, units);
    },
    [load, units]
  );

  const [locating, setLocating] = useState(false);
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError({ kind: "geolocation", message: "This browser can't share a location." });
      setStatus("error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const place: Place = {
          id: `me-${latitude},${longitude}`,
          name: "Your location",
          region: `${fmt(latitude)}, ${fmt(longitude)}`,
          country: "",
          latitude,
          longitude,
        };
        void load(place, units);
      },
      () => {
        setLocating(false);
        setError({
          kind: "geolocation",
          message: "Location access was blocked. Search for a place instead.",
        });
        setStatus("error");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [load, units]);

  const retry = useCallback(() => {
    if (lastPlace.current) void load(lastPlace.current, units);
  }, [load, units]);

  const changeUnits = useCallback(
    (u: Units) => {
      setUnits(u);
      if (lastPlace.current) void load(lastPlace.current, u);
    },
    [load]
  );

  return {
    units,
    status,
    data,
    error,
    locating,
    runQuery,
    selectPlace,
    locate,
    retry,
    changeUnits,
  };
}
