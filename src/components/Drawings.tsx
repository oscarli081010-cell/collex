// Small marks for empty and lost states: one thin line icon on a soft disc, in the page's ink so they follow light
// and dark. Each icon is drawn on a 24-unit grid and sits in the middle of the 56-unit disc.
const art = (children: React.ReactNode) => (
  <svg className="drawing" viewBox="0 0 56 56" width="56" height="56" fill="none" aria-hidden="true">
    <circle className="drawingDisc" cx="28" cy="28" r="27.5" />
    <g transform="translate(16 16)" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  </svg>
);

/** A chair's gavel over its block. */
export const Gavel = () => art(<>
  <rect x="11" y="5.5" width="8" height="5" rx="1.2" transform="rotate(45 15 8)" />
  <path d="M13.2 9.8l-6.7 6.7" />
  <path d="M4 20h9" />
</>);

/** A delegate's country placard, still blank. */
export const Placard = () => art(<>
  <path d="M7 19l2.5-13h5L17 19" />
  <path d="M10.75 11h2.5" />
  <path d="M5 19h14" />
</>);

/** A committee's figures, not counted yet. */
export const Bars = () => art(<>
  <path d="M5 19h14" />
  <path d="M8.5 15.5v-3M12 15.5v-8M15.5 15.5v-5" />
</>);
