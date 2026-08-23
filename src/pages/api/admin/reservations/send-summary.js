import { isAdminAuthenticated } from "@/lib/adminSession.js";
import { AdminApiError, sendReservationsSummaryEmail } from "@/lib/adminApi.js";

export const prerender = false;

export async function POST({ cookies }) {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ message: "No autenticado." }), { status: 401 });
  }

  try {
    const result = await sendReservationsSummaryEmail();
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    if (err instanceof AdminApiError) {
      return new Response(JSON.stringify({ message: err.message }), { status: err.status ?? 502 });
    }
    console.error("Error enviando el resumen de reservas", err);
    return new Response(JSON.stringify({ message: "No se ha podido enviar el resumen." }), { status: 500 });
  }
}