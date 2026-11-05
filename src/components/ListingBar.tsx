"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import ListingNav from "./ListingNav";
import s from "@/app/inner.module.css";

// On a conference's public page, the people who run it (and admins) get the switch to its Activity and Edit pages.
// Everyone else sees nothing: the database lists a team only to the people on it.
export default function ListingBar({ id, slug }: { id?: string; slug: string }) {
  const { session } = useAuth();
  const [role, setRole] = useState<"editor" | "viewer" | null>(null);
  const uid = session?.user.id;
  useEffect(() => {
    setRole(null);
    if (!id || !uid || !supabase) return;
    let live = true;
    supabase.rpc("organisers_of", { conf: id }).then(({ data }) => {
      const team = (data ?? []) as { user_id: string; is_owner: boolean; role: "editor" | "viewer" }[];
      if (!live || !team.length) return;
      const me = team.find((m) => m.user_id === uid);
      setRole(!me || me.is_owner ? "editor" : me.role);
    });
    return () => { live = false; };
  }, [id, uid]);
  if (!id || !role) return null;
  return <div className={s.listingBar}><ListingNav id={id} slug={slug} current="view" live canEdit={role === "editor"} /></div>;
}
