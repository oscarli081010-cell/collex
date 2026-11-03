import { getPublished } from "@/lib/data";
import { ics, icsResponse } from "@/lib/ics";

export const revalidate = 60;

// Every published conference as a feed calendar apps can subscribe to (webcal://collex.au/calendar.ics).
export async function GET() {
  return icsResponse(ics(await getPublished(), "Collex · Sydney Model UN"), "collex.ics", true);
}
