// Server-only cookie helpers for the customer session (a raw backend JWT).
// The token itself is never exposed to client-side JS — it's httpOnly and
// only ever read/used from Astro API routes (see src/pages/api/auth/*).

export const SESSION_COOKIE = 'session_token';

// Matches the backend's default JWT_EXPIRES_IN ('7d'). If you change
// JWT_EXPIRES_IN on the backend, update this to match so the cookie
// doesn't outlive (or expire before) the token it holds.
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7
};

export function setSessionCookie(cookies, token) {
  cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
}

export function clearSessionCookie(cookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function getSessionToken(cookies) {
  return cookies.get(SESSION_COOKIE)?.value ?? null;
}