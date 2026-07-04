import { useState } from "react";
import { useWeather } from "./hooks/useWeather";
import { describeCode, skyTheme } from "./lib/weatherCodes";
import { APP_NAME } from "./config";
import SearchBar from "./components/SearchBar";
import BackgroundSky from "./components/BackgroundSky";
import CurrentWeather from "./components/CurrentWeather";
import HighlightGrid from "./components/HighlightGrid";
import HourlyStrip from "./components/HourlyStrip";
import ForecastList from "./components/ForecastList";
import AboutFooter from "./components/AboutFooter";
import { ErrorNotice, Loader, WelcomeNotice } from "./components/Notice";

export default function App() {
  const w = useWeather();
  const [query, setQuery] = useState("");

  // Active theme: follow the conditions of the place being viewed; default to a clear day.
  const themeGroup = w.data ? describeCode(w.data.current.weatherCode).group : "clear";
  const themeIsDay = w.data ? w.data.current.isDay : true;
  const theme = skyTheme(themeGroup, themeIsDay);

  function onExample(q: string) {
    setQuery(q);
    void w.runQuery(q);
  }

  return (
    <div className="app" style={theme.vars as React.CSSProperties} data-night={theme.isNight}>
      <BackgroundSky isNight={theme.isNight} />

      <div className="app__inner">
        <header className="topbar">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__name">{APP_NAME}</span>
          </div>

          <div
            className="unit-toggle"
            role="group"
            aria-label="Temperature units"
          >
            <button
              type="button"
              className={"unit-toggle__btn" + (w.units === "metric" ? " is-active" : "")}
              aria-pressed={w.units === "metric"}
              onClick={() => w.changeUnits("metric")}
            >
              °C
            </button>
            <button
              type="button"
              className={"unit-toggle__btn" + (w.units === "imperial" ? " is-active" : "")}
              aria-pressed={w.units === "imperial"}
              onClick={() => w.changeUnits("imperial")}
            >
              °F
            </button>
          </div>
        </header>

        <div className="hero">
          <p className="hero__eyebrow">Real-time weather, anywhere</p>
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={w.runQuery}
            onSelectPlace={w.selectPlace}
            onLocate={w.locate}
            locating={w.locating}
          />
        </div>

        <main className="content">
          {w.status === "error" && w.error ? (
            <ErrorNotice error={w.error} onRetry={w.retry} />
          ) : w.status === "loading" ? (
            <Loader />
          ) : w.status === "success" && w.data ? (
            <div className="results">
              <div className="results__top">
                <CurrentWeather data={w.data} />
                <HighlightGrid data={w.data} />
              </div>
              <HourlyStrip data={w.data} />
              <ForecastList data={w.data} />
            </div>
          ) : (
            <WelcomeNotice onExample={onExample} />
          )}
        </main>

        <AboutFooter />
      </div>
    </div>
  );
}
