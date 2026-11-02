import type { Metadata } from "next";
import ListForm from "@/components/ListForm";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "List a conference · Collex", description: "Running a Model UN conference in Sydney? List it on Collex for free. Each listing is reviewed before it goes live." };

export default function ListPage() {
  return (
    <main id="top" className={`container ${s.page}`}>
      <ListForm />
    </main>
  );
}
