// A group whose children rise in one after another as the page arrives. Pure CSS (the staggered entrance in motion.css),
// so there's no script to wait for: the text is on the screen from the first paint, not after the page has loaded.
export default function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`t-stagger ${className ?? ""}`}>{children}</div>;
}
