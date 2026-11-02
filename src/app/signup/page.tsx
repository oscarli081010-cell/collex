import type { Metadata } from "next";
import { SignupForm } from "@/components/AuthForms";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "Create an account · Collex" };

export default function Page() {
  return (
    <main id="top" className={`container ${s.page}`}>
      <SignupForm />
    </main>
  );
}
