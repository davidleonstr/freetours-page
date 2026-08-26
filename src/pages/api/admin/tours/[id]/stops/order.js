import { reorderTourStops, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function PUT({ params, request }) {
  try {
    const { order } = await request.json();
    const stops = await reorderTourStops(params.id, order);
    return json(stops);
  } catch (err) {
    return errorResponse(err);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function errorResponse(err) {
  const status = err instanceof AdminApiError ? err.status : 500;
  const message = err instanceof AdminApiError ? err.message : "No se ha podido reordenar los puntos.";
  return json({ error: "Error", message }, status);
}