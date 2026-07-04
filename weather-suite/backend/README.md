# Weather Backend (Tech Assessment #2)

A RESTful weather service: **Node + Express + SQLite**. Create weather queries
for a **location and date range**, with validation, persistence (full CRUD),
enrichment from **additional APIs** (Wikipedia + maps + air quality), and
**export** to JSON / CSV / XML / Markdown / PDF.

Weather comes from **[Open-Meteo](https://open-meteo.com/)** (free, no API key),
using the forecast product for present/future ranges and the **ERA5 archive**
for historical ranges — chosen automatically per request.

---

## Run it

Requires Node.js 18+ (developed on Node 22). `better-sqlite3` ships prebuilt
binaries, so no compiler is normally needed.

```bash
cd backend
npm install
npm start          # or: npm run dev  (auto-restart)
```

Then open the **test console** at <http://localhost:3001/> to create, view,
delete, and export queries in the browser. Health check: `/api/health`.

The SQLite file is created at `backend/data/weather.db` on first run.

---

## API reference

Base URL: `http://localhost:3001/api`

| Method   | Path                          | Purpose |
| -------- | ----------------------------- | ------- |
| `GET`    | `/health`                     | Service health. |
| `GET`    | `/geocode?q=`                 | Up to 5 place matches (autocomplete). |
| `POST`   | `/queries`                    | **Create** a query (validates, fetches, enriches, stores). |
| `GET`    | `/queries`                    | **List** saved queries (summaries). |
| `GET`    | `/queries/:id`                | **Read** one full query. |
| `PUT`    | `/queries/:id`                | **Update** (re-resolves + re-fetches changed fields). |
| `DELETE` | `/queries/:id`                | **Delete** a query. |
| `GET`    | `/queries/:id/export?format=` | Export `json`\|`csv`\|`xml`\|`md`\|`pdf`. |

### Create / update body

```json
{
  "location": "Lisbon",            // city, landmark, or "38.72, -9.14"
  "startDate": "2026-06-24",        // YYYY-MM-DD
  "endDate": "2026-06-28",
  "units": "metric",               // "metric" | "imperial" (optional)
  "notes": "Trip planning"          // optional
}
```

Example:

```bash
curl -X POST http://localhost:3001/api/queries \
  -H "Content-Type: application/json" \
  -d '{"location":"Reykjavik","startDate":"2026-06-25","endDate":"2026-06-29"}'

curl http://localhost:3001/api/queries/1/export?format=csv -o report.csv
```

---

## Validation

- **Location** is required; resolved via geocoding, or parsed directly if it
  looks like `lat, lon` (range-checked). Unknown names return **404**.
- **Dates** must be real `YYYY-MM-DD` values; `start ≤ end`; not before
  `1940-01-01`; end at most **16 days** ahead; range at most **92 days**.
- Bad input returns **400** with a clear `{ "error": "..." }` message; upstream
  failures return **502**.

## Additional API integrations

Beyond the weather data, each query is enriched (all keyless):

- **Wikipedia REST** — a short summary of the resolved place for context.
- **OpenStreetMap / Google Maps** — link-outs plus an embeddable OSM map
  (shown in the test console).
- **Open-Meteo Air Quality** — current US AQI + PM2.5/PM10.

Enrichment is best-effort: if a source is unavailable, the query still succeeds.

## Export formats

`json` (full record), `csv` (daily rows), `xml` (structured document),
`md` (readable report with the Wikipedia blurb + daily table), and `pdf`
(generated with PDFKit). Add `&download=0` to view inline instead of downloading.

## Data model (`queries` table)

`id`, `location_input`, `resolved_name`, `region`, `country`, `latitude`,
`longitude`, `timezone`, `start_date`, `end_date`, `notes`, `source`
(`archive`/`forecast`), `weather_json`, `extras_json`, `created_at`, `updated_at`.

## Project structure

```
backend/
├─ src/
│  ├─ server.js        # Express app, CORS, static UI, error handling
│  ├─ db.js            # SQLite schema + CRUD helpers (better-sqlite3)
│  ├─ validation.js    # date-range + coordinate validation
│  ├─ openMeteo.js     # geocoding + forecast/archive + air quality
│  ├─ enrich.js        # Wikipedia + map links
│  ├─ export.js        # CSV / XML / Markdown / PDF serializers
│  └─ routes/queries.js# REST endpoints
├─ public/index.html   # browser test console
└─ data/weather.db     # created at runtime
```
