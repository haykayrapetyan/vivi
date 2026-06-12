// Short-lived HMAC tokens that let the recruiter's BROWSER open a WebSocket
// straight to the vacancy's Durable Object (realtime agent updates). The
// browser can't hold the gateway secret, so the Next app (after its own org
// check) mints a token scoped to one vacancy with an expiry; the worker
// verifies it on the WS upgrade.
//
// Web Crypto only — this module is shared by Next (Node) and the worker.

const enc = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  // base64url without padding
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Mints `expiresAtMs.signature` for one vacancy. Default TTL: 1 hour. */
export async function mintSocketToken(
  secret: string,
  vacancyId: string,
  expiresAtMs = Date.now() + 60 * 60 * 1000,
): Promise<string> {
  const sig = await hmac(secret, `${vacancyId}:${expiresAtMs}`);
  return `${expiresAtMs}.${sig}`;
}

/** Verifies a token minted by mintSocketToken for this vacancy. */
export async function verifySocketToken(
  secret: string,
  vacancyId: string,
  token: string | null,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresAtMs = Number(token.slice(0, dot));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) return false;

  const expected = await hmac(secret, `${vacancyId}:${expiresAtMs}`);
  const given = token.slice(dot + 1);
  if (given.length !== expected.length) return false;
  // Constant-time compare.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}
