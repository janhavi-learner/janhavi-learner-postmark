// Where the user is: a town-level place name for the postmark, and a guess at what kind of place
// it is (mountains, beach, city, forest, desert) to suggest a palette. Uses OpenStreetMap Nominatim.
//
// Privacy: coordinates are rounded to 2 decimals (about 1 km) before they leave the phone or get
// saved, and names are looked up at town level only, never street level.

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const PLACE_KEY = 'postmark.place';

// Nominatim's rule for free use: at most one request per second.
const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 8000;

// Above this height (metres, from GPS) we call it mountains without asking the map.
const MOUNTAIN_ALTITUDE = 1500;
// Words in a place or region name that mean desert.
const DESERT_WORDS = /desert|sahara|thar|gobi|kalahari|namib|mojave|sonoran|atacama|negev|sinai|arabian|rub' al khali|wadi/i;
// Countries that are mostly desert.
const DESERT_COUNTRIES = new Set(['eg', 'ly', 'sa', 'ae', 'qa', 'kw', 'om', 'bh', 'jo', 'ne', 'ml', 'mr', 'td', 'dj', 'eh']);

const round2 = (v) => Math.round(v * 100) / 100;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

export async function locationPermission() {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state; // granted | denied | prompt
  } catch {
    return 'prompt';
  }
}

// Asks the phone where it is. Rejects with { denied: true } if the user says no.
export function getPosition() {
  return new Promise((done, fail) => {
    if (!('geolocation' in navigator)) return fail({ denied: true });
    navigator.geolocation.getCurrentPosition(
      (p) => done({ lat: round2(p.coords.latitude), lon: round2(p.coords.longitude), altitude: p.coords.altitude }),
      (e) => fail({ denied: e.code === e.PERMISSION_DENIED }),
      // High accuracy so GPS can report height (used to spot mountains).
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

async function nominatim(path, params) {
  const url = new URL(path, NOMINATIM);
  for (const [k, v] of Object.entries({ format: 'jsonv2', ...params })) url.searchParams.set(k, v);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: abort.signal, headers: { 'Accept-Language': navigator.language || 'en' } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Mapped features of one kind within `km` of the point.
async function nearby(query, { lat, lon }, km, extra = {}) {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  const results = await nominatim('/search', {
    q: query,
    viewbox: [lon - dLon, lat + dLat, lon + dLon, lat - dLat].join(','),
    bounded: 1,
    limit: 5,
    ...extra,
  });
  return Array.isArray(results) ? results : [];
}

// "Manali, Himachal Pradesh": town (or nearest equivalent) plus region.
function placeName(result) {
  const a = result?.address || {};
  const local = a.city || a.town || a.village || a.municipality || a.suburb || a.county || result?.name;
  const region = a.state || a.region || a.country;
  if (!local) return region || null;
  return region && region !== local ? `${local}, ${region}` : local;
}

// Looks up the place name and kind of place. Each step is skipped once the type is known.
// Returns { name, type, offline }; name and type may be null.
export async function describePlace(position) {
  const place = { name: null, type: null, offline: false };
  if (position.altitude != null && position.altitude >= MOUNTAIN_ALTITUDE) place.type = 'mountains';

  let town;
  try {
    town = await nominatim('/reverse', { lat: position.lat, lon: position.lon, zoom: 10, addressdetails: 1 });
    place.name = placeName(town);
  } catch {
    place.offline = true;
    return place; // no signal: the user picks a palette; the name is filled in later (Phase 4)
  }

  // In order of priority. `ask` steps send a request to Nominatim; the others only read the name.
  const steps = [
    { check: () => DESERT_WORDS.test(town.display_name || '') || DESERT_COUNTRIES.has(town.address?.country_code) ? 'desert' : null },
    { ask: true, check: async () => (await nearby('beach', position, 3)).some((r) => r.type === 'beach') ? 'beach' : null },
    { ask: true, check: async () => (await nearby('peak', position, 15, { extratags: 1 }))
      .some((r) => r.type === 'peak' && parseFloat(r.extratags?.ele) >= MOUNTAIN_ALTITUDE) ? 'mountains' : null },
    { check: () => town.addresstype === 'city' || town.type === 'city' ? 'city' : null },
    { ask: true, check: async () => (await nearby('forest', position, 2)).some((r) => r.type === 'forest' || r.type === 'wood') ? 'forest' : null },
  ];
  for (const step of steps) {
    if (place.type) break;
    try {
      if (step.ask) await wait(REQUEST_GAP_MS);
      place.type = await step.check();
    } catch {
      break; // signal dropped mid-way: keep what we have
    }
  }
  return place;
}

// Kept on the device for the postmark.
export function savePlace(position, place) {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify({ lat: position.lat, lon: position.lon, ...place, at: Date.now() }));
  } catch {
    // Not saved; the postmark falls back to an empty field.
  }
}

// The place taken at the start, or null if location was never given.
export function loadPlace() {
  try {
    return JSON.parse(localStorage.getItem(PLACE_KEY));
  } catch {
    return null;
  }
}

// "32.24° N, 77.19° E": shown on the postmark when there was no signal to look up a name.
export const formatCoords = ({ lat, lon }) =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;

// Town-level name for saved coordinates, once the phone is back online. Saves it too.
export async function lookupPlaceName(saved) {
  const town = await nominatim('/reverse', { lat: saved.lat, lon: saved.lon, zoom: 10, addressdetails: 1 });
  const name = placeName(town);
  if (name) savePlace(saved, { ...saved, name, offline: false });
  return name;
}
