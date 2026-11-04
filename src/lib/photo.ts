import { supabase } from "./supabase";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const SIDE = 512;

/** The picture cropped to a centred square and shrunk, as a JPEG: a few tens of KB, whatever the photo it came from. */
async function square(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(SIDE, side);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
    bitmap.close();
    return await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.86));
  } catch { return null; }
}

/** A person's photo, into this account's own folder of the public photos bucket; its address comes back. */
export async function uploadPhoto(file: File, userId: string): Promise<{ url: string } | { error: string }> {
  if (!supabase) return { error: "Photos can't be added right now." };
  if (!TYPES.includes(file.type)) return { error: "Use a JPG, PNG or WebP picture." };
  if (file.size > 15 * 1024 * 1024) return { error: "That picture is too large. Try a smaller one." };
  const blob = await square(file);
  if (!blob) return { error: "That picture couldn't be read. Try another." };
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) return { error: "The picture didn't upload. Try again." };
  return { url: supabase.storage.from("photos").getPublicUrl(path).data.publicUrl };
}
