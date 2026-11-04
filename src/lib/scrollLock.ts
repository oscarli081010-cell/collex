// While a dialog is open the page behind stays put: native scrolling and Lenis's smooth scrolling both stop.
export function lockScroll(on: boolean) {
  const lenis = (window as unknown as { __lenis?: { stop(): void; start(): void } }).__lenis;
  document.documentElement.style.overflow = on ? "hidden" : "";
  document.body.style.overflow = on ? "hidden" : "";
  if (on) lenis?.stop(); else lenis?.start();
}
