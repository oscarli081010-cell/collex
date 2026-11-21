"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as ch from "@/lib/chamber";
import { formatRange } from "@/lib/conferences";
import { GROUPS } from "@/lib/groups";
import { LIST_CSS, PLACARD_CSS, countryListHtml, namesFrom, placardsHtml, printHtml } from "@/lib/printables";
import { supabase } from "@/lib/supabase";
import Select from "../../Select";
import Section from "../Section";
import type { ListingCtx } from "../types";
import type { Room } from "./Committees";
import { useRefresh } from "./useRefresh";
import h from "../../Hub.module.css";

type Allocation = { id: string; committee: string; country: string; name: string; school: string };
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

  // Read again every time the section is opened again, so a delegate accepted or allocated since is on the sheets.
  const load = useCallback(() => {
    if (!supabase) return;
    const db = supabase;
    const take = (data: unknown) => setAllocations(((data as Allocation[] | null) ?? []).filter((a) => a.committee));
    const direct = () => db.from("applications").select("id, committee, country, name, school").eq("conference_id", id).eq("status", "accepted").eq("kind", "delegate")
      .then(({ data, error }) => { if (!error) take(data); });
    // A view-only co-organiser reads through a function that leaves out contact details. If the database doesn't have it yet, the old read is used.
    if (ctx.data.canEdit === false) {
      db.rpc("team_applications", { conf: id }).then(({ data, error }) => {
        if (error) return void direct();
        take(((data ?? []) as { status: string; kind: string }[]).filter((a) => a.status === "accepted" && a.kind === "delegate"));
      });
    } else void direct();
    supabase.rpc("conference_wall", { conf: id }).then(({ data }) => {
      if (!data) return;
      setRooms(((data as { rooms: Room[] }).rooms ?? []).map((r) => {
        const s = r.state && typeof r.state === "object" ? ch.normalise({ ...(r.state as object), log: [] }) : null;
        return { committee: r.committee || r.name, states: s ? s.delegates.map((d) => d.name) : [] };
      }).filter((r) => r.states.length > 0));
    });
  }, [id, ctx.data.canEdit]);
  useEffect(load, [load]);
  useRefresh("sec-print", load);

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
    const allocated = allocations.filter((a) => same(a.committee, committee) && a.country.trim()).map((a) => a.country);
    const room = rooms.find((r) => same(r.committee, committee))?.states ?? [];
    return [
      ...(allocated.length ? [{ id: "allocations", label: `The allocations (${allocated.length})`, names: allocated }] : []),
      ...(room.length ? [{ id: "chambers", label: `The committee on Collex (${room.length})`, names: room }] : []),
      ...GROUPS.map((g) => ({ id: g.name, label: `${g.name} (${g.states.length})`, names: g.states })),
    ];
  }, [allocations, rooms, committee]);
  // A committee's own list fills in by itself, until someone starts typing.
  const own = sources.find((x) => x.id === "allocations") ?? sources.find((x) => x.id === "chambers");
  // The allocations keep a country twice when two delegates share it (a double delegation gets a sheet each); other lists drop repeats.
  const ownList = own ? (own.id === "allocations" ? own.names.map((n) => n.replace(/\s+/g, " ").trim().slice(0, 80)).join("\n") : namesFrom(own.names.join("\n")).join("\n")) : "";
  useEffect(() => { if (!typed) setText(ownList); }, [ownList, typed]);

  // Typed lines are printed as they are, repeats included: someone who types France twice means two sheets.
  const names = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim().slice(0, 80)).filter(Boolean);
  // Accepted delegates in this committee with no country yet: their placard shows their name, and the list gives them their own heading.
  const later = allocations.filter((a) => same(a.committee, committee) && !a.country.trim());
  const sheet = { conference: c.name, committee, dates: c.startDate ? formatRange(c) : "" };
  const print = async (what: "placards" | "list") => {
    if (!names.length && !later.length) return;
    if (busy) return;
    setBusy(true);
    try {
      if (what === "placards") await printHtml(`${committee || c.name} placards`, PLACARD_CSS, placardsHtml(sheet, [...names, ...later.map((a) => a.name)]));
      else {
        // Each delegate belongs to one line: the second France line takes the second delegate for France, not the first again.
        const used = new Set<string>();
        const who = (country: string) => { const a = allocations.find((x) => !used.has(x.id) && same(x.committee, committee) && same(x.country, country)); if (a) used.add(a.id); return a; };
        await printHtml(`${committee || c.name} country list`, LIST_CSS, countryListHtml(sheet, names.map((n) => { const a = who(n); return { country: n, delegate: a?.name ?? "", school: a?.school ?? "" }; }), later.map((a) => ({ country: "", delegate: a.name, school: a.school }))));
      }
    } catch { say("That couldn’t be printed. Try again."); }
    setBusy(false);
  };
  const total = names.length + later.length;
  const why = total ? "" : "Add at least one country first";
  const button = (what: "placards" | "list", label: string, primary: boolean) => {
    const b = <button type="button" className={primary ? "button" : "button secondary"} disabled={!total || busy} onClick={() => void print(what)}>{label}</button>;
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
          <Select id="pr-fill" className="control" value="" onChange={(e) => { const s = sources.find((x) => x.id === e.target.value); if (s) { setText(s.id === "allocations" ? s.names.map((n) => n.replace(/\s+/g, " ").trim().slice(0, 80)).join("\n") : namesFrom(s.names.join("\n")).join("\n")); setTyped(true); } }}>
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
      {later.length > 0 && (
        <p className="muted">No country yet ({later.length}): {later.map((a) => a.name).join(", ")}. {later.length === 1 ? "Their placard shows their name." : "Their placards show their names."}</p>
      )}
      <div className="btnStack">
        {button("placards", total ? `Print ${total} ${total === 1 ? "Placard" : "Placards"}` : "Print Placards", true)}
        {button("list", "Print the Country List", false)}
      </div>
    </Section>
  );
}
