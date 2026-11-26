import Image from "next/image";
import s from "./home.module.css";

// Device frames drawn in CSS around real Collex screenshots. A laptop or phone can also take a `model` (Model3D), the
// real 3D model drawn over the CSS one, which then hides once the model is showing. Each screen comes in a light and a dark copy; the page shows
// the one that matches the theme (the other is display: none, so a lazy image never loads it).

const LAPTOP = { w: 1600, h: 1000 };
const PHONE = { w: 780, h: 1688 };

export function Shot({ name, alt, kind, sizes, priority }: { name: string; alt: string; kind: "laptop" | "phone"; sizes: string; priority?: boolean }) {
  const { w, h } = kind === "laptop" ? LAPTOP : PHONE;
  return (
    <>
      <Image className={`${s.shot} ${s.onLight}`} src={`/img/home/${name}-light.webp`} alt={alt} width={w} height={h} sizes={sizes} fetchPriority={priority ? "high" : undefined} />
      <Image className={`${s.shot} ${s.onDark}`} src={`/img/home/${name}-dark.webp`} alt={alt} width={w} height={h} sizes={sizes} fetchPriority={priority ? "high" : undefined} />
    </>
  );
}

/** A laptop seen from above and to one side: the lid with its screen, standing on a deck with a keyboard and trackpad.
 *  Drawn with CSS 3D transforms, so it is one set of flat planes the browser tilts; no model, no images but the screen. */
export function Laptop({ children, className, bodyClassName, lidClassName, model }: { children: React.ReactNode; className?: string; bodyClassName?: string; lidClassName?: string; model?: React.ReactNode }) {
  return (
    <div className={`${s.device} ${s.l3} ${className ?? ""}`}>
      <div className={`${s.l3Body} ${bodyClassName ?? ""}`}>
        <div className={s.l3Deck} aria-hidden="true">
          <span className={s.l3Keys} />
          <span className={s.l3Pad} />
          <span className={s.l3Edge} />
        </div>
        <div className={`${s.l3Lid} ${lidClassName ?? ""}`}>
          <div className={s.l3Screen}>{children}<span className={s.l3Glare} aria-hidden="true" /></div>
        </div>
      </div>
      {model}
    </div>
  );
}

/** A phone. The screenshot starts below the status bar, so the camera pill never covers the page's own header. */
export function Phone({ children, className, model }: { children: React.ReactNode; className?: string; model?: React.ReactNode }) {
  return (
    <div className={`${s.device} ${className ?? ""}`}>
      <div className={s.phone}>
        <div className={s.phoneScreen}>
          <div className={s.status} aria-hidden="true">
            <span>9:41</span>
            <span className={s.statusIcons}><i /><i /><b /></span>
          </div>
          <div className={s.phoneView}>{children}</div>
          <span className={s.island} aria-hidden="true" />
        </div>
      </div>
      {model}
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
