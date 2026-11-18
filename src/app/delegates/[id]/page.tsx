import type { Metadata } from "next";
import { DelegateRecord } from "@/components/HubExtras";

export const metadata: Metadata = {
  title: "MUN Record · Collex",
  robots: { index: false },
};

export default async function DelegatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DelegateRecord id={id} />;
}
