import type { Metadata } from "next";
import { LoginForm } from "@/components/AuthForms";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "Log in · Collex", description: "Log in to your Collex account to follow Model UN conferences, list your own and keep track of what you are running or attending." };

export default function Page() {
  return (
    <main id="top" className={`container ${s.banded}`}>
      <LoginForm />
    </main>
  );
}
