// Small line icons for a conference's when, who and where, shared by its page and its listing row.
const icon = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

export const META_ICONS = {
  date: icon(<><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>),
  host: icon(<><path d="M2 13.5h12M3.5 13.5V7L8 3.5 12.5 7v6.5" /><path d="M6.5 13.5v-3h3v3" /></>),
  mail: icon(<><rect x="1.8" y="3.5" width="12.4" height="9" rx="2" /><path d="M2.4 5l5.6 4 5.6-4" /></>),
  venue: icon(<><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 00-9 0C3.5 9.8 8 14 8 14z" /><circle cx="8" cy="6.5" r="1.6" /></>),
};
