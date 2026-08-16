import { updateGalleryPosition, removeImageFromGallery, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function PATCH({ params, request }) {
  try {
    const body = await request.json();
    const entry = await updateGalleryPosition(params.id, params.galleryId, body.position);
    return new Response(JSON.stringify(entry), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const status = err instanceof AdminApiError ? err.status : 500;
    const message = err instanceof AdminApiError ? err.message : "No se ha podido actualizar la posición.";
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function DELETE({ params }) {
  try {
    const result = await removeImageFromGallery(params.id, params.galleryId);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const status = err instanceof AdminApiError ? err.status : 500;
    const message = err instanceof AdminApiError ? err.message : "No se ha podido quitar la imagen de la galería.";
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}