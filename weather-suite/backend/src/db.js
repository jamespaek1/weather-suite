import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// On hosting platforms, set DATA_DIR to a persistent-disk mount (e.g. /var/data).
const dataDir = process.env.DATA_DIR || join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "weather.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS queries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    location_input TEXT NOT NULL,
    resolved_name  TEXT,
    region         TEXT,
    country        TEXT,
    latitude       REAL,
    longitude      REAL,
    timezone       TEXT,
    start_date     TEXT NOT NULL,
    end_date       TEXT NOT NULL,
    notes          TEXT,
    source         TEXT,
    weather_json   TEXT,
    extras_json    TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );
`);

function parseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    locationInput: row.location_input,
    resolvedName: row.resolved_name,
    region: row.region,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    timezone: row.timezone,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    source: row.source,
    weather: row.weather_json ? JSON.parse(row.weather_json) : null,
    extras: row.extras_json ? JSON.parse(row.extras_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const stmtInsert = db.prepare(`
  INSERT INTO queries
    (location_input, resolved_name, region, country, latitude, longitude, timezone,
     start_date, end_date, notes, source, weather_json, extras_json, created_at, updated_at)
  VALUES
    (@locationInput, @resolvedName, @region, @country, @latitude, @longitude, @timezone,
     @startDate, @endDate, @notes, @source, @weatherJson, @extrasJson, @createdAt, @updatedAt)
`);

const stmtAll = db.prepare(`SELECT * FROM queries ORDER BY created_at DESC`);
const stmtById = db.prepare(`SELECT * FROM queries WHERE id = ?`);
const stmtDelete = db.prepare(`DELETE FROM queries WHERE id = ?`);
const stmtUpdate = db.prepare(`
  UPDATE queries SET
    location_input = @locationInput,
    resolved_name  = @resolvedName,
    region         = @region,
    country        = @country,
    latitude       = @latitude,
    longitude      = @longitude,
    timezone       = @timezone,
    start_date     = @startDate,
    end_date       = @endDate,
    notes          = @notes,
    source         = @source,
    weather_json   = @weatherJson,
    extras_json    = @extrasJson,
    updated_at     = @updatedAt
  WHERE id = @id
`);

export function createQuery(data) {
  const now = new Date().toISOString();
  const info = stmtInsert.run({
    locationInput: data.locationInput,
    resolvedName: data.resolvedName ?? null,
    region: data.region ?? null,
    country: data.country ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    timezone: data.timezone ?? null,
    startDate: data.startDate,
    endDate: data.endDate,
    notes: data.notes ?? null,
    source: data.source ?? null,
    weatherJson: data.weather ? JSON.stringify(data.weather) : null,
    extrasJson: data.extras ? JSON.stringify(data.extras) : null,
    createdAt: now,
    updatedAt: now,
  });
  return getQuery(info.lastInsertRowid);
}

export function listQueries() {
  return stmtAll.all().map(parseRow);
}

export function getQuery(id) {
  return parseRow(stmtById.get(id));
}

export function updateQuery(id, data) {
  const now = new Date().toISOString();
  stmtUpdate.run({
    id,
    locationInput: data.locationInput,
    resolvedName: data.resolvedName ?? null,
    region: data.region ?? null,
    country: data.country ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    timezone: data.timezone ?? null,
    startDate: data.startDate,
    endDate: data.endDate,
    notes: data.notes ?? null,
    source: data.source ?? null,
    weatherJson: data.weather ? JSON.stringify(data.weather) : null,
    extrasJson: data.extras ? JSON.stringify(data.extras) : null,
    updatedAt: now,
  });
  return getQuery(id);
}

export function deleteQuery(id) {
  const info = stmtDelete.run(id);
  return info.changes > 0;
}

export default db;
