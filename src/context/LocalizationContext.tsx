import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { Language } from '../types';

type Translations = Record<string, string>;

interface LocalizationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ko'); // Default to Korean
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        setIsLoaded(false);
        
        // @ts-ignore - Vite specific env variable
        const isViteEnv = typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env.MODE;
        
        // Vercel/Vite serves the `public` dir at the root ('/').
        // AI Studio serves the project file structure as-is, so we need to include `public` in the path.
        const path = isViteEnv
            ? `/locales/${language}.json`
            : `/public/locales/${language}.json`;

        const response = await fetch(path);
        if (!response.ok) {
            console.error(`Failed to load translations for ${language} from ${path}. Status: ${response.status}`);
            throw new Error(`Failed to load translations for ${language}`);
        }
        const data: Translations = await response.json();
        setTranslations(data);
      } catch (error) {
        console.error("Translation loading error:", error);
        // Fallback to an empty object so the app can still render something
        setTranslations({});
      } finally {
        setIsLoaded(true);
      }
    };

    fetchTranslations();
  }, [language]);

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    let translation = translations[key] || key;
    if (replacements) {
      Object.keys(replacements).forEach(rKey => {
        translation = translation.replace(new RegExp(`{{${rKey}}}`, 'g'), String(replacements[rKey]));
      });
    }
    return translation;
  }, [translations]);
  
  const value = { language, setLanguage, t };

  // Render children only after the initial translations have been loaded
  return (
    <LocalizationContext.Provider value={value}>
      {isLoaded ? children : null}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};