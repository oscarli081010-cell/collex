import type { Metadata } from "next";
import { LoginForm } from "@/components/AuthForms";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "Log in · Collex", description: "Log in to your Collex account." };

export default function Page() {
  return (
    <main id="top" className={`container ${s.page}`}>
      <LoginForm />
    </main>
  );
}
