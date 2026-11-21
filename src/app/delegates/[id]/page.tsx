import type { Metadata } from "next";
import { DelegateRecord } from "@/components/HubExtras";

export const metadata: Metadata = {
  title: "MUN record · Collex",
  description: "A delegate's Model UN conferences and roles, shared on Collex.",
  robots: { index: false },
};

export default async function DelegatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DelegateRecord id={id} />;
}
