import { getPublished } from "@/lib/data";
import { formatRange, NA } from "@/lib/conferences";

export const revalidate = 60;

// A plain-text summary of the site for AI assistants (llmstxt.org), with the current listings.
export async function GET() {
  const list = await getPublished();
  const lines = [
    "# Collex",
    "",
    "> A calendar of Model United Nations conferences in Sydney, Australia. Organisers list their conferences, and each listing is reviewed before it is published. Collex is independent and not affiliated with the United Nations.",
    "",
    "Confirm dates, fees and registration details with each conference's organisers.",
    "",
    "## Pages",
    "",
    "- [Calendar](https://collex.au/calendar): conferences month by month",
    "- [Conferences](https://collex.au/conferences): upcoming conferences with hosts and dates",
    "- [Guides](https://collex.au/guides): short guides for chairs, delegates and organisers",
    "- [Open roles](https://collex.au/roles): help that conferences are looking for, such as chairs and press",
    "- [Committees](https://collex.au/chambers): run a committee from one laptop: roll call, speakers' list, timers, motions, amendments and votes",
    "- [Past conferences](https://collex.au/past): conferences that have already run",
    "- [About](https://collex.au/about): why Collex exists and how listings work",
    "- [List a conference](https://collex.au/list): how organisers submit a listing",
    "- [Terms of use](https://collex.au/terms)",
    "- [Privacy policy](https://collex.au/privacy)",
    "",
    "## Conferences",
    "",
    ...(list.length
      ? list.map((c) => `- [${c.name}](https://collex.au/conferences/${c.slug}): hosted by ${c.host}, ${c.startDate ? formatRange(c) : "dates to be announced"}${c.venue === NA ? "" : `, at ${c.venue}`}`)
      : ["No conferences are listed yet."]),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
