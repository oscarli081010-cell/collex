import { createClient } from "@supabase/supabase-js";
import type { Theme } from "./theme";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Null until the project's URL and publishable key are set in .env.local / Vercel.
export const supabase = url && key ? createClient(url, key) : null;

export type Role = "Delegate" | "Chair" | "Secretariat";
export const ROLES: Role[] = ["Delegate", "Chair", "Secretariat"];

export type Profile = { id: string; email: string; full_name: string; school: string; role: Role; is_admin: boolean; theme: Theme };
