import { listTourDates, createTourDate, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function GET({ params }) {
  try {
    const dates = await listTourDates(params.id);
    return json(dates);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST({ params, request }) {
  try {
    const payload = await request.json();
    const date = await createTourDate(params.id, payload);
    return json(date, 201);
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