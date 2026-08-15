import { setTourCoverImage, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function POST({ params, request }) {
  try {
    const { imageId } = await request.json();
    if (!imageId) {
      return json({ error: "Bad Request", message: "Falta imageId." }, 400);
    }
    const galleryEntry = await setTourCoverImage(params.id, imageId);
    return json(galleryEntry, 201);
  } catch (err) {
    const status = err instanceof AdminApiError ? err.status : 500;
    const message = err instanceof AdminApiError ? err.message : "No se ha podido guardar la imagen destacada.";
    return json({ error: "Error", message }, status);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}