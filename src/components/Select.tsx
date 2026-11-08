"use client";

import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Opt = { value: string; label: string; disabled: boolean };

type Props = {
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
};

// The `<option>`s inside, read the way a native select reads them: the value is the `value`, or the text when there isn't one.
function optionsOf(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  const walk = (nodes: React.ReactNode) => {
    Children.forEach(nodes, (n) => {
      if (!isValidElement(n)) return;
      const p = n.props as { value?: string | number; disabled?: boolean; children?: React.ReactNode };
      if (n.type === "option") {
        const text = Children.toArray(p.children).filter((x) => typeof x === "string" || typeof x === "number").join("");
        out.push({ value: p.value !== undefined ? String(p.value) : text, label: text, disabled: !!p.disabled });
      } else if (p.children) walk(p.children);
    });
  };
  walk(children);
  return out;
}

/**
 * A drop-down in Collex's own style, in place of the browser's: same props as a native select (`value`, `onChange`, `name`,
 * `<option>` children), so it drops in. It opens a list under the button, moves with the arrow keys, picks with Enter or a click,
 * jumps to a letter you type, and closes on Escape or a click elsewhere.
 */
export default function Select({ value, defaultValue, onChange, children, id, name, className = "", disabled, ...aria }: Props) {
  const opts = optionsOf(children);
  const [inner, setInner] = useState(defaultValue ?? opts[0]?.value ?? "");
  const current = value ?? inner;
  const at = Math.max(0, opts.findIndex((o) => o.value === current));
  const shown = opts[at];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(at);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; max: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  // The highlighted row is only scrolled into view when the keyboard moved it, so a wheel scrolling the list under the pointer isn't pulled back.
  const viaKey = useRef(false);
  const listId = useId();

  const place = () => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const below = innerHeight - b.bottom - 12;
    const above = b.top - 12;
    const up = below < 200 && above > below;
    const max = Math.max(140, Math.min(340, up ? above : below));
    setPos({ left: b.left, width: b.width, max, ...(up ? { bottom: innerHeight - b.top + 6 } : { top: b.bottom + 6 }) });
  };

  const pick = (o: Opt) => {
    if (o.disabled) return;
    setInner(o.value);
    setOpen(false);
    if (o.value !== current) onChange?.({ target: { value: o.value, name }, currentTarget: { value: o.value, name } } as unknown as React.ChangeEvent<HTMLSelectElement>);
    btn.current?.focus();
  };

  useLayoutEffect(() => { if (open) { viaKey.current = true; place(); setActive(at); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { const t = e.target as Node; if (!menu.current?.contains(t) && !btn.current?.contains(t)) setOpen(false); };
    const move = (e?: Event) => { if (e?.target instanceof Node && menu.current?.contains(e.target)) return; place(); }; // the list scrolling inside itself is not the page moving
    // While the list is open the page stays put: a wheel over the list scrolls the list, a wheel anywhere else does nothing.
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = menu.current;
      if (m && e.target instanceof Node && m.contains(e.target)) m.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    };
    document.addEventListener("wheel", wheel, { passive: false });
    document.addEventListener("pointerdown", away);
    window.addEventListener("resize", move);
    window.addEventListener("scroll", move, true);
    return () => { document.removeEventListener("wheel", wheel); document.removeEventListener("pointerdown", away); window.removeEventListener("resize", move); window.removeEventListener("scroll", move, true); };
  }, [open]);
  // The highlighted row stays in view as the arrow keys move it.
  useEffect(() => { if (open && viaKey.current) menu.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [open, active]);

  const step = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < opts.length; i += by) if (!opts[i].disabled) return i;
    return from;
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      viaKey.current = true;
      if (!open) { setOpen(true); return; }
      setActive((a) => step(a, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Home" || e.key === "End") {
      if (!open) return;
      e.preventDefault();
      viaKey.current = true;
      setActive(e.key === "Home" ? step(-1, 1) : step(opts.length, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open && opts[active]) pick(opts[active]); else setOpen(true);
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Typing a letter jumps to the next option that starts with it.
      const t = typed.current;
      const now = Date.now();
      t.text = now - t.at < 700 ? t.text + e.key.toLowerCase() : e.key.toLowerCase();
      t.at = now;
      const from = open ? active : at;
      const hit = [...opts.keys()].map((i) => (i + from + (t.text.length === 1 ? 1 : 0)) % opts.length).find((i) => !opts[i].disabled && opts[i].label.toLowerCase().startsWith(t.text));
      if (hit !== undefined) { if (open) { viaKey.current = true; setActive(hit); } else pick(opts[hit]); }
    }
  };

  return (
    <>
      <button ref={btn} type="button" id={id} className={`control selectBtn ${className}`} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined} disabled={disabled} data-empty={current === "" || undefined}
        onClick={() => setOpen((o) => !o)} onKeyDown={onKey} {...aria}>
        <span className="selectText">{shown?.label ?? ""}</span>
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      {open && pos && createPortal(
        <ul ref={menu} id={listId} role="listbox" className="selectMenu" aria-label={aria["aria-label"]}
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.max }}>
          {opts.map((o, i) => (
            <li key={`${o.value}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === at} aria-disabled={o.disabled || undefined} data-active={i === active || undefined}
              className="selectOpt" onMouseEnter={() => { if (!o.disabled) { viaKey.current = false; setActive(i); } }} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
              <span>{o.label}</span>
              {i === at && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" /></svg>}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
