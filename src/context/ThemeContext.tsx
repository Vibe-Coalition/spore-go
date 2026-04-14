import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, getTheme, DEFAULT_THEME } from '../themes';

interface ThemeContextType {
  theme: Theme;
  themeName: string;
  setThemeName: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: getTheme(DEFAULT_THEME),
  themeName: DEFAULT_THEME,
  setThemeName: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState(DEFAULT_THEME);
  const theme = getTheme(themeName);

  useEffect(() => {
    AsyncStorage.getItem('acorn_theme').then(saved => {
      if (saved) setThemeNameState(saved);
    }).catch(() => {});
  }, []);

  const setThemeName = (name: string) => {
    setThemeNameState(name);
    AsyncStorage.setItem('acorn_theme', name).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}
