// Server-only helper for the admin session cookie used by the real login
// page (src/pages/admin/login.astro) instead of a browser Basic Auth prompt.
//
// Uses ADMIN_USER / ADMIN_PASSWORD (already required by the project) to
// validate credentials, and signs the session cookie with ADMIN_SESSION_SECRET
// if you set one — otherwise it falls back to ADMIN_PASSWORD as the signing
// secret, which is fine for a single-admin setup but a dedicated secret is
// recommended:
//   ADMIN_SESSION_SECRET   any long random string, server-side only

import crypto from "node:crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";

const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: "lax",
  maxAge: MAX_AGE_SECONDS
};

function getSecret() {
  const secret = import.meta.env.ADMIN_SESSION_SECRET || import.meta.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error(
      "Falta ADMIN_SESSION_SECRET (o ADMIN_PASSWORD) en el servidor: es necesario para firmar la sesión de administrador."
    );
  }
  return secret;
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createAdminSessionToken(username) {
  const issuedAt = Date.now().toString();
  const payload = `${username}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [username, issuedAt, signature] = parts;

  const expected = sign(`${username}.${issuedAt}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  if (Date.now() - Number(issuedAt) > MAX_AGE_SECONDS * 1000) return false;

  return true;
}

export function setAdminSessionCookie(cookies, username) {
  cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(username), COOKIE_OPTIONS);
}

export function clearAdminSessionCookie(cookies) {
  cookies.delete(ADMIN_SESSION_COOKIE, { path: "/" });
}

export function isAdminAuthenticated(cookies) {
  return verifyAdminSessionToken(cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null);
}