import { getTourSchedules } from "@/lib/api.js";

export const prerender = false;

export async function GET({ params }) {
  try {
    const schedules = await getTourSchedules(params.id);
    return new Response(JSON.stringify(schedules), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Failed to load tour schedules", err);
    return new Response(
      JSON.stringify({ message: "No se han podido cargar los horarios." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}