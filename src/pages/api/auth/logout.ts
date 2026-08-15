// @ts-nocheck
import type { APIRoute } from 'astro';
import { clearSessionCookie } from '@/lib/session.js';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  clearSessionCookie(cookies);
  return new Response(JSON.stringify({ message: 'Sesión cerrada.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};