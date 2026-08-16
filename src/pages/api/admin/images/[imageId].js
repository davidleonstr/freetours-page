import { updateImage, deleteImage, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function PATCH({ params, request }) {
  try {
    const body = await request.json();
    const image = await updateImage(params.imageId, body);
    return new Response(JSON.stringify(image), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const status = err instanceof AdminApiError ? err.status : 500;
    const message = err instanceof AdminApiError ? err.message : "No se ha podido actualizar la imagen.";
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function DELETE({ params }) {
  try {
    const result = await deleteImage(params.imageId);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const status = err instanceof AdminApiError ? err.status : 500;
    const message = err instanceof AdminApiError ? err.message : "No se ha podido eliminar la imagen.";
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}