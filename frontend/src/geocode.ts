// Free OpenStreetMap Nominatim geocoding - no API key needed. Fine for a
// student-project demo's traffic level; if this app ever gets real usage,
// switch to a paid geocoder with proper rate limits per Nominatim's usage policy.

export interface GeocodeResult {
  display_name: string;
  lat: number;
  lon: number;
}

const BASE_URL = "https://nominatim.openstreetmap.org";

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `${BASE_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=5`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((d: any) => ({
    display_name: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/reverse?format=json&lat=${lat}&lon=${lon}`);
  if (!res.ok) return null;
  const data = await res.json();
  // Prefer a short, human-friendly name over the full formatted address
  return (
    data.address?.city ||
    data.address?.town ||
    data.address?.village ||
    data.address?.county ||
    data.display_name ||
    null
  );
}
