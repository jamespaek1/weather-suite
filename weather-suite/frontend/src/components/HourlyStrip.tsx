import type { WeatherBundle } from "../types";
import { describeCode } from "../lib/weatherCodes";
import { formatHour, round } from "../lib/format";
import WeatherIcon from "./WeatherIcon";

export default function HourlyStrip({ data }: { data: WeatherBundle }) {
  const { hourly, timezone } = data;
  if (hourly.length === 0) return null;

  return (
    <section className="hourly card" aria-label="Next 24 hours">
      <h2 className="section-title">Next 24 hours</h2>
      <div className="hourly__track" role="list">
        {hourly.map((h, i) => {
          const info = describeCode(h.weatherCode);
          return (
            <div className="hourly__cell" role="listitem" key={h.time}>
              <span className="hourly__time">{i === 0 ? "Now" : formatHour(h.time, timezone)}</span>
              <WeatherIcon group={info.group} isDay={h.isDay} size={26} title={info.label} />
              <span className="hourly__temp">{round(h.temperature)}°</span>
              <span className="hourly__pop">
                {h.precipProbability != null ? `${round(h.precipProbability)}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
