// SQLite CURRENT_TIMESTAMP is UTC but omits its timezone. Never let a browser
// reinterpret those database timestamps in the contestant/host's local zone.
export function parseUtcTimestamp(value: string): number {
  const text=value.trim();
  const utc=/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
    ? `${text.replace(' ','T')}Z` : text;
  return Date.parse(utc);
}

export function utcTimestampIso(value: string): string {
  const time=parseUtcTimestamp(value);
  return Number.isFinite(time)?new Date(time).toISOString():value;
}
