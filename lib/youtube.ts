import "server-only";
import type { createClient } from "@/lib/supabase/server";

// YouTube Data API v3 search, used for technique study suggestions. Free
// quota is 10k units/day and each search costs 100, so results are cached
// in study_cache (shared across users — "armbar escape bjj" is the same
// search for everyone) with a 7-day TTL. Ships dark until YOUTUBE_API_KEY
// is set.

type SupabaseServer = ReturnType<typeof createClient>;

export type StudyVideo = {
  videoId: string;
  title: string;
  channel: string;
  thumb: string; // i.ytimg.com medium thumbnail
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function youtubeConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

// HTML entities YouTube leaves in titles ("Kimura &amp; armbar").
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Search YouTube for BJJ study videos, via the shared cache. Returns [] when
 * unconfigured or on API failure (stale cache is served if present).
 */
export async function searchStudyVideos(
  supabase: SupabaseServer,
  rawQuery: string,
  max = 4,
): Promise<StudyVideo[]> {
  if (!youtubeConfigured()) return [];
  const query = normalizeQuery(rawQuery);
  if (!query) return [];

  const { data: cached } = await supabase
    .from("study_cache")
    .select("results, fetched_at")
    .eq("query", query)
    .maybeSingle();

  const fresh =
    cached &&
    Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS;
  if (fresh) return (cached.results as StudyVideo[]).slice(0, max);

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "6");
    url.searchParams.set("safeSearch", "none");
    url.searchParams.set("relevanceLanguage", "en");
    url.searchParams.set("q", query);
    url.searchParams.set("key", process.env.YOUTUBE_API_KEY!);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`youtube ${res.status}`);
    const json = (await res.json()) as {
      items?: {
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          channelTitle?: string;
          thumbnails?: { medium?: { url?: string } };
        };
      }[];
    };

    const videos: StudyVideo[] = (json.items ?? [])
      .filter((i) => i.id?.videoId && i.snippet?.title)
      .map((i) => ({
        videoId: i.id!.videoId!,
        title: decodeEntities(i.snippet!.title!),
        channel: i.snippet!.channelTitle ?? "",
        thumb: i.snippet!.thumbnails?.medium?.url ?? "",
      }));

    // Refresh the shared cache (best-effort; ignore failures).
    await supabase
      .from("study_cache")
      .upsert({ query, results: videos, fetched_at: new Date().toISOString() });

    return videos.slice(0, max);
  } catch {
    // API failure: serve stale cache if we have one, else nothing.
    if (cached) return (cached.results as StudyVideo[]).slice(0, max);
    return [];
  }
}

export function videoUrl(v: StudyVideo): string {
  return `https://www.youtube.com/watch?v=${v.videoId}`;
}
