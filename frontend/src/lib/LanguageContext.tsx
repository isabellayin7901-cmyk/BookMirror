import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { storage } from './storage';
import { t as translate } from './i18n';
import { systemLanguage } from './locale';
import type { Language, UiLanguageMode } from '../types';

interface I18nContextValue {
  /** 当前生效的界面语言 */
  lang: Language;
  /** 界面语言模式：跟随系统 / 手动指定 */
  mode: UiLanguageMode;
  ready: boolean;
  /** 手动指定界面语言 */
  setLang: (lang: Language) => Promise<void>;
  /** 切换模式：'system' 跟随手机系统，或 'zh' / 'en' 手动指定 */
  setMode: (mode: UiLanguageMode) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'zh',
  mode: 'system',
  ready: false,
  setLang: async () => {},
  setMode: async () => {},
  t: (k) => k,
});

// 让 AI 画像/推荐理由、书库语言也跟着切：同步到 profile.language。
// profileSignature 里包含 language，今日好书页 focus 时会据此自动重拉英文推荐。
async function syncProfileLanguage(next: Language) {
  const profile = await storage.getUserProfile();
  if (profile && profile.language !== next) {
    await storage.setUserProfile({ ...profile, language: next });
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('zh');
  const [mode, setModeState] = useState<UiLanguageMode>('system');
  const [ready, setReady] = useState(false);

  /** 应用某个模式：解析出实际语言，写回设置并同步档案 */
  const apply = useCallback(async (nextMode: UiLanguageMode) => {
    const next: Language = nextMode === 'system' ? systemLanguage() : nextMode;
    setModeState(nextMode);
    setLangState(next);
    await storage.patchSettings({ language: next, uiLanguageMode: nextMode });
    await syncProfileLanguage(next);
  }, []);

  useEffect(() => {
    storage.getSettings().then(async (s) => {
      // 老用户首次启动时手动选过语言（没有 uiLanguageMode 字段）→ 保留他们的选择
      const m: UiLanguageMode = s.uiLanguageMode ?? s.language;
      if (m === 'system') {
        await apply('system');
      } else {
        setModeState(m);
        setLangState(m);
      }
      setReady(true);
    });
  }, [apply]);

  // 跟随系统时：从后台回来重新读一次系统语言（用户可能刚在系统设置里改过）
  useEffect(() => {
    if (mode !== 'system') return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && systemLanguage() !== lang) apply('system');
    });
    return () => sub.remove();
  }, [mode, lang, apply]);

  const setMode = (m: UiLanguageMode) => apply(m);
  const setLang = (next: Language) => apply(next);

  const t = (key: string, vars?: Record<string, string | number>) => translate(key, lang, vars);

  return (
    <I18nContext.Provider value={{ lang, mode, ready, setLang, setMode, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
