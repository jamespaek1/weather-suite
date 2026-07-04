import type { WeatherBundle } from "../types";
import {
  aqiDescriptor,
  formatClock,
  formatVisibility,
  round,
  speedUnit,
  uvDescriptor,
  windDirection,
} from "../lib/format";

interface Cell {
  key: string;
  label: string;
  value: string;
  sub?: string;
}

export default function HighlightGrid({ data }: { data: WeatherBundle }) {
  const { current, daily, airQuality, units, timezone } = data;
  const today = daily[0];
  const uv = uvDescriptor(today?.uvIndexMax ?? null);
  const aqi = aqiDescriptor(airQuality?.usAqi ?? null);

  const cells: Cell[] = [
    {
      key: "feels",
      label: "Feels like",
      value: `${round(current.apparentTemperature)}°`,
      sub: "Apparent temp",
    },
    {
      key: "uv",
      label: "UV index",
      value: `${round(today?.uvIndexMax)} · ${uv.label}`,
      sub: uv.advice,
    },
    {
      key: "aqi",
      label: "Air quality",
      value: airQuality?.usAqi != null ? `${round(airQuality.usAqi)} · ${aqi.label}` : "–",
      sub: airQuality?.usAqi != null ? aqi.advice : "Unavailable here",
    },
    {
      key: "wind",
      label: "Wind",
      value: `${round(current.windSpeed)} ${speedUnit(units)} ${windDirection(current.windDirection)}`,
      sub: current.windGust != null ? `Gusts ${round(current.windGust)} ${speedUnit(units)}` : undefined,
    },
    {
      key: "precip",
      label: "Chance of rain",
      value: `${round(today?.precipProbabilityMax)}%`,
      sub: today?.precipSum != null ? `${round(today.precipSum, 1)} mm total` : undefined,
    },
    {
      key: "humidity",
      label: "Humidity",
      value: `${round(current.humidity)}%`,
      sub: "Relative",
    },
    {
      key: "visibility",
      label: "Visibility",
      value: formatVisibility(current.visibility, units),
      sub: current.cloudCover != null ? `${round(current.cloudCover)}% cloud` : undefined,
    },
    {
      key: "sun",
      label: "Sun",
      value: today ? formatClock(today.sunrise, timezone) : "–",
      sub: today ? `Sets ${formatClock(today.sunset, timezone)}` : undefined,
    },
  ];

  return (
    <section className="highlights" aria-label="Conditions detail">
      {cells.map((c) => (
        <div className="highlight card" key={c.key}>
          <span className="highlight__label">{c.label}</span>
          <span className="highlight__value">{c.value}</span>
          {c.sub ? <span className="highlight__sub">{c.sub}</span> : null}
        </div>
      ))}
    </section>
  );
}
