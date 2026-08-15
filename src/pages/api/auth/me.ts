// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, getCurrentCustomer } from '@/lib/api.js';
import { getSessionToken, clearSessionCookie } from '@/lib/session.js';

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ cookies }) => {
  const token = getSessionToken(cookies);
  if (!token) return json({ message: 'No has iniciado sesión.' }, 401);

  try {
    const customer = await getCurrentCustomer(token);
    return json({ customer }, 200);
  } catch (err) {
    clearSessionCookie(cookies);
    const status = err instanceof ApiError ? err.status : 500;
    return json({ message: 'Tu sesión ha expirado. Inicia sesión de nuevo.' }, status === 500 ? 500 : 401);
  }
};