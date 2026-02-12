import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { translations, type Language, type TranslationKey } from './translations';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  dir: 'ltr' | 'rtl';
  formatCurrency: (amount: number) => string;
  formatNumber: (num: number) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'lang';

const langToLocale: Record<Language, string> = {
  de: 'de-DE',
  en: 'en-US',
  ar: 'ar-SA',
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['de', 'en', 'ar'].includes(stored)) return stored as Language;
    return 'de';
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  }, []);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key: TranslationKey): string => {
    return translations[lang][key] ?? key;
  }, [lang]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat(langToLocale[lang], {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  }, [lang]);

  const formatNumber = useCallback((num: number) => {
    return new Intl.NumberFormat(langToLocale[lang]).format(num);
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir, formatCurrency, formatNumber }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};

export const useDirection = () => {
  const { dir } = useI18n();
  return dir;
};
