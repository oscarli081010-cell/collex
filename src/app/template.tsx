// Re-mounts on every navigation, so each page enters with the same soft rise.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="t-page-enter">{children}</div>;
}
