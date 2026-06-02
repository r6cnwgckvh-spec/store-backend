import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const lightColors = {
  background: '#f5f5f5',
  card: '#fff',
  text: '#1a1a2e',
  textSecondary: '#333',
  textMuted: '#666',
  textLight: '#999',
  border: '#e0e0e0',
  primary: '#007bff',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  headerBg: '#1a1a2e',
  headerText: '#fff',
  tabBarBg: '#fff',
  tabBarBorder: '#e0e0e0',
  inputBg: '#fff',
  placeholder: '#999',
  overlay: 'rgba(0,0,0,0.5)',
  watermark: '#ccc',
  statsCard: '#fff',
};

export const darkColors = {
  background: '#121212',
  card: '#1e1e1e',
  text: '#e0e0e0',
  textSecondary: '#ccc',
  textMuted: '#999',
  textLight: '#777',
  border: '#333',
  primary: '#4dabf7',
  success: '#51cf66',
  warning: '#fcc419',
  danger: '#ff6b6b',
  headerBg: '#0d0d0d',
  headerText: '#e0e0e0',
  tabBarBg: '#1a1a1a',
  tabBarBorder: '#333',
  inputBg: '#2a2a2a',
  placeholder: '#666',
  overlay: 'rgba(0,0,0,0.7)',
  watermark: '#555',
  statsCard: '#1e1e1e',
};

const ThemeContext = createContext(null);

const THEME_KEY = 'store_theme';

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState(null); // null = system, 'light', 'dark'
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(THEME_KEY);
        if (stored === 'light' || stored === 'dark') setMode(stored);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const resolved = mode || systemScheme || 'light';

  const toggleTheme = async () => {
    const next = resolved === 'light' ? 'dark' : 'light';
    setMode(next);
    await SecureStore.setItemAsync(THEME_KEY, next).catch(() => {});
  };

  const setThemeMode = async (m) => {
    setMode(m);
    if (m) await SecureStore.setItemAsync(THEME_KEY, m).catch(() => {});
    else await SecureStore.deleteItemAsync(THEME_KEY).catch(() => {});
  };

  const colors = resolved === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, resolved, colors, isDark: resolved === 'dark', toggleTheme, setThemeMode, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
