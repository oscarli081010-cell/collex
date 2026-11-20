"use client";

import { useEffect, useMemo, useState } from "react";
import * as ch from "@/lib/chamber";
import { formatRange } from "@/lib/conferences";
import { GROUPS } from "@/lib/groups";
import { LIST_CSS, PLACARD_CSS, countryListHtml, namesFrom, placardsHtml, printHtml } from "@/lib/printables";
import { supabase } from "@/lib/supabase";
import Select from "../../Select";
import Section from "../Section";
import type { ListingCtx } from "../types";
import type { Room } from "./Committees";
import h from "../../Hub.module.css";

type Allocation = { committee: string; country: string; name: string; school: string };
const OTHER = "__other";
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Placards and country lists, one committee at a time. The list of countries is filled from the allocations, from the
// committee as its chair set it up on Collex, or from a ready-made group, and can be changed by hand before printing.
export default function Printables({ ctx }: { ctx: ListingCtx }) {
  const { c, id, say } = ctx;
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [rooms, setRooms] = useState<{ committee: string; states: string[] }[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [text, setText] = useState("");
  // Typed by hand: a list someone has changed is never replaced without their say.
  const [typed, setTyped] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let on = true;
    supabase.from("applications").select("committee, country, name, school").eq("conference_id", id).eq("status", "accepted").eq("kind", "delegate")
      .then(({ data }) => { if (on) setAllocations(((data as Allocation[] | null) ?? []).filter((a) => a.committee && a.country)); });
    supabase.rpc("conference_wall", { conf: id }).then(({ data }) => {
      if (!on || !data) return;
      setRooms(((data as { rooms: Room[] }).rooms ?? []).map((r) => {
        const s = r.state && typeof r.state === "object" ? ch.normalise({ ...(r.state as object), log: [] }) : null;
        return { committee: r.committee || r.name, states: s ? s.delegates.map((d) => d.name) : [] };
      }).filter((r) => r.states.length > 0));
    });
    return () => { on = false; };
  }, [id]);

  // Every committee the conference is known to have: on its listing, in the allocations, or linked from its chairs' committee.
  const committees = useMemo(() => {
    const out: string[] = [];
    for (const n of [...c.committees.map((k) => k.name), ...allocations.map((a) => a.committee), ...rooms.map((r) => r.committee)]) {
      if (n.trim() && !out.some((x) => same(x, n))) out.push(n.trim());
    }
    return out;
  }, [c.committees, allocations, rooms]);
  const choice = picked ?? committees[0] ?? OTHER;
  const committee = choice === OTHER ? other.trim() : choice;

  const sources = useMemo(() => {
    const allocated = allocations.filter((a) => same(a.committee, committee)).map((a) => a.country);
    const room = rooms.find((r) => same(r.committee, committee))?.states ?? [];
    return [
      ...(allocated.length ? [{ id: "allocations", label: `The allocations (${namesFrom(allocated.join("\n")).length})`, names: allocated }] : []),
      ...(room.length ? [{ id: "chambers", label: `The committee on Collex (${room.length})`, names: room }] : []),
      ...GROUPS.map((g) => ({ id: g.name, label: `${g.name} (${g.states.length})`, names: g.states })),
    ];
  }, [allocations, rooms, committee]);
  // A committee's own list fills in by itself, until someone starts typing.
  const own = sources.find((x) => x.id === "allocations") ?? sources.find((x) => x.id === "chambers");
  const ownList = own ? namesFrom(own.names.join("\n")).join("\n") : "";
  useEffect(() => { if (!typed) setText(ownList); }, [ownList, typed]);

  const names = namesFrom(text);
  const sheet = { conference: c.name, committee, dates: c.startDate ? formatRange(c) : "" };
  const print = async (what: "placards" | "list") => {
    if (!names.length || busy) return;
    setBusy(true);
    try {
      if (what === "placards") await printHtml(`${committee || c.name} placards`, PLACARD_CSS, placardsHtml(sheet, names));
      else {
        const who = (country: string) => allocations.find((a) => same(a.committee, committee) && same(a.country, country));
        await printHtml(`${committee || c.name} country list`, LIST_CSS, countryListHtml(sheet, names.map((n) => ({ country: n, delegate: who(n)?.name ?? "", school: who(n)?.school ?? "" }))));
      }
    } catch { say("That couldn’t be printed. Try again."); }
    setBusy(false);
  };
  const why = names.length ? "" : "Add at least one country first";
  const button = (what: "placards" | "list", label: string, primary: boolean) => {
    const b = <button type="button" className={primary ? "button" : "button secondary"} disabled={!names.length || busy} onClick={() => void print(what)}>{label}</button>;
    return why ? <span className="tip" data-tip={why}>{b}</span> : b;
  };

  return (
    <Section id="sec-print" title="Placards and Lists">
      <div className={h.two}>
        <div className="field">
          <label htmlFor="pr-committee">Committee</label>
          {committees.length > 0 ? (
            <Select id="pr-committee" className="control" value={choice} onChange={(e) => { setPicked(e.target.value); setTyped(false); }}>
              {committees.map((k) => <option key={k} value={k}>{k}</option>)}
              <option value={OTHER}>Another committee</option>
            </Select>
          ) : <input id="pr-committee" className="control" value={other} maxLength={120} placeholder="Security Council" onChange={(e) => setOther(e.target.value)} />}
        </div>
        <div className="field">
          <label htmlFor="pr-fill">Fill From</label>
          <Select id="pr-fill" className="control" value="" onChange={(e) => { const s = sources.find((x) => x.id === e.target.value); if (s) { setText(namesFrom(s.names.join("\n")).join("\n")); setTyped(true); } }}>
            <option value="">Choose a list</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </div>
      </div>
      {committees.length > 0 && choice === OTHER && (
        <div className="field">
          <label htmlFor="pr-other">Committee Name</label>
          <input id="pr-other" className="control" value={other} maxLength={120} onChange={(e) => setOther(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label htmlFor="pr-list">Countries <span className="muted">(one on each line)</span></label>
        <textarea id="pr-list" className="control" rows={8} maxLength={8000} value={text} onChange={(e) => { setText(e.target.value); setTyped(true); }} placeholder={"Australia\nBrazil\nChina"} />
      </div>
      <div className="btnStack">
        {button("placards", names.length ? `Print ${names.length} ${names.length === 1 ? "Placard" : "Placards"}` : "Print Placards", true)}
        {button("list", "Print the Country List", false)}
      </div>
    </Section>
  );
}
