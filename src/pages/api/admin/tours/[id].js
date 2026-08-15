import { getTourById, updateTour, archiveTour, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function GET({ params }) {
  try {
    const tour = await getTourById(params.id);
    return json(tour);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH({ params, request }) {
  try {
    const payload = await request.json();
    const tour = await updateTour(params.id, payload);
    return json(tour);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE({ params }) {
  try {
    const result = await archiveTour(params.id);
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