// Shown when an admin has confirmed the listing came from the conference's own secretariat.
// The tooltip says what that means; the About page explains how it's checked.
export default function Verified({ large = false, circle = false }: { large?: boolean; circle?: boolean }) {
  // The page header shows it as one of the round buttons, without being a button.
  if (circle) {
    return (
      <span className="tip" data-tip="Listed by the conference's own secretariat, checked by Collex">
        <span className="button secondary iconbtn" style={{ color: "var(--accent)", cursor: "default" }} role="img" aria-label="Verified: listed by the conference's own secretariat, checked by Collex"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 1.8l1.6 1.2 2-.1.6 1.9 1.6 1.2-.6 1.9.6 1.9-1.6 1.2-.6 1.9-2-.1L8 14.2l-1.6-1.2-2 .1-.6-1.9-1.6-1.2.6-1.9-.6-1.9 1.6-1.2.6-1.9 2 .1z" /><path d="M5.8 8.1l1.5 1.5 2.9-3" /></svg></span>
      </span>
    );
  }
  return (
    <span className="tip" data-tip="Listed by the conference's own secretariat, checked by Collex" data-tip-align="start">
      <span className={`badge accent ${large ? "lg" : ""}`}>
        <svg width={large ? 14 : 12} height={large ? 14 : 12} viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Verified
        <span className="sr-only">: listed by the conference&rsquo;s own secretariat, checked by Collex</span>
      </span>
    </span>
  );
}
