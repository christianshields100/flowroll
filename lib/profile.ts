// Display helpers for names. `display_name` is the @handle (username); the
// full name (first + last) is what we show prominently once it's set.

type NameParts = {
  first_name?: string | null;
  last_name?: string | null;
  display_name: string;
};

// What to show as someone's name: their full name, else their @handle.
export function displayName(p: NameParts): string {
  const full = [p.first_name, p.last_name]
    .filter((s) => s && s.trim())
    .join(" ")
    .trim();
  return full || p.display_name;
}

// True when the full name is set (so we know whether to show the @handle line).
export function hasFullName(p: NameParts): boolean {
  return Boolean(
    (p.first_name && p.first_name.trim()) ||
      (p.last_name && p.last_name.trim()),
  );
}
