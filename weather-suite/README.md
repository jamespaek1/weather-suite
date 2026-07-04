# Weather Suite

**Author: Anil Thomas**

Three weather projects in one repository, covering **all three PM Accelerator
technical assessments**, sharing a design sensibility and a single free, keyless
data source ([Open-Meteo](https://open-meteo.com/)):

| Assessment | Folder | Stack | What it is |
| ---------- | ------ | ----- | ---------- |
| **#1 — Frontend** | [`frontend/`](./frontend) | React + TypeScript + Vite | A real-time weather app — search any place (city, landmark, **ZIP/postal code**, or coordinates), see current conditions, 24h, and a 5-day forecast, with a "living sky" background. |
| **#2 — Backend** | [`backend/`](./backend) | Node + Express + SQLite | A RESTful API with full CRUD, location + date-range validation, extra API integrations (maps, Wikipedia, air quality), and exports to JSON/CSV/XML/Markdown/PDF. |
| **Data Science** | [`data-science/`](./data-science) | Python + scikit-learn | Cleans + explores the Kaggle Global Weather Repository dataset and forecasts a temperature time series (basic **and** advanced requirements), with a written report. |

Each folder has its own README with full setup and details.

---

## Quick start

```bash
# 1 — Frontend app (Assessment #1)
cd frontend && npm install && npm run dev      # http://localhost:5173

# 2 — Backend API + test console (Assessment #2)
cd backend && npm install && npm start          # http://localhost:3001

# 3 — Data-science pipeline (Data Science assessment)
cd data-science && pip install -r requirements.txt
python src/weather_forecasting.py --demo         # or --input "GlobalWeatherRepository.csv"
```

> **Note on networking:** the apps call Open-Meteo (and Wikipedia/maps) from
> *your* machine at runtime, so they need an internet connection when you run
> them. The data-science script runs entirely locally on the CSV (or on the
> built-in synthetic demo data).

## Deployment

A `render.yaml` blueprint at the repo root deploys both apps to
[Render](https://render.com) in one step: **New + → Blueprint → select this
repo**. It creates the backend as a Node web service (with a persistent disk
mounted at `/var/data` for the SQLite file, via the `DATA_DIR` env var) and the
frontend as a static site.

Alternatives that work equally well:
- **Frontend only:** Vercel or Netlify — import the repo, set the project root
  to `frontend/`; the build (`npm run build` → `dist/`) is auto-detected.
- **Backend only:** any Node host (Railway, Fly.io). Set `DATA_DIR` to a
  persistent volume; on free tiers without disks, the SQLite data resets on
  redeploy (fine for a demo).

The two apps are independent — the frontend calls Open-Meteo directly, so
neither needs the other to run.

## Why these choices

- **Open-Meteo** for weather — genuinely free, **no API key**, CORS-friendly, and
  it covers current, forecast, historical (ERA5), and air-quality data, so all
  three projects can share one source with zero signup friction.
- **Consistent identity** — the frontend treats weather as *instrumentation*
  (monospaced numeric readouts, an editorial serif for the headline temperature)
  wrapped in *atmosphere* (a background that shifts to match the real sky). The
  backend's test console and the report charts echo the same restrained palette.

---

## Design prompt: non-obvious things a traveler should consider

Beyond "what's the temperature," the apps deliberately surface the details that
actually change how a trip feels — the things people forget to check:

- **"Feels like" vs the actual number.** Humidity and wind can move perceived
  temperature by 5–10°. 32°C at 80% humidity and 32°C in dry desert air call for
  different packing.
- **UV index.** Tied to sun angle and altitude, not warmth — you can burn quickly
  on a cool, clear day at elevation. It drives whether you need sunscreen and a hat.
- **Sustained wind vs gusts.** An average wind speed hides the gusts that decide
  whether the ferry runs, the hike is pleasant, or the umbrella survives.
- **Chance of rain vs amount of rain.** A 90% chance of 0.2 mm is a non-event;
  a 30% chance of 25 mm is a washout. Probability and volume answer different
  questions, so both are shown.
- **Daylight length, not just sunrise/sunset.** Near the solstices, high-latitude
  destinations have dramatically long or short days — which reshapes how much you
  can fit into one day far more than most travelers expect.
- **Air quality (AQI).** Two cities at the same temperature can be very different
  to spend a day outdoors in; AQI matters for anyone sensitive, exercising, or
  traveling with kids.
- **Units and local time.** The app honors °C/°F and always reports times in the
  **destination's** timezone — the classic trap is reading a forecast time in your
  home timezone.
- **The destination, not where you are now.** Flexible location input (city,
  landmark, or coordinates) plus optional geolocation makes it explicit *which*
  place you're seeing — so you plan for there, not here.

---

## About the Product Manager Accelerator (PMA)

These assessments come from the **Product Manager Accelerator** program. PMA is a
professional-development program that helps aspiring and experienced product
managers break into and grow in (AI) product management. Through hands-on cohorts,
students work alongside engineers, designers, and data scientists to build and
launch real AI products from 0 to 1 — backed by mentorship, an active alumni
network, and a strong track record of placing graduates at top tech companies and
startups. Learn more at <https://www.pmaccelerator.io/> or on
[LinkedIn](https://www.linkedin.com/school/pmaccelerator/).
