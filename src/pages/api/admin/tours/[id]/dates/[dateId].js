import { deleteTourDate, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function DELETE({ params }) {
  try {
    const result = await deleteTourDate(params.id, params.dateId);
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
  const message = err instanceof AdminApiError ? err.message : "No se ha podido eliminar la fecha.";
  return json({ error: "Error", message }, status);
}