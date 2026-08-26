import { updateTourStop, deleteTourStop, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function PATCH({ params, request }) {
  try {
    const payload = await request.json();
    const stop = await updateTourStop(params.id, params.stopId, payload);
    return json(stop);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE({ params }) {
  try {
    const result = await deleteTourStop(params.id, params.stopId);
    return json(result);
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
  const message = err instanceof AdminApiError ? err.message : "No se ha podido completar la operación.";
  return json({ error: "Error", message }, status);
}