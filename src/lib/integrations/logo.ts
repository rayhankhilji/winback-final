// ============================================================================
// src/lib/integrations/logo.ts — third-party logos via LogoKit.
//
// https://img.logokit.com/{domain}?token=… — the token is a publishable key
// meant for the browser, so `NEXT_PUBLIC_LOGOKIT_TOKEN` is the correct prefix
// here. It is not a secret in the sense CLAUDE.md guards against; it is a
// rate-limit identity for an image CDN. Never put a server key here.
//
// Without a token the page still renders: each integration falls back to a
// monogram tile. That is a deliberate exception to "no fallbacks just in
// case", on the same grounds as the classify fallback — a third-party image
// CDN being unreachable must never break a settings page the user owns.
// ============================================================================

export function logoUrl(domain: string, size = 64): string | null {
  const token = process.env.NEXT_PUBLIC_LOGOKIT_TOKEN;
  if (!token) return null;
  return `https://img.logokit.com/${domain}?token=${encodeURIComponent(token)}&size=${size}`;
}

/** One or two letters, which is all that fits legibly in a 32px tile. */
export function monogram(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}
