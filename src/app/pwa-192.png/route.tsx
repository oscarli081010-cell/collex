import { brandIcon } from "@/lib/brandIcon";

export const dynamic = "force-static";

// The app icon a phone or laptop shows once Collex is installed.
export function GET() {
  return brandIcon(192, false);
}
