// Shown when an admin has confirmed the listing came from the conference's own secretariat.
// The tooltip says what that means; the About page explains how it's checked.
export default function Verified() {
  return (
    <span className="tip" data-tip="Listed by the conference's own secretariat, checked by Collex" data-tip-align="start">
      <span className="badge accent">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Verified
        <span className="sr-only">: listed by the conference&rsquo;s own secretariat, checked by Collex</span>
      </span>
    </span>
  );
}
