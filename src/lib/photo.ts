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

/** The picture shrunk to fit inside `max` pixels each way, as a JPEG no bigger than `limit` bytes (it tries a lower quality until it fits). */
async function wide(file: File, max: number, limit: number): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const q of [0.82, 0.7, 0.58, 0.46, 0.36]) {
      const blob: Blob | null = await new Promise((done) => canvas.toBlob(done, "image/jpeg", q));
      if (blob && blob.size <= limit) return blob;
    }
    return null;
  } catch { return null; }
}

/** A committee's display background, into this account's own folder of the public photos bucket; its address comes back. */
export async function uploadBackgroundBlob(blob: Blob, userId: string): Promise<{ url: string } | { error: string }> {
  if (!supabase) return { error: "Photos can't be added right now." };
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) return { error: "The picture didn't upload. Try again." };
  return { url: supabase.storage.from("photos").getPublicUrl(path).data.publicUrl };
}
export async function uploadBackground(file: File, userId: string): Promise<{ url: string } | { error: string }> {
  if (!TYPES.includes(file.type)) return { error: "Use a JPG, PNG or WebP picture." };
  if (file.size > 25 * 1024 * 1024) return { error: "That picture is too large. Try a smaller one." };
  const blob = await wide(file, 1920, 900_000);
  if (!blob) return { error: "That picture couldn't be read. Try another." };
  return uploadBackgroundBlob(blob, userId);
}
/** For someone not logged in: a smaller copy carried inside the committee itself, as a data address. */
export async function backgroundData(file: File): Promise<{ data: string } | { error: string }> {
  if (!TYPES.includes(file.type)) return { error: "Use a JPG, PNG or WebP picture." };
  if (file.size > 25 * 1024 * 1024) return { error: "That picture is too large. Try a smaller one." };
  const blob = await wide(file, 1280, 380_000);
  if (!blob) return { error: "That picture couldn't be read. Try another." };
  const data = await new Promise<string>((done) => { const r = new FileReader(); r.onload = () => done(String(r.result)); r.readAsDataURL(blob); });
  return { data };
}
/** A data address back into a file, without a network request (the site's policy doesn't allow fetching one). */
export function dataToBlob(data: string): Blob | null {
  const m = /^data:(image\/jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}
