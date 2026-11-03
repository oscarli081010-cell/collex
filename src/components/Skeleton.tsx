// Placeholders shaped like the content they stand in for, so nothing jumps when it arrives.
const B = ({ w = "100%", h = 14, r = 8, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) => (
  <span className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

/** A centred form: title, a line of text, then fields. Used while the account or a form loads. */
export function FormSkeleton({ fields = 4, width = 440, grid = false }: { fields?: number; width?: number; grid?: boolean }) {
  return (
    <div className="skelWrap" style={{ width: "100%", maxWidth: width }} aria-busy="true" aria-label="Loading">
      <B w="62%" h={44} r={10} />
      <B w="80%" style={{ marginTop: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: grid ? "1fr 1fr" : "1fr", gap: 20, marginTop: 32 }}>
        {Array.from({ length: fields }, (_, i) => (
          <span key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}><B w={90} h={12} /><B h={44} /></span>
        ))}
      </div>
      <B h={46} r={8} style={{ marginTop: 28 }} />
    </div>
  );
}

/** An inner page while it loads: the headline band, then a few rows. */
export function PageSkeleton() {
  return (
    <div className="skelWrap" aria-busy="true" aria-label="Loading">
      <div className="pagehead">
        <B w="min(520px, 80%)" h={56} r={12} />
        <B w="min(420px, 65%)" style={{ marginTop: 18 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1, 2, 3].map((i) => <B key={i} h={72} r={12} style={{ opacity: 1 - i * 0.18 }} />)}
      </div>
    </div>
  );
}

/** A conference page while it loads: cover, name, the facts line and the three cards, in their real places. */
export function ConferenceSkeleton({ band }: { band: string }) {
  return (
    <div className="skelWrap" aria-busy="true" aria-label="Loading">
      <B h={220} r={10} style={{ marginTop: 32 }} />
      <div style={{ display: "flex", gap: 20, alignItems: "center", padding: "36px 0 32px" }}>
        <B w={72} h={80} r={14} style={{ flex: "none" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <B w={140} h={24} r={999} />
          <B w="min(560px, 90%)" h={48} r={10} />
          <B w="min(420px, 70%)" />
        </div>
      </div>
      <div className={band}>
        {[0, 1, 2].map((i) => <B key={i} h={196} r={14} />)}
      </div>
    </div>
  );
}

/** Rows in a list or table. */
export function RowsSkeleton({ rows = 3, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div className="skelWrap" style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <B key={i} h={height} r={12} style={{ opacity: 1 - i * 0.18 }} />)}
    </div>
  );
}
