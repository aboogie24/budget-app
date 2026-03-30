import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, getTheme } from './theme';

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  themeValues: ReturnType<typeof getTheme>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemTheme = useColorScheme() as Theme | null;
  const [theme, setThemeState] = useState<Theme>('dark');
  const [loading, setLoading] = useState(true);

  // Load theme preference from storage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('coupleflow_theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeState(savedTheme);
        } else if (systemTheme) {
          setThemeState(systemTheme);
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [systemTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    AsyncStorage.setItem('coupleflow_theme', newTheme).catch((error) => {
      console.warn('Failed to save theme preference:', error);
    });
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  if (loading) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        themeValues: getTheme(theme),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
