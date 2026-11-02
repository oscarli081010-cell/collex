import type { Metadata } from "next";
import ListForm from "@/components/ListForm";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "List a conference · Collex" };

export default function ListPage() {
  return (
    <main id="top" className={`container ${s.page}`}>
      <ListForm />
    </main>
  );
}
