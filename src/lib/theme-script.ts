export const THEME_STORAGE_KEY = "tradelinked-theme";

/**
 * Runs inline in <head> before first paint so the saved (or system) theme is
 * applied without a flash of the wrong one. Falls back to dark.
 * Kept separate from theme.ts so the server layout can import it.
 */
export const themeInitScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}d.dataset.theme=t}catch(e){d.dataset.theme="dark"}})();`;
