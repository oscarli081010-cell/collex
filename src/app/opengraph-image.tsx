import { ogImage, OG_SIZE } from "@/lib/ogImage";

export const alt = "Collex: Sydney Model UN, in one place";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    title: "Sydney Model UN,",
    italic: "in one place.",
    lines: ["Upcoming conferences, dates and links."],
    footer: "collex.au",
  });
}
