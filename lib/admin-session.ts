const encoder = new TextEncoder();
export const SESSION_SECONDS = 60 * 60 * 12;
export const SESSION_COOKIE = "__Host-motto-admin";
async function key(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function createSession(secret: string, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${crypto.randomUUID()}`;
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload));
  return `${payload}.${Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("")}`;
}
export async function verifySession(token: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[2])) return false;
  const expiry = Number(parts[0]);
  const current = Math.floor(now / 1000);
  if (expiry <= current || expiry > current + SESSION_SECONDS) return false;
  const signature = Uint8Array.from(parts[2].match(/../g)!, x => parseInt(x, 16));
  return crypto.subtle.verify("HMAC", await key(secret), signature, encoder.encode(`${parts[0]}.${parts[1]}`));
}
