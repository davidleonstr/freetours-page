// @ts-nocheck
import type { APIRoute } from "astro";
import { clearAdminSessionCookie } from "@/lib/adminSession.js";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  clearAdminSessionCookie(cookies);
  return new Response(JSON.stringify({ message: "Sesión cerrada." }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};