// Extra context for a location, fulfilling the "integrate with another API"
// requirement. All sources are free and keyless.

const WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/";

/**
 * Wikipedia REST summary for a place name. Returns a short extract + links,
 * or null if there's no good match. Non-fatal.
 */
export async function wikipediaSummary(name) {
  if (!name) return null;
  try {
    const url = WIKI_SUMMARY + encodeURIComponent(name.replace(/\s+/g, "_"));
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === "disambiguation" || !data.extract) return null;
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page ?? null,
      thumbnail: data.thumbnail?.source ?? null,
    };
  } catch {
    return null;
  }
}

/** Map links + an embeddable OpenStreetMap iframe URL (no API key needed). */
export function mapLinks(latitude, longitude, name = "") {
  const lat = Number(latitude);
  const lon = Number(longitude);
  const d = 0.08; // bounding-box padding for the embed
  const bbox = `${lon - d}%2C${lat - d}%2C${lon + d}%2C${lat + d}`;
  return {
    openStreetMap: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=11/${lat}/${lon}`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    osmEmbed: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`,
    label: name,
  };
}

/** Build the combined extras object stored alongside a query. */
export async function buildExtras(place, airQuality) {
  const wikipedia = await wikipediaSummary(place.resolvedName);
  return {
    wikipedia,
    airQuality,
    map: mapLinks(place.latitude, place.longitude, place.resolvedName),
  };
}
