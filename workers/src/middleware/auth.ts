/**
 * Clerk JWT verification middleware for Hono.
 *
 * Verifies RS256 tokens using Clerk's JWKS endpoint.
 * Caches the public key for 1 hour to avoid repeated fetches.
 */

import type { Context, Next } from "hono";
import type { Env } from "../index";

interface JWKSResponse {
  keys: JsonWebKey[];
}

interface ClerkJWTPayload {
  sub: string; // Clerk user ID
  exp: number;
  nbf: number;
  iat: number;
  iss: string;
  azp?: string;
  [key: string]: unknown;
}

let cachedKey: CryptoKey | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getClerkPublicKey(issuer: string): Promise<CryptoKey> {
  const now = Date.now();
  if (cachedKey && now - cachedAt < CACHE_TTL_MS) {
    return cachedKey;
  }

  const jwksUrl = `${issuer}/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUrl}: ${response.status}`);
  }

  const jwks: JWKSResponse = await response.json();
  const rsaKey = jwks.keys.find((k) => k.kty === "RSA");
  if (!rsaKey) {
    throw new Error("No RSA key found in JWKS");
  }

  cachedKey = await crypto.subtle.importKey(
    "jwk",
    rsaKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  cachedAt = now;
  return cachedKey;
}

function base64UrlDecode(str: string): Uint8Array {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verifyClerkToken(token: string): Promise<ClerkJWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
  if (header.alg !== "RS256") {
    throw new Error(`Unexpected algorithm: ${header.alg}`);
  }

  // Decode payload
  const payload: ClerkJWTPayload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64)),
  );

  // Check expiry and not-before
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error("Token expired");
  }
  if (payload.nbf && payload.nbf > now + 60) {
    // 60s clock skew tolerance
    throw new Error("Token not yet valid");
  }

  // Verify signature
  const publicKey = await getClerkPublicKey(payload.iss);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    data,
  );

  if (!valid) {
    throw new Error("Invalid signature");
  }

  return payload;
}

/**
 * Middleware that requires a valid Clerk JWT.
 * Sets c.set("userId", clerkUserId) on success.
 */
export function requireAuth() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyClerkToken(token);
      c.set("userId", payload.sub);
      await next();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Authentication failed";
      return c.json({ error: message }, 401);
    }
  };
}

/**
 * Optional auth middleware — sets userId if token present, continues either way.
 */
export function optionalAuth() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const payload = await verifyClerkToken(token);
        c.set("userId", payload.sub);
      } catch {
        // Invalid token — proceed without auth
      }
    }
    await next();
  };
}
