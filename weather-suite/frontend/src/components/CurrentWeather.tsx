import type { WeatherBundle } from "../types";
import { describeCode } from "../lib/weatherCodes";
import { round, tempUnit } from "../lib/format";
import WeatherIcon from "./WeatherIcon";

export default function CurrentWeather({ data }: { data: WeatherBundle }) {
  const { current, place, units, timezone } = data;
  const info = describeCode(current.weatherCode);
  const localTime = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(new Date());

  return (
    <section className="current card card--hero">
      <div className="current__head">
        <h1 className="current__place">{place.name}</h1>
        {place.region ? <p className="current__region">{place.region}</p> : null}
        <p className="current__time">{localTime} · local time</p>
      </div>

      <div className="current__main">
        <div className="current__temp-wrap">
          <span className="current__temp">{round(current.temperature)}</span>
          <span className="current__unit">{tempUnit(units)}</span>
        </div>
        <div className="current__icon" aria-hidden="false">
          <WeatherIcon group={info.group} isDay={current.isDay} size={92} title={info.label} />
        </div>
      </div>

      <div className="current__foot">
        <span className="current__condition">{info.label}</span>
        <span className="current__feels">
          Feels like {round(current.apparentTemperature)}
          {tempUnit(units)}
        </span>
      </div>
    </section>
  );
}
