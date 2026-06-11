import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// SSRF guard for fetching user-supplied URLs (company websites, logos):
// only http(s), no private/link-local/metadata destinations, and every
// redirect hop is re-validated (fetch's automatic "follow" is never used).

const BLOCKED_HOSTNAME = /^(localhost$)|(\.local$)|(\.internal$)/i;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("::ffff:")) {
    const mapped = v6.slice(7);
    return isIP(mapped) === 4 ? isPrivateIPv4(mapped) : true;
  }
  // fc00::/7 (unique local) and fe80::/10 (link-local)
  return /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

async function isPublicDestination(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAME.test(host)) return false;
  if (isIP(host)) return !isPrivateIp(host);
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

/**
 * fetch() for untrusted URLs. Returns null when the destination (or any
 * redirect hop) is non-public, on timeout, or on network failure.
 */
export async function safeFetch(
  input: string | URL,
  init?: RequestInit,
  opts: { maxRedirects?: number; timeoutMs?: number } = {},
): Promise<Response | null> {
  const { maxRedirects = 3, timeoutMs = 12000 } = opts;
  let url: URL;
  try {
    url = new URL(String(input));
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (!(await isPublicDestination(url))) return null;
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return res;
        try {
          url = new URL(location, url);
        } catch {
          return null;
        }
        continue;
      }
      return res;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
