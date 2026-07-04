# Skyline — Weather App (Tech Assessment #1)

A real-time weather web app built with **React + TypeScript + Vite**. Search any
place on Earth — or use your current location — and get current conditions, the
next 24 hours, and a 5-day forecast. The background is a **living sky** that
shifts to match the actual conditions and day/night of the place you're viewing.

Weather data comes from the **[Open-Meteo API](https://open-meteo.com/)**, which
is free and **requires no API key**, so the app runs immediately with zero signup.

---

## Run it

Requires Node.js 18+ (developed on Node 22).

```bash
cd frontend
npm install
npm run dev
```

Vite prints a local URL (default <http://localhost:5173>) and opens it.

**Before you run:** open `src/config.ts` and set `AUTHOR_NAME` to your name — it
appears in the footer, which the assessment asks the app to include.

Other scripts:

```bash
npm run build      # type-check (tsc) + production build to dist/
npm run preview    # serve the production build locally
npm run typecheck  # type-check only
```

> Note: `npm run dev` works even if `tsc` would flag a type issue, because Vite
> compiles with esbuild (which strips types) for the dev server.

---

## Features

- **Flexible location input** — city, town, or landmark (geocoded), or raw
  coordinates like `33.75, -84.39` (detected and used directly).
- **Live search suggestions** — debounced geocoding with full keyboard
  navigation (↑/↓/Enter/Esc).
- **Use my location** — browser geolocation, with a clear message if it's blocked.
- **Current conditions** — temperature, "feels like", and a hand-drawn condition icon.
- **Detail grid** — the metrics travelers actually need but often overlook: UV
  index, air quality (US AQI), wind + gusts, chance of rain, humidity,
  visibility, and sunrise/sunset. (See the root README for why these matter.)
- **Next 24 hours** — a scrollable hourly strip with temp + precipitation chance.
- **5-day forecast** — daily condition, rain chance, and a hi/lo range bar scaled
  across the whole window so days are comparable at a glance.
- **°C / °F toggle** — switches units (and re-fetches so wind units stay consistent).
- **Robust error handling** — distinct, actionable messages for "place not found",
  network failures (with retry), blocked geolocation, and out-of-range coordinates.
- **Responsive + accessible** — works from large desktop down to mobile; visible
  keyboard focus; respects `prefers-reduced-motion`.

---

## How it's responsive

- **Fluid type** via `clamp()` so headings and the big temperature scale with the viewport.
- **CSS Grid `auto-fit` + `minmax()`** for the detail grid — it reflows from 4
  columns to 1 with no breakpoints.
- **Breakpoints** at 880px (stacks the hero + detail grid), 720px (footer columns),
  and 560px (compacts the forecast rows).
- **Touch-friendly horizontal scroll** with scroll-snap for the hourly strip.
- **Flexbox** wrapping for the search row so the locate button drops below on narrow screens.

---

## Project structure

```
frontend/
├─ index.html              # entry; loads Google Fonts
├─ src/
│  ├─ main.tsx             # React root
│  ├─ App.tsx              # orchestration + theme application
│  ├─ config.ts            # 👈 AUTHOR_NAME + PM Accelerator text
│  ├─ types.ts             # normalized weather model
│  ├─ index.css            # all styles (living sky, glass cards, responsive)
│  ├─ lib/
│  │  ├─ openMeteo.ts       # API client: geocoding, forecast, air quality
│  │  ├─ weatherCodes.ts    # WMO code → label/icon group + sky theme
│  │  └─ format.ts          # units, time, wind, UV/AQI helpers
│  ├─ hooks/
│  │  └─ useWeather.ts      # state machine + actions
│  └─ components/
│     ├─ SearchBar.tsx, CurrentWeather.tsx, HighlightGrid.tsx,
│     ├─ HourlyStrip.tsx, ForecastList.tsx, WeatherIcon.tsx,
│     └─ BackgroundSky.tsx, Notice.tsx, AboutFooter.tsx
└─ package.json
```

## Design notes

The identity pairs an **editorial serif (Fraunces)** for the place name and
temperature with a **monospaced face (JetBrains Mono)** for every numeric
readout — weather as instrumentation. The one bold move (the "living sky")
carries the personality; everything else stays as quiet frosted-glass cards.

## API endpoints used

| Purpose      | Endpoint                                            |
| ------------ | --------------------------------------------------- |
| Geocoding    | `https://geocoding-api.open-meteo.com/v1/search`    |
| Forecast     | `https://api.open-meteo.com/v1/forecast`            |
| Air quality  | `https://air-quality-api.open-meteo.com/v1/air-quality` |

No key, no account. Air quality is fetched separately and fails silently if
unavailable for a location, so the core forecast always renders.
