import { getTourGallery, addImageToGallery, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function GET({ params }) {
  try {
    const gallery = await getTourGallery(params.id);
    return new Response(JSON.stringify(gallery), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const status = err instanceof AdminApiError ? err.status : 500;
    const message = err instanceof AdminApiError ? err.message : "No se ha podido cargar la galería.";
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function POST({ params, request }) {
  try {
    const body = await request.json();
    const entry = await addImageToGallery(params.id, body);
    return new Response(JSON.stringify(entry), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const status = err instanceof AdminApiError ? err.status : 500;
    const message = err instanceof AdminApiError ? err.message : "No se ha podido añadir la imagen a la galería.";
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}