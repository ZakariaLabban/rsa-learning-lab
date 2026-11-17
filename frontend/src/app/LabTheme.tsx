import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const LabTheme = createContext<{ theme: Theme; setTheme: (value: Theme) => void } | null>(null);
export function LabThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('rsa-lab-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* Optional storage. */
    }
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('rsa-lab-theme', theme);
    } catch {
      /* Theme still works in memory. */
    }
  }, [theme]);
  return <LabTheme.Provider value={{ theme, setTheme }}>{children}</LabTheme.Provider>;
}
export function useLabTheme() {
  const context = useContext(LabTheme);
  if (!context) throw new Error('LabThemeProvider is required.');
  return context;
}
