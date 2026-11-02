export type Theme = "light" | "dark" | "system";
export const THEMES: Theme[] = ["light", "dark", "system"];
const KEY = "collex-theme";

/** Runs in <head> before first paint so a dark-mode account never flashes light. */
export const themeBootScript = `try{var t=localStorage.getItem("${KEY}");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

/** Applies a theme with a short colour cross-fade, and remembers it on this device. */
export function applyTheme(theme: Theme, animate = true) {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (animate && !reduce) {
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 320);
  }
  root.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch {}
}
