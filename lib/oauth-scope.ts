// OAuth scope normalization, shared by the consent page and the register
// endpoint. FlowRoll has exactly two scopes; anything else a client sends
// is ignored, and "read" is always included. The database applies the same
// rule when it issues a code (oauth_normalize_scope).
export type Scope = "read" | "read write";

export function normalizeScope(raw: string | null | undefined): Scope {
  const words = (raw ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return words.includes("write") ? "read write" : "read";
}
