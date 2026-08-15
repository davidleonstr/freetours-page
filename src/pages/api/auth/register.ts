// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, registerCustomer } from '@/lib/api.js';
import { setSessionCookie } from '@/lib/session.js';

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Cuerpo de la petición inválido.' }, 400);
  }

  const { email, fullName, phone } = body ?? {};
  if (!email || !fullName) {
    return json({ message: 'El nombre completo y el correo electrónico son obligatorios.' }, 400);
  }

  try {
    const { token, customer } = await registerCustomer({ email, fullName, phone });
    setSessionCookie(cookies, token);
    return json({ customer }, 201);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : 'No se ha podido crear la cuenta.';
    return json({ message }, status);
  }
};
