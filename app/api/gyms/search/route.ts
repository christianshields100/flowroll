// GET /api/gyms/search?q=... — gym autocomplete.
// Backed by Photon (https://photon.komoot.io), a free OpenStreetMap geocoder
// built for type-ahead — no API key, no billing. Standardization comes from the
// OSM id (osm_type + osm_id), which is stable per place, so the same gym groups
// together across users for analytics. Auth-gated so it isn't an open proxy.
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Suggestion = { placeId: string; name: string; address: string };

const PHOTON_URL = "https://photon.komoot.io/api/";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return Response.json({ suggestions: [] });

  try {
    const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=8`;
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
