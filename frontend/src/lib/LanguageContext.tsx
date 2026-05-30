import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { storage } from './storage';
import { t as translate } from './i18n';
import type { Language } from '../types';

interface I18nContextValue {
  lang: Language;
  ready: boolean;
  setLang: (lang: Language) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'zh',
  ready: false,
  setLang: async () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('zh');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.getSettings().then((s) => {
      setLangState(s.language);
      setReady(true);
    });
  }, []);

  const setLang = async (next: Language) => {
    setLangState(next);
    await storage.setSettings({ language: next });
    // 让 AI 画像/推荐理由、书库语言也跟着切：同步到 profile.language。
    // profileSignature 里包含 language，今日好书页 focus 时会据此自动重拉英文推荐。
    const profile = await storage.getUserProfile();
    if (profile && profile.language !== next) {
      await storage.setUserProfile({ ...profile, language: next });
    }
  };

  const t = (key: string, vars?: Record<string, string | number>) => translate(key, lang, vars);

  return (
    <I18nContext.Provider value={{ lang, ready, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
