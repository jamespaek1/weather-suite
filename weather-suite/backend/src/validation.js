// Validation helpers for location + date-range input.

export const MIN_DATE = "1940-01-01"; // ERA5 archive lower bound
export const MAX_RANGE_DAYS = 92; // keep responses reasonable
export const MAX_FUTURE_DAYS = 16; // Open-Meteo forecast horizon

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  // Guard against things like 2024-02-30 rolling over.
  return d.toISOString().slice(0, 10) === s;
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const ms = new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z");
  return Math.round(ms / 86400000);
}

/**
 * Validate a {startDate, endDate} pair.
 * Returns { ok: true } or { ok: false, error: "..." }.
 */
export function validateDateRange(startDate, endDate) {
  if (!isValidDateString(startDate)) {
    return { ok: false, error: "startDate must be a valid date in YYYY-MM-DD format." };
  }
  if (!isValidDateString(endDate)) {
    return { ok: false, error: "endDate must be a valid date in YYYY-MM-DD format." };
  }
  if (startDate > endDate) {
    return { ok: false, error: "startDate must be on or before endDate." };
  }
  if (startDate < MIN_DATE) {
    return { ok: false, error: `Dates before ${MIN_DATE} are not available.` };
  }
  const maxFuture = new Date();
  maxFuture.setUTCDate(maxFuture.getUTCDate() + MAX_FUTURE_DAYS);
  const maxFutureStr = maxFuture.toISOString().slice(0, 10);
  if (endDate > maxFutureStr) {
    return {
      ok: false,
      error: `endDate can be at most ${MAX_FUTURE_DAYS} days ahead (through ${maxFutureStr}).`,
    };
  }
  const span = daysBetween(startDate, endDate) + 1;
  if (span > MAX_RANGE_DAYS) {
    return { ok: false, error: `The date range can be at most ${MAX_RANGE_DAYS} days (got ${span}).` };
  }
  return { ok: true };
}

/** Decide which Open-Meteo product to use for a date range. */
export function chooseSource(startDate, endDate) {
  // Archive (ERA5) has roughly a 5-day delay; use it only for fully-past ranges.
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 5);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return endDate < cutoffStr ? "archive" : "forecast";
}

const COORD_RE = /^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/;

/**
 * If the input is coordinates, return {latitude, longitude}; else null.
 * Throws { status, error } for out-of-range coordinates.
 */
export function parseCoordinates(input) {
  const m = String(input).trim().match(COORD_RE);
  if (!m) return null;
  const latitude = parseFloat(m[1]);
  const longitude = parseFloat(m[2]);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    const err = new Error("Coordinates out of range (lat -90..90, lon -180..180).");
    err.status = 400;
    throw err;
  }
  return { latitude, longitude };
}

export { todayUTC };
