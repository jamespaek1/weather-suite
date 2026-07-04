import type { WeatherBundle } from "../types";
import { describeCode } from "../lib/weatherCodes";
import { formatDayDate, formatDayLabel, round } from "../lib/format";
import WeatherIcon from "./WeatherIcon";

export default function ForecastList({ data }: { data: WeatherBundle }) {
  const { daily, timezone } = data;
  if (daily.length === 0) return null;

  // Shared temperature scale across the 5 days so the range bars are comparable.
  const lows = daily.map((d) => d.tempMin);
  const highs = daily.map((d) => d.tempMax);
  const scaleMin = Math.min(...lows);
  const scaleMax = Math.max(...highs);
  const span = Math.max(1, scaleMax - scaleMin);

  return (
    <section className="forecast card" aria-label="5-day forecast">
      <h2 className="section-title">5-day forecast</h2>
      <ul className="forecast__list">
        {daily.map((d, i) => {
          const info = describeCode(d.weatherCode);
          const left = ((d.tempMin - scaleMin) / span) * 100;
          const width = ((d.tempMax - d.tempMin) / span) * 100;
          return (
            <li className="forecast__row" key={d.date}>
              <div className="forecast__day">
                <span className="forecast__day-name">{formatDayLabel(d.date, timezone, i)}</span>
                <span className="forecast__day-date">{formatDayDate(d.date, timezone)}</span>
              </div>

              <div className="forecast__cond">
                {/* Daytime icon for the daily summary. */}
                <WeatherIcon group={info.group} isDay={true} size={28} title={info.label} />
                <span className="forecast__cond-label">{info.label}</span>
              </div>

              <div className="forecast__pop">
                {d.precipProbabilityMax != null && d.precipProbabilityMax > 0
                  ? `${round(d.precipProbabilityMax)}%`
                  : ""}
              </div>

              <div className="forecast__range">
                <span className="forecast__lo">{round(d.tempMin)}°</span>
                <div className="forecast__bar">
                  <div
                    className="forecast__bar-fill"
                    style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
                  />
                </div>
                <span className="forecast__hi">{round(d.tempMax)}°</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
