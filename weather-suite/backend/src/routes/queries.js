import { Router } from "express";
import {
  createQuery,
  deleteQuery,
  getQuery,
  listQueries,
  updateQuery,
} from "../db.js";
import { validateDateRange } from "../validation.js";
import {
  fetchAirQuality,
  fetchRange,
  geocodeMany,
  resolveLocation,
} from "../openMeteo.js";
import { buildExtras } from "../enrich.js";
import { FORMATS, streamPDF, toCSV, toMarkdown, toXML } from "../export.js";

const router = Router();

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/**
 * Validate input, resolve the location, fetch weather + extras.
 * Shared by create and update. Returns the data object for the DB layer.
 */
async function assembleQuery({ location, startDate, endDate, notes, units }) {
  if (!location || !String(location).trim()) {
    throw httpError(400, "A location is required.");
  }
  const range = validateDateRange(startDate, endDate);
  if (!range.ok) throw httpError(400, range.error);

  const place = await resolveLocation(location); // throws 404/400 as needed
  const weather = await fetchRange(
    place.latitude,
    place.longitude,
    startDate,
    endDate,
    units === "imperial" ? "imperial" : "metric"
  );
  const airQuality = await fetchAirQuality(place.latitude, place.longitude);
  const extras = await buildExtras(place, airQuality);

  return {
    locationInput: String(location).trim(),
    resolvedName: place.resolvedName,
    region: place.region,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: weather.timezone || place.timezone,
    startDate,
    endDate,
    notes: notes ? String(notes).slice(0, 1000) : null,
    source: weather.source,
    weather,
    extras,
  };
}

/* ----------------------------------------------------- geocode (autocomplete) */
// GET /api/geocode?q=lond
router.get("/geocode", async (req, res, next) => {
  try {
    const results = await geocodeMany(String(req.query.q ?? ""), 5);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------------------------------------------- CREATE */
// POST /api/queries  { location, startDate, endDate, notes?, units? }
router.post("/queries", async (req, res, next) => {
  try {
    const data = await assembleQuery(req.body ?? {});
    const record = createQuery(data);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- READ */
// GET /api/queries  -> list (lightweight summaries)
router.get("/queries", (_req, res) => {
  const records = listQueries().map((r) => ({
    id: r.id,
    locationInput: r.locationInput,
    resolvedName: r.resolvedName,
    region: r.region,
    latitude: r.latitude,
    longitude: r.longitude,
    startDate: r.startDate,
    endDate: r.endDate,
    source: r.source,
    days: r.weather?.days?.length ?? 0,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  res.json({ count: records.length, records });
});

// GET /api/queries/:id  -> full record
router.get("/queries/:id", (req, res, next) => {
  const record = getQuery(Number(req.params.id));
  if (!record) return next(httpError(404, "Query not found."));
  res.json(record);
});

/* ----------------------------------------------------------------- UPDATE */
// PUT /api/queries/:id  -> re-resolve + re-fetch with new fields
router.put("/queries/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = getQuery(id);
    if (!existing) return next(httpError(404, "Query not found."));

    const merged = {
      location: req.body?.location ?? existing.locationInput,
      startDate: req.body?.startDate ?? existing.startDate,
      endDate: req.body?.endDate ?? existing.endDate,
      notes: req.body?.notes ?? existing.notes,
      units: req.body?.units ?? existing.weather?.units,
    };
    const data = await assembleQuery(merged);
    const record = updateQuery(id, data);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

/* ----------------------------------------------------------------- DELETE */
// DELETE /api/queries/:id
router.delete("/queries/:id", (req, res, next) => {
  const ok = deleteQuery(Number(req.params.id));
  if (!ok) return next(httpError(404, "Query not found."));
  res.status(204).end();
});

/* ----------------------------------------------------------------- EXPORT */
// GET /api/queries/:id/export?format=json|csv|xml|md|pdf
router.get("/queries/:id/export", (req, res, next) => {
  const record = getQuery(Number(req.params.id));
  if (!record) return next(httpError(404, "Query not found."));

  const fmtKey = String(req.query.format ?? "json").toLowerCase();
  const fmt = FORMATS[fmtKey];
  if (!fmt) {
    return next(httpError(400, `Unknown format "${fmtKey}". Use json, csv, xml, md, or pdf.`));
  }

  const base = `weather-${record.id}-${record.startDate}_${record.endDate}`;
  const filename = `${base}.${fmt.ext}`;
  const disposition = req.query.download === "0" ? "inline" : "attachment";
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  res.type(fmt.type);

  switch (fmtKey) {
    case "json":
      return res.send(JSON.stringify(record, null, 2));
    case "csv":
      return res.send(toCSV(record));
    case "xml":
      return res.send(toXML(record));
    case "md":
    case "markdown":
      return res.send(toMarkdown(record));
    case "pdf":
      return streamPDF(record, res);
    default:
      return next(httpError(400, "Unsupported format."));
  }
});

export default router;
