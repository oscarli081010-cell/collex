"use client";

import { useEffect, useRef, useState } from "react";
import s from "./CoverFrame.module.css";

// The page's cover is wide (about 3 to 1 on a laptop); the lists show a square. Both are cropped from the photo
// around the same point, saved as two percentages like CSS object-position, so the framing chosen here is the
// framing everywhere.
const PAGE = 3;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** The whole photo with the part the conference page keeps lit and the rest dimmed. Drag the frame, or click
 *  where it should be, or use the arrow keys, to choose what shows. Live previews of the page and the lists below. */
export default function CoverFrame({ src, x, y, onChange }: { src: string; x: number; y: number; onChange: (x: number, y: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const img = useRef<HTMLImageElement>(null);
  // A photo already in the browser's cache can finish loading before React is listening, so check on every new src too.
  useEffect(() => {
    const el = img.current;
    setNat(el?.complete && el.naturalWidth ? { w: el.naturalWidth, h: el.naturalHeight } : null);
  }, [src]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [nat]);

  // The lit frame inside the shown photo, in pixels. Only the longer side of the photo has room to move.
  const W = size?.w ?? 0, H = size?.h ?? 0;
  const wide = W / Math.max(H, 1) > PAGE;
  const fw = wide ? H * PAGE : W, fh = wide ? H : W / PAGE;
  const roomX = W - fw, roomY = H - fh;
  const left = (roomX * x) / 100, top = (roomY * y) / 100;
  const moves = wide ? roomX > 1 : roomY > 1;

  const move = (nx: number, ny: number) => onChange(wide ? clamp(nx) : x, wide ? y : clamp(ny));
  const onDown = (e: React.PointerEvent) => {
    if (!nat || !moves || e.button !== 0) return;
    e.preventDefault();
    const r = box.current!.getBoundingClientRect();
    const inFrame = e.clientX - r.left >= left && e.clientX - r.left <= left + fw && e.clientY - r.top >= top && e.clientY - r.top <= top + fh;
    // A press outside the frame first centres it there, then the drag carries on from that point.
    let sx = x, sy = y;
    if (!inFrame) {
      sx = roomX ? clamp(((e.clientX - r.left - fw / 2) / roomX) * 100) : x;
      sy = roomY ? clamp(((e.clientY - r.top - fh / 2) / roomY) * 100) : y;
      move(sx, sy);
    }
    drag.current = { px: e.clientX, py: e.clientY, x: sx, y: sy };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    move(roomX ? d.x + ((e.clientX - d.px) / roomX) * 100 : x, roomY ? d.y + ((e.clientY - d.py) / roomY) * 100 : y);
  };
  const onUp = () => { drag.current = null; setDragging(false); };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const k = e.key;
    if (wide && (k === "ArrowLeft" || k === "ArrowRight")) { e.preventDefault(); move(x + (k === "ArrowLeft" ? -step : step), y); }
    else if (!wide && (k === "ArrowUp" || k === "ArrowDown")) { e.preventDefault(); move(x, y + (k === "ArrowUp" ? -step : step)); }
    else if (k === "Home") { e.preventDefault(); move(0, 0); }
    else if (k === "End") { e.preventDefault(); move(100, 100); }
  };
  const pos = `${x}% ${y}%`;
  const at = wide ? x : y;
  const where = wide ? (at < 34 ? "left" : at > 66 ? "right" : "middle") : (at < 34 ? "top" : at > 66 ? "bottom" : "middle");

  return (
    <div className={s.wrap}>
      <div
        ref={box}
        className={s.stage}
        data-moves={(nat && moves) || undefined}
        data-loading={!nat || undefined}
        data-dragging={dragging || undefined}
        style={nat ? { aspectRatio: `${nat.w} / ${nat.h}`, width: `min(100%, ${Math.round((340 * nat.w) / nat.h)}px)` } : undefined}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file */}
        <img ref={img} src={src} alt="" draggable={false} onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        {size && nat && (
          <div
            className={s.frame}
            style={{ left, top, width: fw, height: fh }}
            role="slider"
            tabIndex={moves ? 0 : -1}
            aria-label="Cover photo position"
            aria-orientation={wide ? "horizontal" : "vertical"}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={at}
            aria-valuetext={moves ? `${where} of the photo` : "The whole photo shows"}
            onKeyDown={onKey}
          >
            {moves && (
              <span className={s.grip} aria-hidden="true">
                {wide
                  ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" /></svg>
                  : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 5.5L8 2l3.5 3.5M4.5 10.5L8 14l3.5-3.5" /></svg>}
                Drag
              </span>
            )}
          </div>
        )}
      </div>
      <div className={s.previews}>
        <figure className={s.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element -- preview */}
          <span className={s.pageShot}><img src={src} alt="" style={{ objectPosition: pos }} /></span>
          <figcaption>On its page</figcaption>
        </figure>
        <figure className={s.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element -- preview */}
          <span className={s.listShot}><img src={src} alt="" style={{ objectPosition: pos }} /></span>
          <figcaption>In the lists</figcaption>
        </figure>
        <button type="button" className={`button secondary ${s.centre}`} disabled={x === 50 && y === 50} onClick={() => onChange(50, 50)}>Centre</button>
      </div>
    </div>
  );
}
