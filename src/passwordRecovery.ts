// Extract only the token. Never navigate to a supplied link's host.
export function recoveryToken(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  try {
    const url = new URL(value, 'http://localhost/');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return /^#admin-setup\/([A-Za-z0-9_-]{43})$/.exec(url.hash)?.[1] ?? null;
  } catch { return null; }
}
