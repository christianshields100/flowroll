// Verifies the session-media bucket rejects unauthenticated reads
// (compliance item 6). Usage: node scripts/check-bucket-access.mjs [path]
// With no args it probes a synthetic path — a private bucket returns 400/403
// ("Object not found"/unauthorized) either way, while a public bucket
// returns 200 for real objects and a distinctive 404 for missing ones.
const BASE =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://enqbzagxyqadqzxfbohm.supabase.co";
const path = process.argv[2] ?? "00000000-0000-0000-0000-000000000000/probe.jpg";
const url = `${BASE}/storage/v1/object/public/session-media/${path}`;

const res = await fetch(url);
const body = await res.text();
console.log(`GET ${url}`);
console.log(`→ ${res.status}: ${body.slice(0, 120)}`);

// Public buckets serve objects (200) or return {"error":"not_found"} 404s.
// Private buckets reject the /public/ route with 400 "Bucket not found" /
// "Object not found" regardless of whether the object exists.
if (res.status === 200) {
  console.error("FAIL: unauthenticated read succeeded — bucket is public.");
  process.exit(1);
}
console.log("PASS: unauthenticated access rejected.");
