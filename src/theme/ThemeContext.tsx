// Tema claro/oscuro. El oscuro es el predeterminado; la elección se recuerda en este navegador.
// Los colores viven en CSS (styles/theme.css): aquí solo se marca <html data-theme="...">.
import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

export type Theme = "dark" | "light";
export const THEME_KEY = "edumaster.theme";     // el mismo que lee index.html antes de pintar

export function readTheme(): Theme {
  try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}

interface ThemeValue { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }
const Ctx = createContext<ThemeValue | null>(null);

export function useTheme(): ThemeValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useTheme requiere <ThemeProvider>");
  return value;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;     // controles nativos (listas, barras) en el mismo tono
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* sin almacenamiento: dura lo que la pestaña */ }
  }, [theme]);

  useEffect(() => {                                          // mantiene iguales varias pestañas abiertas
    const sync = (e: StorageEvent) => { if (e.key === THEME_KEY) setTheme(readTheme()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return <Ctx.Provider value={{ theme, setTheme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>{children}</Ctx.Provider>;
}
