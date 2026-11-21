import type { Metadata } from "next";
import PageBand from "@/components/PageBand";
import Practice from "@/components/Practice";

export const metadata: Metadata = {
  alternates: { canonical: "/practice" },
  title: "Practise a speech · Collex",
  description: "Practise MUN speeches with a timer: a random topic and country, a 60-second opening, a point of information reply or a right of reply.",
};

export default function PracticePage() {
  return (
    <main id="top" className="container">
      <PageBand title="Practise" accent="a speech" lead="Pick a kind of speech, get a topic and a country, and speak to the timer. No account needed, and nothing leaves this browser." />
      <Practice />
    </main>
  );
}
