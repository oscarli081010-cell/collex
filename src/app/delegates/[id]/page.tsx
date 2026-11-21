import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DelegateRecord } from "@/components/HubExtras";

export const metadata: Metadata = {
  title: "MUN record · Collex",
  description: "A delegate's Model UN conferences and roles, shared on Collex by the delegate, to show where they have taken part.",
  robots: { index: false },
};

export default async function DelegatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A record's address is always a UUID: anything else can't be one, so it is a real 404. (Whether a well-formed address
  // is a public record depends on who is looking, so that is still decided in the browser, by the record itself.)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <DelegateRecord id={id} />;
}
