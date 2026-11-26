export type Theme = "light" | "dark" | "system";
// Light is where everyone starts, whatever the device is set to. Dark, or following the device (System), is a choice
// made in Account.
export const THEMES: Theme[] = ["light", "dark", "system"];
const KEY = "collex-theme";

/** Runs in <head> before first paint so a dark-mode account never flashes light. */
export const themeBootScript = `try{var t=localStorage.getItem("${KEY}");if(t==="dark"||t==="system")document.documentElement.dataset.theme=t}catch(e){}`;

/**
 * Applies a theme and remembers it on this device. The change is a cross-fade of the whole page (a view transition),
 * not a colour transition on every element: that one fought the components' own transitions, so the sliding switches
 * flashed. A browser without view transitions just switches at once.
 */
export function applyTheme(choice: Theme, animate = true) {
  const theme: Theme = THEMES.includes(choice) ? choice : "light";
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  const swap = () => {
    root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch {}
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (animate && !reduce && "startViewTransition" in document) {
    (document as Document & { startViewTransition: (cb: () => void) => unknown }).startViewTransition(swap);
  } else swap();
}
