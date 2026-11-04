import Link from "next/link";
import { NA, roleLabel, type Role, type RoleKind } from "@/lib/conferences";
import s from "./Roles.module.css";

const icon = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const KIND_ICON: Record<RoleKind, React.ReactNode> = {
  chair: icon(<><rect x="2.5" y="9.5" width="7" height="3" rx="1" transform="rotate(-30 6 11)" /><path d="M8.5 6.5l3-3 2 2-3 3M3 14h8" /></>),
  crisis: icon(<path d="M9 1.8L3.5 9H8l-1 5.2L12.5 7H8z" />),
  press: icon(<><rect x="5.5" y="1.8" width="5" height="8" rx="2.5" /><path d="M3 8a5 5 0 0010 0M8 13v1.7" /></>),
  photo: icon(<><path d="M2 5.5a1.5 1.5 0 011.5-1.5h1.2L5.8 2.5h4.4L11.3 4h1.2A1.5 1.5 0 0114 5.5v6A1.5 1.5 0 0112.5 13h-9A1.5 1.5 0 012 11.5z" /><circle cx="8" cy="8.2" r="2.3" /></>),
  tech: icon(<><rect x="2" y="3" width="12" height="8" rx="1.5" /><path d="M1.5 13.5h13" /></>),
  logistics: icon(<><path d="M2.5 5L8 2.5 13.5 5v6L8 13.5 2.5 11z" /><path d="M2.5 5L8 7.5 13.5 5M8 7.5v6" /></>),
  other: icon(<><circle cx="3.5" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="12.5" cy="8" r="1" /></>),
};

/** Where "Apply" goes: their own link, else an email to the organisers (the contact is already public), else nowhere. */
export function applyFor(role: Role, conference: { name: string; contact: string }) {
  if (role.url) return { href: role.url, label: "Apply", external: true };
  if (conference.contact && conference.contact !== NA && /^\S+@\S+\.\S+$/.test(conference.contact)) {
    const subject = encodeURIComponent(`${role.title || roleLabel(role.kind)} at ${conference.name}`);
    return { href: `mailto:${conference.contact}?subject=${subject}`, label: "Ask the organisers", external: false };
  }
  return null;
}

// One role a conference needs. On the board it names its conference; on the conference's own page it doesn't.
export default function RoleCard({ role, conference, when, apply }: {
  role: Role; conference?: { slug: string; name: string; host: string }; when?: string;
  apply: { href: string; label: string; external: boolean } | null;
}) {
  const label = roleLabel(role.kind);
  return (
    <article className={`panel ${s.card}`}>
      <div className={s.top}>
        <span className={s.kind} data-kind={role.kind}>{KIND_ICON[role.kind]}{label}</span>
        {when && <span className={s.when}>{when}</span>}
      </div>
      <h3 className={s.title}>{role.title || label}</h3>
      {role.note && <p className={s.note}>{role.note}</p>}
      {conference && (
        <p className={s.conf}>
          <Link href={`/conferences/${conference.slug}`}>{conference.name}</Link>
          <span>Hosted by {conference.host}</span>
        </p>
      )}
      {apply && (apply.external
        ? <a href={apply.href} target="_blank" rel="noreferrer" className={`button block ${s.apply}`}>{apply.label} →</a>
        : <a href={apply.href} className={`button secondary block ${s.apply}`}>{apply.label}</a>)}
    </article>
  );
}
