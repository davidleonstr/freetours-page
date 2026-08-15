// @ts-nocheck
import type { APIRoute } from "astro";
import { setAdminSessionCookie } from "@/lib/adminSession.js";

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// A tiny in-memory limiter to slow down brute-force guesses against the
// single admin account. Resets on redeploy/restart — fine at this scale;
// swap for something persistent (e.g. your API's rate limiter) if needed.
const attempts = new Map<string, { count: number; first: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function tooManyAttempts(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const adminUser = import.meta.env.ADMIN_USER;
  const adminPassword = import.meta.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPassword) {
    return json({ message: "El panel de administración no está configurado." }, 500);
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ message: "Cuerpo de la petición inválido." }, 400);
  }

  const { username, password } = body ?? {};
  if (!username || !password) {
    return json({ message: "Introduce usuario y contraseña." }, 400);
  }

  let clientKey = "unknown";
  try {
    clientKey = clientAddress ?? "unknown";
  } catch {
    // clientAddress can throw in some adapters/environments — ignore and
    // fall back to a shared bucket rather than failing the request.
  }

  if (tooManyAttempts(`${clientKey}:${username}`)) {
    return json({ message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }, 429);
  }

  if (username !== adminUser || password !== adminPassword) {
    return json({ message: "Usuario o contraseña incorrectos." }, 401);
  }

  setAdminSessionCookie(cookies, username);
  return json({ message: "Sesión iniciada." }, 200);
};