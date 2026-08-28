// src/pages/api/bookings/[id].js
//
// Thin server-side proxy, same reason getTourSchedules needed
// src/pages/api/tours/[id]/schedules.js: the browser can't hold API_KEY,
// so client-side <script> code calls this route instead of the backend
// directly. This route runs server-side (has API_KEY via api.js).
//
// No login/session required — anyone with the booking id (from the
// ticket email / manage link / QR code) can edit or cancel it. The
// backend (PATCH/DELETE /bookings/:id in routes/bookings.js) no longer
// requires a Bearer token either, so this proxy doesn't need to gate on
// a session cookie or forward one.
import { updateBooking, cancelBooking, ApiError } from "@/lib/api.js";

export const prerender = false;

function fromApiError(err) {
  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof ApiError ? err.message : "Error inesperado.";
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function PATCH({ params, request }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: "Cuerpo de la solicitud inválido." }), { status: 400 });
  }

  try {
    const updated = await updateBooking(params.id, data);
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return fromApiError(err);
  }
}

export async function DELETE({ params }) {
  try {
    const cancelled = await cancelBooking(params.id);
    return new Response(JSON.stringify(cancelled), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return fromApiError(err);
  }
}