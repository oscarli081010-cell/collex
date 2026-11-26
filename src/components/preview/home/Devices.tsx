import Image from "next/image";
import s from "@/app/preview/home/home.module.css";

// Device frames drawn in CSS around real Collex screenshots. Each screen comes in a light and a dark copy; the page shows
// the one that matches the theme (the other is display: none, so a lazy image never loads it).

const LAPTOP = { w: 1600, h: 1000 };
const PHONE = { w: 780, h: 1688 };

export function Shot({ name, alt, kind, sizes }: { name: string; alt: string; kind: "laptop" | "phone"; sizes: string }) {
  const { w, h } = kind === "laptop" ? LAPTOP : PHONE;
  return (
    <>
      <Image className={`${s.shot} ${s.onLight}`} src={`/preview/home/${name}-light.webp`} alt={alt} width={w} height={h} sizes={sizes} />
      <Image className={`${s.shot} ${s.onDark}`} src={`/preview/home/${name}-dark.webp`} alt={alt} width={w} height={h} sizes={sizes} />
    </>
  );
}

export function Laptop({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${s.device} ${className ?? ""}`}>
      <div className={s.laptop}>
        <div className={s.lid}><div className={s.lidScreen}>{children}</div></div>
        <div className={s.base} aria-hidden="true" />
      </div>
    </div>
  );
}

export function Phone({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${s.device} ${className ?? ""}`}>
      <div className={s.phone}>
        <div className={s.phoneScreen}>
          {children}
          <span className={s.island} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/** The room's display: a plain wide screen, as on a projector or a television. */
export function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${s.device} ${className ?? ""}`}>
      <div className={s.screen}><div className={s.screenInner}>{children}</div></div>
    </div>
  );
}
