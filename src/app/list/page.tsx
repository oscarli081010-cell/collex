import type { Metadata } from "next";
import ListForm from "@/components/ListForm";

export const metadata: Metadata = { title: "List a conference · Collex" };

export default function ListPage() {
  return (
    <main id="top" className="container">
      <header className="pagehead">
        <h1>List a conference</h1>
        <p>Free, and it takes five minutes. Leave anything you don&rsquo;t know yet blank; it shows as N/A.</p>
      </header>
      <ListForm />
    </main>
  );
}
