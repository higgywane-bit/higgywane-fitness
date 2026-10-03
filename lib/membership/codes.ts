/**
 * Access codes: what the member's QR holds and what staff type when the scanner is down.
 * 8 characters of Crockford base32 (no I, L, O, U), so a code read aloud or typed on an
 * iPad can't be mistaken: "K7M2Q9PX", shown as "K7M2 Q9PX".
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomIndex(n: number): number[] {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b % 32);
}

export function generateAccessCode(): string {
  return randomIndex(8).map((i) => ALPHABET[i]).join("");
}

/** Unguessable token for the member's pass link (/pass/<token>). */
export function generatePassToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  // btoa works in browsers, Node and edge runtimes alike
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Normalise anything a scanner or a person produced: uppercase, drop spaces/dashes,
 * fix look-alikes (O→0, I/L→1). Old Glofox card numbers pass through unchanged.
 */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function formatAccessCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}
