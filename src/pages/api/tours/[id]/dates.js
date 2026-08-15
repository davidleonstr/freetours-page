import { getTourDates } from "@/lib/api.js";

export const prerender = false;

export async function GET({ params }) {
  try {
    const dates = await getTourDates(params.id);
    return new Response(JSON.stringify(dates), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Failed to load tour dates", err);
    return new Response(
      JSON.stringify({ message: "No se han podido cargar las fechas disponibles." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}