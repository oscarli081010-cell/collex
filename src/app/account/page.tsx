import type { Metadata } from "next";
import { AccountView } from "@/components/AuthForms";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "Your account · Collex", robots: { index: false } };

export default function Page() {
  return (
    <main id="top" className={`container ${s.banded}`}>
      <AccountView />
    </main>
  );
}
