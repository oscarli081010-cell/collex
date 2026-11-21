import Link from "next/link";

export type Crumb = { name: string; href?: string };

// "Home › Guides › This guide": the trail to the current page, for people and (with breadcrumbJsonLd) for search engines.
export default function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {trail.map((c, i) => (
          <li key={c.name}>
            {c.href && i < trail.length - 1 ? <Link href={c.href}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** schema.org BreadcrumbList for the same trail. Addresses are relative to the site. */
export const breadcrumbJsonLd = (trail: Crumb[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((c, i) => ({
    "@type": "ListItem", position: i + 1, name: c.name,
    ...(c.href && { item: `https://collex.au${c.href}` }),
  })),
});
