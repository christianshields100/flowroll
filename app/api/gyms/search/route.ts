// GET /api/gyms/search?q=... — gym autocomplete.
// Proxies Google Places Autocomplete (New) with a SERVER-ONLY key so the key
// never reaches the browser. Returns a slim list the GymPicker can render.
// Standardization comes from the Google `placeId`, which is stable per place.
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Suggestion = { placeId: string; name: string; address: string };

export async function GET(request: Request) {
  // Only signed-in users (keeps the proxied key from being a public endpoint).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    // Soft failure: the GymPicker falls back to free-text entry.
    return Response.json(
      { error: "Gym search is not configured.", suggestions: [] },
      { status: 503 },
    );
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return Response.json({ suggestions: [] });

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
        },
        body: JSON.stringify({ input: q }),
      },
    );
    if (!res.ok) {
      return Response.json(
        { error: "Gym search failed.", suggestions: [] },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId?: string;
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
          text?: { text?: string };
        };
      }[];
    };

    const suggestions: Suggestion[] = (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .map((p) => ({
        placeId: p.placeId!,
        name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        address: p.structuredFormat?.secondaryText?.text ?? "",
      }))
      .filter((s) => s.name.length > 0);

    return Response.json({ suggestions });
  } catch {
    return Response.json(
      { error: "Gym search failed.", suggestions: [] },
      { status: 502 },
    );
  }
}
