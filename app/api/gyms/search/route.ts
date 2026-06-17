// GET /api/gyms/search?q=...&lat=...&lon=... — gym autocomplete.
// Backed by Photon (https://photon.komoot.io), a free OpenStreetMap geocoder
// built for type-ahead — no API key, no billing. Standardization comes from the
// OSM id (osm_type + osm_id), which is stable per place, so the same gym groups
// together across users for analytics. Optional lat/lon bias ranking toward the
// user so nearby gyms come first. Auth-gated so it isn't an open proxy.
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Suggestion = { placeId: string; name: string; address: string };

const PHOTON_URL = "https://photon.komoot.io/api/";

// Restrict results to the OSM primary tags BJJ / martial-arts academies use:
// `amenity=dojo` (martial-arts specific) plus the fitness/sports-centre tags
// many gyms carry (e.g. Renzo Gracie Academy is a sports_centre). This cuts out
// the random businesses/streets a bare name search would otherwise return.
const GYM_TAGS = [
  "amenity:dojo",
  "leisure:fitness_centre",
  "leisure:sports_centre",
  "club:sport", // some academies are mapped as a sports club
];
const GYM_TAG_QS = GYM_TAGS.map((t) => `&osm_tag=${t}`).join("");

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  if (q.length < 3) return Response.json({ suggestions: [] });

  // Optional location bias: when the client shares the user's coordinates,
  // Photon ranks nearby gyms first (so your own academy beats a same-named one
  // across the world). location_bias_scale 0.3 is a moderate pull toward you.
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const hasLoc =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;
  const biasQs = hasLoc
    ? `&lat=${lat}&lon=${lon}&location_bias_scale=0.3`
    : "";

  try {
    const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=10${GYM_TAG_QS}${biasQs}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FlowRoll/1.0 (BJJ training log)" },
    });
    if (!res.ok) return Response.json({ suggestions: [] });

    const data = (await res.json()) as {
      features?: {
        properties?: {
          osm_id?: number;
          osm_type?: string;
          name?: string;
          street?: string;
          city?: string;
          county?: string;
          state?: string;
          country?: string;
        };
      }[];
    };

    const seen = new Set<string>();
    const suggestions: Suggestion[] = [];
    for (const f of data.features ?? []) {
      const p = f.properties;
      // Only named places (skip bare streets/house numbers without a name).
      if (!p?.name || p.osm_id == null || !p.osm_type) continue;
      const placeId = `${p.osm_type}${p.osm_id}`; // e.g. "N12345" — OSM-stable
      if (seen.has(placeId)) continue;
      seen.add(placeId);
      const address = [p.city ?? p.county, p.state, p.country]
        .filter(Boolean)
        .join(", ");
      suggestions.push({ placeId, name: p.name, address });
      if (suggestions.length >= 8) break;
    }

    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
