// Line drawings for empty and lost states, drawn in the page's ink so they follow light and dark.
const art = (children: React.ReactNode) => (
  <svg className="drawing" viewBox="0 0 120 90" width="120" height="90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

/** A chair's gavel resting above its block. */
export const Gavel = () => art(<>
  <g transform="rotate(30 52 50)">
    <rect x="30" y="41" width="44" height="18" rx="4" />
    <path d="M38 41v18M66 41v18M52 41V6" />
  </g>
  <rect x="26" y="72" width="52" height="8" rx="3" />
  <path d="M12 84h96" />
</>);

/** A delegate's country placard, still blank. */
export const Placard = () => art(<>
  <path d="M28 80l13-52h38l13 52" />
  <path d="M48 46h24M52 56h16" strokeDasharray="2 4" />
  <path d="M14 80h92" />
</>);
