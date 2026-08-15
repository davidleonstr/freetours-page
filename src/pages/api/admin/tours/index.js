import { listAllTours, createTour, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function GET() {
  try {
    const tours = await listAllTours();
    return json(tours);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST({ request }) {
  try {
    const payload = await request.json();
    const tour = await createTour(payload);
    return json(tour, 201);
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