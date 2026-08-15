import { getTourAvailability } from "@/lib/api.js";

export const prerender = false;

export async function GET({ params, url }) {
  const dateId = url.searchParams.get("dateId");
  const scheduleId = url.searchParams.get("scheduleId");

  if (!dateId || !scheduleId) {
    return new Response(
      JSON.stringify({ message: "Faltan parámetros dateId y scheduleId." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const availability = await getTourAvailability(params.id, { dateId, scheduleId });
    return new Response(JSON.stringify(availability), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Failed to load tour availability", err);
    return new Response(
      JSON.stringify({ message: "No se ha podido comprobar la disponibilidad." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}