// src/pages/api/bookings/[id].js
//
// Thin server-side proxy, same reason getTourSchedules needed
// src/pages/api/tours/[id]/schedules.js: the browser can't hold API_KEY,
// so client-side <script> code calls this route instead of the backend
// directly. This route runs server-side (has API_KEY via api.js) and
// forwards the customer's own session token as a Bearer header so the
// backend's ownership check (request.user.sub === booking.customer_id)
// applies — this route does NOT need to duplicate that check itself.
import { updateBooking, cancelBooking, ApiError } from "@/lib/api.js";
import { getSessionToken } from "@/lib/session.js";

export const prerender = false;

function unauthorized() {
  return new Response(JSON.stringify({ message: "No has iniciado sesión." }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}

function fromApiError(err) {
  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof ApiError ? err.message : "Error inesperado.";
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function PATCH({ params, request, cookies }) {
  const token = getSessionToken(cookies);
  if (!token) return unauthorized();

  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: "Cuerpo de la solicitud inválido." }), { status: 400 });
  }

  try {
    const updated = await updateBooking(params.id, data, token);
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return fromApiError(err);
  }
}

export async function DELETE({ params, cookies }) {
  const token = getSessionToken(cookies);
  if (!token) return unauthorized();

  try {
    const cancelled = await cancelBooking(params.id, token);
    return new Response(JSON.stringify(cancelled), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return fromApiError(err);
  }
}