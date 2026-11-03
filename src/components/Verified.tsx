// Shown when an admin has confirmed the listing came from the conference's own secretariat.
export default function Verified() {
  return (
    <span className="badge accent" title="Listed by the conference's own secretariat">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Verified
    </span>
  );
}
