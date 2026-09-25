import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, ScrollView,
  TextInput, Image, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { storage, type ReaderSettings } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import {
  fetchReaderProgress, saveReaderProgress, fetchChapterDiscussion,
  fetchParagraphComments, addParagraphComment, likeParagraphComment, deleteParagraphComment,
  type ReaderChapter, type ReaderToc, type ParagraphComment,
} from '../lib/api';
import { loadReaderBook, loadChapter as loadSourceChapter, pickEdition, type ReaderBookInfo } from '../lib/readerSource';
import { pickAndUploadBook, PickCancelled, uploadErrorText } from '../lib/privateShelf';
import { systemLanguage } from '../lib/locale';
import { QuoteSheet, DiscussionSheet, NotesSheet, ExplainSheet, EditionPicker } from '../components/ReaderPanels';
import type { BookEdition, RootStackParamList } from '../types';

// WebView 是原生模块；旧构建（OTA 拿不到）会 require 失败，这里优雅降级提示更新。
let WebViewComp: any = null;
try { WebViewComp = require('react-native-webview').WebView; } catch { /* old build */ }

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'Reader'>;

const THEMES: Record<ReaderSettings['theme'], { bg: string; fg: string; sub: string }> = {
  paper: { bg: '#F3EAD8', fg: '#3B3327', sub: '#9C8E76' },
  green: { bg: '#D6E6D4', fg: '#2F3B2C', sub: '#7A8B72' },
  dark: { bg: '#16161A', fg: '#C7C0B4', sub: '#6A655C' },
  white: { bg: '#FFFFFF', fg: '#2B2B2B', sub: '#A8A29A' },
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 滚动模式下章末的「上一章 / 下一章」按钮文案 */
interface NavLabels { prev: string; next: string }

function chapterBody(ch: ReaderChapter, nav: NavLabels): string {
  const ps = ch.paras.map((p) => {
    const badge = p.comments > 0 ? `<span class="cmt" data-i="${p.i}">${p.comments}</span>` : '';
    return `<p data-i="${p.i}">${esc(p.text).replace(/\n/g, '<br>')}${badge}</p>`;
  }).join('');
  // 只在滚动模式显示（翻页模式靠左右翻到章首 / 章末自动切章）
  const prev = ch.index > 0 ? `<a data-nav="prev">${esc(nav.prev)}</a>` : '<span></span>';
  const next = ch.index < ch.total - 1 ? `<a data-nav="next">${esc(nav.next)}</a>` : '<span></span>';
  return `<h2>${esc(ch.title)}</h2>${ps}<div class="chnav">${prev}${next}</div>`;
}

// 翻页模式：CSS 多栏把整章排成横向的一页页，#book 是横向滚动容器，翻页 = 设置 scrollLeft。
// （不再用 transform 平移整条内容：长章节会是几万像素宽的单个图层，真机 iOS 超出图层上限会整块空白；
//   滚动容器只绘制可见区域。）
// 滚动模式：取消分栏，整章上下滚动，由 WebView 自身滚动。
const SHELL = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root{ --fs:19px; --lh:1.85; --fg:#3B3327; --bg:#F3EAD8; --sub:#9C8E76; --mg:22px; --ff:-apple-system,system-ui,"PingFang SC","Noto Sans CJK SC",sans-serif; }
  html,body{margin:0;padding:0;height:100%;overflow:hidden;background:var(--bg);}
  #book{
    height:100vh; box-sizing:border-box; overflow:hidden;
    padding:calc(var(--mg) + 8px + var(--st,0px)) var(--mg) calc(var(--mg) + var(--sb,0px));
    column-width:calc(100vw - 2*var(--mg)); column-gap:calc(2*var(--mg)); column-fill:auto;
    font-size:var(--fs); line-height:var(--lh); color:var(--fg); font-family:var(--ff);
    -webkit-user-select:text; user-select:text; -webkit-touch-callout:default;
  }
  html.scroll, html.scroll body{height:auto; overflow:visible;}
  /* 滚动模式：状态栏 / 灵动岛区域用背景色盖住，文字滚上去不会和状态栏叠在一起 */
  html.scroll body::before{content:'';position:fixed;top:0;left:0;right:0;height:var(--st,0px);background:var(--bg);z-index:2;}
  html.scroll #book{height:auto; overflow:visible; columns:auto; column-width:auto;
    padding-bottom:calc(var(--mg) + var(--sb,0px) + 24px);}
  ::selection{ background:rgba(201,123,99,.28); }
  h2{font-size:1.15em;margin:0 0 1em;color:var(--fg);font-weight:700;}
  p{margin:0 0 .85em;text-align:justify;text-indent:2em;-webkit-hyphens:auto;}
  .cmt{display:inline-block;margin-inline-start:6px;font-size:.62em;color:#fff;background:#C97B63;
       border-radius:9px;padding:0 6px;vertical-align:middle;line-height:1.6;text-indent:0;
       -webkit-user-select:none;user-select:none;}
  .chnav{display:none;}
  html.scroll .chnav{display:flex;justify-content:space-between;margin:2em 0 .5em;}
  .chnav a{color:var(--sub);border:1px solid var(--sub);border-radius:999px;padding:.35em 1.1em;font-size:.8em;
           -webkit-user-select:none;user-select:none;}
</style></head><body><div id="book"></div>
<script>
(function(){
  var root=document.documentElement, book=document.getElementById('book');
  var cur=0,pages=1,pw=window.innerWidth,mode='paged';
  function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  function recalc(){ pw=window.innerWidth; pages=mode==='scroll'?1:Math.max(1,Math.round(book.scrollWidth/pw)); }
  function paras(){ return book.querySelectorAll('p[data-i]'); }
  function idx(el){ return parseInt(el.getAttribute('data-i'),10)||0; }
  function topInset(){ return parseFloat(getComputedStyle(root).getPropertyValue('--st'))||0; }
  // 当前屏幕上第一段（阅读进度锚点，和字号无关）
  function topPara(){ var ps=paras(),k;
    if(mode==='scroll'){ var t=topInset(); for(k=0;k<ps.length;k++){ if(ps[k].getBoundingClientRect().bottom>t+4) return idx(ps[k]); } return 0; }
    var at=ps.length?idx(ps[0]):0; for(k=0;k<ps.length;k++){ if(Math.floor((ps[k].offsetLeft+2)/pw)<=cur) at=idx(ps[k]); else break; } return at; }
  function pct(){ var h=root.scrollHeight-window.innerHeight; return h>0?Math.min(100,Math.round(window.scrollY/h*100)):100; }
  function report(){ if(mode==='scroll') post({type:'page',page:pct(),pages:100,topPara:topPara()}); else post({type:'page',page:cur,pages:pages,topPara:topPara()}); }
  function go(p,smooth){ cur=Math.max(0,Math.min(pages-1,p));
    if(smooth&&book.scrollTo) book.scrollTo({left:cur*pw,behavior:'smooth'}); else book.scrollLeft=cur*pw;
    report(); }
  function toPara(i){ var el=book.querySelector('p[data-i="'+i+'"]'); if(!el) return false;
    if(mode==='scroll'){ var first=paras()[0]===el;
      window.scrollTo(0,first?0:Math.max(0,el.getBoundingClientRect().top+window.scrollY-topInset()-8)); report(); }
    else go(Math.floor((el.offsetLeft+2)/pw));
    return true; }
  // 重新排版（改字号 / 行距 / 边距 / 翻页方式）后回到原来读到的那一段
  function relayout(apply){ var anchor=topPara(); apply(); setTimeout(function(){ recalc(); if(!toPara(anchor)) go(Math.min(cur,pages-1)); },30); }
  window.reader={
    setBody:function(html,toPage){ book.innerHTML=html; recalc();
      if(mode==='scroll'){ if(toPage==='last') window.scrollTo(0,root.scrollHeight); else if(toPage!=='keep') window.scrollTo(0,0); report(); }
      else if(toPage==='last'){go(pages-1);} else if(toPage==='keep'){go(Math.min(cur,pages-1));} else {go(toPage||0);} },
    setVars:function(v){ relayout(function(){ var r=root.style; for(var k in v){ r.setProperty(k,v[k]); } }); },
    setMode:function(m){ if(m===mode) return; relayout(function(){ mode=m; root.classList.toggle('scroll',m==='scroll'); }); },
    toParagraph:function(i){ recalc(); toPara(i); },
    next:function(){ if(cur>=pages-1) post({type:'atEnd'}); else go(cur+1,true); },
    prev:function(){ if(cur<=0) post({type:'atStart'}); else go(cur-1,true); },
    clearSel:function(){ var s=window.getSelection(); if(s) s.removeAllRanges(); }
  };
  // 划选：把选中的文字和所在段落报给 RN（段落用于定位好句、给 AI 提供上下文）
  function selInfo(){ var s=window.getSelection(); var txt=s?String(s).trim():''; var p=-1;
    if(txt&&s.rangeCount){ var n=s.getRangeAt(0).startContainer; var el=n.nodeType===1?n:n.parentElement; var pe=el&&el.closest&&el.closest('p[data-i]'); if(pe) p=idx(pe); }
    return {text:txt,paragraph:p}; }
  function hasSel(){ var s=window.getSelection(); return !!(s&&String(s).trim()); }
  var selTimer=null;
  document.addEventListener('selectionchange',function(){ clearTimeout(selTimer); selTimer=setTimeout(function(){ var i=selInfo(); post({type:'sel',text:i.text.slice(0,2000),paragraph:i.paragraph}); },120); });
  var scrollTimer=null;
  window.addEventListener('scroll',function(){ if(mode!=='scroll') return; clearTimeout(scrollTimer); scrollTimer=setTimeout(report,200); },{passive:true});
  var moved=false,sx=0,sy=0,t0=0,hadSel=false;
  document.addEventListener('touchstart',function(e){ moved=false; sx=e.touches[0].clientX; sy=e.touches[0].clientY; t0=Date.now(); hadSel=hasSel(); },{passive:true});
  document.addEventListener('touchmove',function(e){ if(Math.abs(e.touches[0].clientX-sx)>10||Math.abs(e.touches[0].clientY-sy)>10) moved=true; },{passive:true});
  document.addEventListener('touchend',function(e){
    // 长按是在划选文字；已有选区时的轻触是在取消选区——都不翻页、不开关工具栏
    if(hadSel||hasSel()||Date.now()-t0>400) return;
    var t=e.target;
    var nav=t.closest&&t.closest('[data-nav]'); if(nav&&!moved){ post({type:nav.getAttribute('data-nav')==='next'?'atEnd':'prevChapter'}); return; }
    var badge=t.closest&&t.closest('.cmt'); if(badge&&!moved){ post({type:'comment',paragraph:idx(badge)}); return; }
    if(mode==='scroll'){ if(!moved) post({type:'toggleBar'}); return; }
    if(moved){ var dx=e.changedTouches[0].clientX-sx; if(dx<-30) window.reader.next(); else if(dx>30) window.reader.prev(); return; }
    var x=e.changedTouches[0].clientX; if(x<pw*0.30) window.reader.prev(); else if(x>pw*0.70) window.reader.next(); else post({type:'toggleBar'});
  });
  window.addEventListener('resize',function(){ recalc(); if(mode!=='scroll') go(Math.min(cur,pages-1)); });
  recalc(); post({type:'shellReady'});
})();
</script></body></html>`;

export function ReaderScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { t, lang } = useI18n();
  const { bookId, title } = route.params;

  const webRef = useRef<any>(null);
  // 正文避开刘海 / 灵动岛 / 底部横条
  const insets = useSafeAreaInsets();
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  // 滚动模式章末按钮文案（跟随界面语言）
  const navRef = useRef<NavLabels>({ prev: '', next: '' });
  navRef.current = { prev: t('reader.prevChapter'), next: t('reader.nextChapter') };
  const [uid, setUid] = useState('');
  const [settings, setSettings] = useState<ReaderSettings | null>(null);
  const [toc, setToc] = useState<ReaderToc | null>(null);
  const [chapter, setChapter] = useState<ReaderChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [barVisible, setBarVisible] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageInfo, setPageInfo] = useState({ page: 0, pages: 1, topPara: 0 });

  const [commentPara, setCommentPara] = useState<number | null>(null);

  // 多版本：当前书的信息（示例/书库、可选版本、章节来源）与当前版本
  const [info, setInfo] = useState<ReaderBookInfo | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const editionRef = useRef<string | null>(null);
  const isDemoRef = useRef(false);
  // 划选：WebView 实时报来的选区（文字 + 所在段落）
  const lastSel = useRef<{ text: string; paragraph: number }>({ text: '', paragraph: -1 });
  const [quote, setQuote] = useState<{ text: string; paragraph: number } | null>(null);
  const [explain, setExplain] = useState<{ text: string; paragraph: number } | null>(null);
  const [discOpen, setDiscOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [edPickerOpen, setEdPickerOpen] = useState(false);

  const shellReady = useRef(false);
  const pendingInit = useRef<{ index: number; paragraph: number } | null>(null);
  // 初始化要等「WebView 壳就绪」和「数据加载完」两件事，先后顺序不固定。
  // 用 ref 读最新的设置、只初始化一次，避免拿到旧闭包里的 settings=null 而卡在「正在翻开」。
  const settingsRef = useRef<ReaderSettings | null>(null);
  // 读私人书要带上读者身份；loadChapter 里用 ref 读最新值
  const uidRef = useRef('');
  // 当前读到的段落（WebView 被系统回收后，重建时回到这里）
  const lastTopPara = useRef(0);
  // 换 key 让 WebView 整个重建（进程被回收后 reload 不一定救得回来）
  const [webKey, setWebKey] = useState(0);
  const initStarted = useRef(false);
  const chapterRef = useRef<ReaderChapter | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = THEMES[settings?.theme || 'paper'];

  // 初始化：uid + 设置 + toc + 进度
  useEffect(() => {
    (async () => {
      const id = await storage.getUserId();
      uidRef.current = id;
      setUid(id);
      const st = await storage.getReaderSettings();
      settingsRef.current = st;
      setSettings(st);
      // 版本：这本书上次选的 > 设置里的「阅读内容语言」> 原文
      const remembered = await storage.getReaderEdition(bookId);
      const [appSettings, prog, first] = await Promise.all([
        storage.getSettings(),
        fetchReaderProgress(id, bookId),
        loadReaderBook(bookId, remembered, id),
      ]);
      const ed = pickEdition(first?.info.editions ?? [], remembered, appSettings.contentLanguage ?? 'original');
      const loaded = ed && ed.id !== remembered ? await loadReaderBook(bookId, ed.id, id) : first;
      editionRef.current = ed?.id ?? null;
      setEditionId(ed?.id ?? null);
      isDemoRef.current = !!loaded?.info.isDemo;
      setInfo(loaded?.info ?? null);
      setToc(loaded?.toc ?? null);
      pendingInit.current = { index: prog.chapter_index || 0, paragraph: prog.paragraph || 0 };
      tryInitRef.current();
    })();
  }, [bookId]);

  const varsScript = useCallback((st: ReaderSettings) => {
    const th = THEMES[st.theme];
    const ff = st.fontFamily === 'serif'
      ? 'Georgia,"Songti SC","Noto Serif CJK SC",serif'
      : '-apple-system,system-ui,"PingFang SC","Noto Sans CJK SC",sans-serif';
    const { top, bottom } = insetsRef.current;
    const v = {
      '--fs': `${st.fontSize}px`, '--lh': `${st.lineHeight}`, '--mg': `${st.margin}px`, '--fg': th.fg, '--bg': th.bg, '--sub': th.sub, '--ff': ff,
      '--st': `${Math.round(top)}px`, '--sb': `${Math.round(bottom)}px`,
    };
    return `window.reader.setVars(${JSON.stringify(v)});true;`;
  }, []);

  const injectChapter = useCallback((ch: ReaderChapter, toPage: number | 'last') => {
    const body = chapterBody(ch, navRef.current);
    webRef.current?.injectJavaScript(`window.reader.setBody(${JSON.stringify(body)}, ${JSON.stringify(toPage)});true;`);
  }, []);

  const loadChapter = useCallback(async (index: number, toPage: number | 'last', toParagraph?: number) => {
    const ch = await loadSourceChapter(bookId, index, editionRef.current, uidRef.current);
    if (!ch) return;
    chapterRef.current = ch;
    setChapter(ch);
    injectChapter(ch, toPage);
    if (toParagraph && toParagraph > 0) {
      setTimeout(() => webRef.current?.injectJavaScript(`window.reader.toParagraph(${toParagraph});true;`), 120);
    }
    // 示例书正文在本地，段评角标按本章公开讨论里「同一版本」的条目另算（后台进行，不阻塞开书）
    if (isDemoRef.current) {
      const ed = editionRef.current;
      fetchChapterDiscussion(bookId, ch.index, '').then((list) => {
        if (!list || chapterRef.current !== ch) return;
        const counts: Record<number, number> = {};
        list.filter((c) => c.edition === ed && (c.paragraph ?? -1) >= 0).forEach((c) => { counts[c.paragraph!] = (counts[c.paragraph!] || 0) + 1; });
        if (!Object.keys(counts).length) return;
        const updated = { ...ch, paras: ch.paras.map((p) => ({ ...p, comments: counts[p.i] || 0 })) };
        chapterRef.current = updated;
        setChapter(updated);
        webRef.current?.injectJavaScript(`window.reader.setBody(${JSON.stringify(chapterBody(updated, navRef.current))}, 'keep');true;`);
      });
    }
  }, [bookId, injectChapter]);

  /** 壳就绪 + 数据就绪 + 设置就绪 三者齐了才初始化，且只做一次（与先后顺序无关） */
  const tryInit = useCallback(async () => {
    const st = settingsRef.current;
    if (initStarted.current || !shellReady.current || !pendingInit.current || !st) return;
    initStarted.current = true;
    webRef.current?.injectJavaScript(varsScript(st));
    webRef.current?.injectJavaScript(`window.reader.setMode(${JSON.stringify(st.pageMode || 'paged')});true;`);
    const init = pendingInit.current;
    await loadChapter(init.index, 0, init.paragraph);
    setLoading(false);
  }, [varsScript, loadChapter]);
  const tryInitRef = useRef(tryInit);
  tryInitRef.current = tryInit;

  const onMessage = useCallback((e: any) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'shellReady') {
      shellReady.current = true;
      tryInitRef.current();
      return;
    }
    if (msg.type === 'toggleBar') { setBarVisible((v) => !v); return; }
    if (msg.type === 'sel') { lastSel.current = { text: msg.text || '', paragraph: typeof msg.paragraph === 'number' ? msg.paragraph : -1 }; return; }
    if (msg.type === 'comment') { setCommentPara(msg.paragraph); return; }
    if (msg.type === 'page') {
      setPageInfo({ page: msg.page, pages: msg.pages, topPara: msg.topPara });
      lastTopPara.current = msg.topPara || 0;
      // 存进度（防抖）
      const ch = chapterRef.current;
      if (ch && uid) {
        const total = ch.total || 1;
        const percent = Math.round(((ch.index + (msg.pages > 1 ? msg.page / msg.pages : 0)) / total) * 100);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveReaderProgress(uid, bookId, ch.index, msg.topPara, percent);
        }, 900);
      }
      return;
    }
    if (msg.type === 'atEnd') {
      const ch = chapterRef.current;
      if (ch && ch.index < ch.total - 1) loadChapter(ch.index + 1, 0);
      return;
    }
    // 滚动模式章末「上一章」：回到上一章开头
    if (msg.type === 'prevChapter') {
      const ch = chapterRef.current;
      if (ch && ch.index > 0) loadChapter(ch.index - 1, 0);
      return;
    }
    if (msg.type === 'atStart') {
      const ch = chapterRef.current;
      if (ch && ch.index > 0) loadChapter(ch.index - 1, 'last');
      return;
    }
  }, [uid, bookId, loadChapter]);

  // 改设置 → 注入 + 存
  const updateSettings = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      settingsRef.current = next;
      storage.setReaderSettings(next);
      if (patch.pageMode) {
        webRef.current?.injectJavaScript(`window.reader.setMode(${JSON.stringify(patch.pageMode)});true;`);
      } else {
        webRef.current?.injectJavaScript(varsScript(next));
      }
      return next;
    });
  }, [varsScript]);

  const jumpChapter = (index: number) => {
    setTocOpen(false);
    setLoading(true);
    loadChapter(index, 0).then(() => setLoading(false));
  };

  const onCommentAdded = (paragraph: number) => {
    // 本地把该段评论数 +1，重渲染当前章保留页码
    const ch = chapterRef.current;
    if (!ch) return;
    const np = ch.paras.map((p) => (p.i === paragraph ? { ...p, comments: p.comments + 1 } : p));
    const updated = { ...ch, paras: np };
    chapterRef.current = updated;
    setChapter(updated);
    injectChapter(updated, pageInfo.page);
  };

  /** 选中的文字在本章第几段：优先用 WebView 报来的段落，对不上再按文字查找 */
  const findParagraph = (text: string, hint: number): number => {
    const ch = chapterRef.current;
    if (!ch) return -1;
    const head = text.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 20);
    const norm = (x: string) => x.replace(/\s+/g, ' ');
    if (hint >= 0 && ch.paras[hint] && norm(ch.paras[hint].text).includes(head)) return hint;
    const found = ch.paras.find((p) => norm(p.text).includes(head));
    return found ? found.i : hint;
  };

  /** 给 AI 的上下文：所在段落及前后各一段 */
  const contextFor = (paragraph: number): string => {
    const ch = chapterRef.current;
    if (!ch) return '';
    if (paragraph < 0) return ch.paras.map((p) => p.text).join('\n').slice(0, 3000);
    return ch.paras.slice(Math.max(0, paragraph - 1), paragraph + 2).map((p) => p.text).join('\n').slice(0, 3000);
  };

  /** 划选后的自定义菜单：分享好句 / AI 翻译与理解 */
  const onMenu = useCallback((e: any) => {
    const { key, selectedText } = e.nativeEvent || {};
    const text = String(selectedText || lastSel.current.text || '').trim();
    webRef.current?.injectJavaScript('window.reader.clearSel();true;');
    if (!text) return;
    const paragraph = findParagraph(text, lastSel.current.paragraph);
    if (key === 'quote') setQuote({ text, paragraph });
    else if (key === 'explain') setExplain({ text, paragraph });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentEdition: BookEdition | null = info?.editions.find((e) => e.id === editionId) ?? null;

  /** App 在后台时系统可能回收 WebView 的网页进程，切回来会空白 / 卡住：重建 WebView 并回到原来的位置 */
  const recoverWebView = useCallback(() => {
    shellReady.current = false;
    initStarted.current = false;
    pendingInit.current = { index: chapterRef.current?.index ?? 0, paragraph: lastTopPara.current };
    setLoading(true);
    setWebKey((k) => k + 1);
  }, []);

  /** 私人书：再上传一个语言版本（如同一本书的法文版 / 英文版） */
  const [addingEdition, setAddingEdition] = useState(false);
  const addEdition = async () => {
    if (addingEdition) return;
    setAddingEdition(true);
    try {
      await pickAndUploadBook(uidRef.current, bookId);
      const loaded = await loadReaderBook(bookId, editionRef.current, uidRef.current);
      if (loaded) setInfo(loaded.info);
    } catch (err) {
      if (!(err instanceof PickCancelled)) Alert.alert(t('shelf.uploadFailed'), uploadErrorText(err, t));
    } finally {
      setAddingEdition(false);
    }
  };

  /** 切换版本：章节按 index 对齐，停在同一章的开头 */
  const switchEdition = async (e: BookEdition) => {
    setEdPickerOpen(false);
    if (e.id === editionRef.current) return;
    editionRef.current = e.id;
    setEditionId(e.id);
    storage.setReaderEdition(bookId, e.id);
    const loaded = await loadReaderBook(bookId, e.id, uidRef.current);
    if (loaded) setToc(loaded.toc);
    setLoading(true);
    await loadChapter(chapterRef.current?.index ?? 0, 0);
    setLoading(false);
  };

  if (!WebViewComp) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: theme.bg }]} edges={['top']}>
        <Snowman size={60} pose="wave" />
        <Text style={[styles.loadingText, { color: theme.sub, marginTop: spacing.md }]}>{t('reader.needUpdate')}</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }}><Text style={{ color: colors.terracotta }}>‹ {t('reader.back')}</Text></Pressable>
      </SafeAreaView>
    );
  }

  if (!settings) {
    return <View style={[styles.fill, { backgroundColor: theme.bg }]}><ActivityIndicator color={colors.terracotta} /></View>;
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.bg }]}>
      <WebViewComp
        key={webKey}
        ref={webRef}
        onContentProcessDidTerminate={recoverWebView}
        onRenderProcessGone={recoverWebView}
        source={{ html: SHELL }}
        originWhitelist={['*']}
        onMessage={onMessage}
        // 左右翻页由页面内部处理；上下滚动模式交给 WebView 自身滚动
        scrollEnabled={settings.pageMode === 'scroll'}
        showsVerticalScrollIndicator={settings.pageMode === 'scroll'}
        style={{ backgroundColor: theme.bg }}
        // 外层 fill 是居中布局，WebView 没有固有宽度，不撑开会在 iOS 上变成 0 宽（空白）
        containerStyle={{ alignSelf: 'stretch' }}
        // 长按划选文字后的菜单（iOS / Android 原生选区菜单）
        menuItems={[
          { key: 'quote', label: t('reader.menuQuote') },
          { key: 'explain', label: t('reader.menuExplain') },
        ]}
        onCustomMenuSelection={onMenu}
        // 安卓上 injectedJavaScript 在每次 load 后跑；我们用 onMessage(shellReady) 触发初始化
      />

      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.bg }]}>
          <Snowman size={56} pose="wave" />
          <Text style={[styles.loadingText, { color: theme.sub }]}>{t('reader.loading')}</Text>
        </View>
      )}

      {/* 顶部栏 */}
      {barVisible && (
        <SafeAreaView edges={['top']} style={[styles.topBar, { backgroundColor: theme.bg, borderColor: theme.sub + '33' }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Text style={[styles.barIcon, { color: theme.fg }]}>‹</Text></Pressable>
          <View style={styles.barTitleWrap}>
            <Text style={[styles.barTitle, { color: theme.fg }]} numberOfLines={1}>{chapter?.title || title || ''}</Text>
            {info?.isDemo && <Text style={[styles.demoTag, { color: theme.sub }]}>{t('reader.demoTag')}</Text>}
          </View>
          {/* 多个版本时才显示版本切换 */}
          {info && (info.editions.length > 1 || info.isPrivate) && currentEdition ? (
            <Pressable onPress={() => setEdPickerOpen(true)} style={[styles.edPill, { borderColor: theme.sub }]} hitSlop={8}>
              <Text style={[styles.edPillText, { color: theme.fg }]}>
                {currentEdition.kind === 'original' ? t('edition.original')
                  : currentEdition.kind === 'uploaded' ? (lang === 'en' ? currentEdition.labelEn : currentEdition.label)
                  : t(`edition.lang.${currentEdition.lang}`)} ▾
              </Text>
            </Pressable>
          ) : <View style={{ width: 28 }} />}
        </SafeAreaView>
      )}

      {/* 底部栏 */}
      {barVisible && (
        <SafeAreaView edges={['bottom']} style={[styles.bottomBar, { backgroundColor: theme.bg, borderColor: theme.sub + '33' }]}>
          <Pressable style={styles.bottomBtn} onPress={() => setTocOpen(true)}>
            <Text style={[styles.bottomIcon, { color: theme.fg }]}>☰</Text>
            <Text style={[styles.bottomLabel, { color: theme.sub }]}>{t('reader.toc')}</Text>
          </Pressable>
          {/* 私人书只有自己能读，不开放公开的「好句与讨论」 */}
          {!info?.isPrivate && (
            <Pressable style={styles.bottomBtn} onPress={() => setDiscOpen(true)}>
              <Text style={[styles.bottomIcon, { color: theme.fg }]}>❝</Text>
              <Text style={[styles.bottomLabel, { color: theme.sub }]}>{t('reader.quotes')}</Text>
            </Pressable>
          )}
          <View style={styles.pageMeta}>
            <Text style={[styles.pageMetaText, { color: theme.sub }]}>
              {settings.pageMode === 'scroll' ? `${pageInfo.page}%` : `${pageInfo.page + 1}/${pageInfo.pages}`}
            </Text>
          </View>
          <Pressable style={styles.bottomBtn} onPress={() => setNotesOpen(true)}>
            <Text style={[styles.bottomIcon, { color: theme.fg }]}>✎</Text>
            <Text style={[styles.bottomLabel, { color: theme.sub }]}>{t('reader.notes')}</Text>
          </Pressable>
          <Pressable style={styles.bottomBtn} onPress={() => setSettingsOpen(true)}>
            <Text style={[styles.bottomIcon, { color: theme.fg }]}>Aa</Text>
            <Text style={[styles.bottomLabel, { color: theme.sub }]}>{t('reader.settings')}</Text>
          </Pressable>
        </SafeAreaView>
      )}

      {/* 目录 */}
      <Modal visible={tocOpen} animationType="slide" onRequestClose={() => setTocOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom']}>
          <View style={styles.tocHeader}>
            <Text style={[styles.tocTitle, { color: theme.fg }]}>{toc?.title || ''}</Text>
            <Pressable onPress={() => setTocOpen(false)} hitSlop={10}><Text style={[styles.barIcon, { color: theme.fg }]}>✕</Text></Pressable>
          </View>
          <ScrollView>
            {toc?.chapters.map((c) => (
              <Pressable key={c.index} style={[styles.tocRow, { borderColor: theme.sub + '22' }]} onPress={() => jumpChapter(c.index)}>
                <Text style={[styles.tocRowText, { color: c.index === chapter?.index ? colors.terracotta : theme.fg }]} numberOfLines={1}>{c.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 设置 */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.settingsBackdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={[styles.settingsCard, { backgroundColor: theme.bg }]} onPress={() => {}}>
            {/* 字号 */}
            <View style={styles.setRow}>
              <Text style={[styles.setLabel, { color: theme.fg }]}>{t('reader.fontSize')}</Text>
              <View style={styles.stepper}>
                <Pressable style={[styles.stepBtn, { borderColor: theme.sub }]} onPress={() => updateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}><Text style={[styles.stepTxt, { color: theme.fg }]}>A-</Text></Pressable>
                <Text style={[styles.stepVal, { color: theme.fg }]}>{settings.fontSize}</Text>
                <Pressable style={[styles.stepBtn, { borderColor: theme.sub }]} onPress={() => updateSettings({ fontSize: Math.min(30, settings.fontSize + 1) })}><Text style={[styles.stepTxt, { color: theme.fg }]}>A+</Text></Pressable>
              </View>
            </View>
            {/* 行距 */}
            <View style={styles.setRow}>
              <Text style={[styles.setLabel, { color: theme.fg }]}>{t('reader.lineHeight')}</Text>
              <View style={styles.stepper}>
                <Pressable style={[styles.stepBtn, { borderColor: theme.sub }]} onPress={() => updateSettings({ lineHeight: Math.max(1.3, Math.round((settings.lineHeight - 0.1) * 10) / 10) })}><Text style={[styles.stepTxt, { color: theme.fg }]}>−</Text></Pressable>
                <Text style={[styles.stepVal, { color: theme.fg }]}>{settings.lineHeight.toFixed(1)}</Text>
                <Pressable style={[styles.stepBtn, { borderColor: theme.sub }]} onPress={() => updateSettings({ lineHeight: Math.min(2.4, Math.round((settings.lineHeight + 0.1) * 10) / 10) })}><Text style={[styles.stepTxt, { color: theme.fg }]}>＋</Text></Pressable>
              </View>
            </View>
            {/* 边距 */}
            <View style={styles.setRow}>
              <Text style={[styles.setLabel, { color: theme.fg }]}>{t('reader.margin')}</Text>
              <View style={styles.stepper}>
                <Pressable style={[styles.stepBtn, { borderColor: theme.sub }]} onPress={() => updateSettings({ margin: Math.max(10, settings.margin - 4) })}><Text style={[styles.stepTxt, { color: theme.fg }]}>−</Text></Pressable>
                <Text style={[styles.stepVal, { color: theme.fg }]}>{settings.margin}</Text>
                <Pressable style={[styles.stepBtn, { borderColor: theme.sub }]} onPress={() => updateSettings({ margin: Math.min(48, settings.margin + 4) })}><Text style={[styles.stepTxt, { color: theme.fg }]}>＋</Text></Pressable>
              </View>
            </View>
            {/* 翻页方式 */}
            <View style={styles.setRow}>
              <Text style={[styles.setLabel, { color: theme.fg }]}>{t('reader.pageMode')}</Text>
              <View style={styles.stepper}>
                {(['paged', 'scroll'] as const).map((m) => (
                  <Pressable key={m} onPress={() => updateSettings({ pageMode: m })}
                    style={[styles.fontPick, (settings.pageMode || 'paged') === m && styles.fontPickOn]}>
                    <Text style={[styles.fontPickTxt, { color: theme.fg }]}>{m === 'paged' ? t('reader.modePaged') : t('reader.modeScroll')}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {/* 字体 */}
            <View style={styles.setRow}>
              <Text style={[styles.setLabel, { color: theme.fg }]}>{t('reader.font')}</Text>
              <View style={styles.stepper}>
                <Pressable onPress={() => updateSettings({ fontFamily: 'system' })} style={[styles.fontPick, settings.fontFamily === 'system' && styles.fontPickOn]}><Text style={[styles.fontPickTxt, { color: theme.fg }]}>{t('reader.sans')}</Text></Pressable>
                <Pressable onPress={() => updateSettings({ fontFamily: 'serif' })} style={[styles.fontPick, settings.fontFamily === 'serif' && styles.fontPickOn]}><Text style={[styles.fontPickTxt, { color: theme.fg, fontFamily: Platform.OS === 'ios' ? 'Songti SC' : 'serif' }]}>{t('reader.serif')}</Text></Pressable>
              </View>
            </View>
            {/* 背景主题 */}
            <View style={[styles.setRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.setLabel, { color: theme.fg }]}>{t('reader.theme')}</Text>
              <View style={styles.themeRow}>
                {(Object.keys(THEMES) as ReaderSettings['theme'][]).map((k) => (
                  <Pressable key={k} onPress={() => updateSettings({ theme: k })}
                    style={[styles.themeSwatch, { backgroundColor: THEMES[k].bg }, settings.theme === k && styles.themeSwatchOn]}>
                    <Text style={{ color: THEMES[k].fg, fontSize: 13, fontWeight: '700' }}>文</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 段落评论 */}
      <CommentSheet
        visible={commentPara !== null}
        bookId={bookId}
        chapterIndex={chapter?.index ?? 0}
        paragraph={commentPara ?? 0}
        uid={uid}
        theme={theme}
        edition={info && info.editions.length > 1 ? editionId : null}
        onClose={() => setCommentPara(null)}
        onAdded={() => commentPara !== null && onCommentAdded(commentPara)}
      />

      {/* 划选 → 分享好句：公开进本章讨论，私密进我的笔记 */}
      <QuoteSheet
        visible={quote !== null}
        quote={quote?.text ?? ''}
        bookId={bookId}
        chapterIndex={chapter?.index ?? 0}
        chapterTitle={chapter?.title ?? ''}
        paragraph={quote?.paragraph ?? -1}
        edition={currentEdition}
        editions={info?.editions ?? []}
        uid={uid}
        privateOnly={!!info?.isPrivate}
        onClose={() => setQuote(null)}
        onPosted={(c) => {
          const para = quote?.paragraph ?? -1;
          setQuote(null);
          // 发完直接带用户去看它落在了哪里
          if (c.kind === 'comment') {
            if (para >= 0) onCommentAdded(para);
            setDiscOpen(true);
          } else {
            setNotesOpen(true);
          }
        }}
      />

      {/* 本章好句与讨论：跟随当前章节；面板里切章，阅读页同步翻过去 */}
      <DiscussionSheet
        visible={discOpen}
        bookId={bookId}
        chapterIndex={chapter?.index ?? 0}
        chapterTitle={chapter?.title ?? ''}
        totalChapters={chapter?.total ?? 1}
        chapterSource={info?.chapterSource}
        editions={info?.editions ?? []}
        uid={uid}
        onClose={() => setDiscOpen(false)}
        onChangeChapter={(i) => jumpChapter(i)}
      />

      <NotesSheet
        visible={notesOpen}
        bookId={bookId}
        chapterTitles={toc?.chapters.map((c) => c.title) ?? []}
        editions={info?.editions ?? []}
        uid={uid}
        onClose={() => setNotesOpen(false)}
      />

      {/* 划选 → AI 翻译与理解：目标语言默认跟随手机系统语言 */}
      <ExplainSheet
        visible={explain !== null}
        text={explain?.text ?? ''}
        context={explain ? contextFor(explain.paragraph) : ''}
        bookId={bookId}
        bookTitle={info?.title || title || ''}
        chapterTitle={chapter?.title ?? ''}
        edition={currentEdition}
        defaultTarget={systemLanguage()}
        onClose={() => setExplain(null)}
      />

      <EditionPicker
        visible={edPickerOpen}
        editions={info?.editions ?? []}
        currentId={editionId}
        onPick={switchEdition}
        onAdd={info?.isPrivate ? addEdition : undefined}
        adding={addingEdition}
        onClose={() => setEdPickerOpen(false)}
      />
    </View>
  );
}

// ---------- 段落评论面板 ----------
function CommentSheet({ visible, bookId, chapterIndex, paragraph, uid, theme, edition, onClose, onAdded }: {
  visible: boolean; bookId: string; chapterIndex: number; paragraph: number; uid: string;
  theme: { bg: string; fg: string; sub: string };
  /** 多版本书：只看当前版本这一段的评论（各版本段落编号不对应） */
  edition: string | null;
  onClose: () => void; onAdded: () => void;
}) {
  const { t } = useI18n();
  const [list, setList] = useState<ParagraphComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await fetchParagraphComments(bookId, chapterIndex, paragraph, uid);
    setList(edition ? all.filter((c) => c.edition === edition) : all);
    setLoading(false);
  }, [bookId, chapterIndex, paragraph, uid, edition]);

  useEffect(() => { if (visible) { setText(''); load(); } }, [visible, load]);

  const send = async (kind: 'comment' | 'note') => {
    const tx = text.trim();
    if (!tx || !uid) return;
    setText('');
    const c = await addParagraphComment({ userId: uid, bookId, chapterIndex, paragraph, kind, text: tx, edition: edition ?? undefined });
    if (c) { setList((l) => [c, ...l]); onAdded(); }
  };

  const toggleLike = async (c: ParagraphComment) => {
    const r = await likeParagraphComment(uid, c.id);
    if (r) setList((l) => l.map((x) => (x.id === c.id ? { ...x, liked: r.liked, likes: r.likes } : x)));
  };

  const remove = (c: ParagraphComment) => {
    Alert.alert(t('reader.deleteComment'), undefined, [
      { text: t('dm.cancel'), style: 'cancel' },
      { text: t('msgMenu.delete'), style: 'destructive', onPress: async () => { await deleteParagraphComment(uid, c.id); setList((l) => l.filter((x) => x.id !== c.id)); } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.cmtBackdrop} onPress={onClose}>
        <Pressable style={styles.cmtSheet} onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.cmtHandle} />
            <Text style={styles.cmtTitle}>{t('reader.thisParaComments')}</Text>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {loading ? (
                <ActivityIndicator color={colors.terracotta} style={{ marginVertical: spacing.lg }} />
              ) : list.length === 0 ? (
                <Text style={styles.cmtEmpty}>{t('reader.firstComment')}</Text>
              ) : list.map((c) => (
                <View key={c.id} style={styles.cmtRow}>
                  <View style={styles.cmtAvatar}>
                    {c.user.avatar_url ? <Image source={{ uri: c.user.avatar_url }} style={styles.cmtAvatarImg} /> : <Snowman size={28} pose="wave" />}
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.cmtName}>{c.user.username || '@' + c.user.handle}{c.kind === 'note' && <Text style={styles.noteTag}>  {t('reader.privateNote')}</Text>}</Text>
                    <Text style={styles.cmtText}>{c.text}</Text>
                    {c.is_mine && <Pressable onPress={() => remove(c)}><Text style={styles.cmtDel}>{t('msgMenu.delete')}</Text></Pressable>}
                  </View>
                  {c.kind === 'comment' && (
                    <Pressable onPress={() => toggleLike(c)} style={styles.likeBtn} hitSlop={8}>
                      <Text style={[styles.likeIcon, c.liked && { color: colors.terracotta }]}>♥</Text>
                      <Text style={styles.likeNum}>{c.likes}</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.cmtInputRow}>
              <TextInput style={styles.cmtInput} value={text} onChangeText={setText} placeholder={t('reader.sayThought')} placeholderTextColor={colors.textFaint} multiline />
              <Pressable onPress={() => send('note')} style={styles.cmtNoteBtn}><Text style={styles.cmtNoteTxt}>{t('reader.noteBtn')}</Text></Pressable>
              <Pressable onPress={() => send('comment')} disabled={!text.trim()} style={[styles.cmtSend, !text.trim() && { opacity: 0.4 }]}><Text style={styles.cmtSendTxt}>{t('reader.post')}</Text></Pressable>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { ...typography.caption },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1 },
  barIcon: { fontSize: 26 },
  barTitleWrap: { flex: 1, alignItems: 'center', marginHorizontal: spacing.md },
  barTitle: { ...typography.body, fontWeight: '600', textAlign: 'center' },
  demoTag: { fontSize: 10, marginTop: 1 },
  edPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  edPillText: { fontSize: 12, fontWeight: '600' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.sm, borderTopWidth: 1 },
  bottomBtn: { alignItems: 'center', gap: 2, minWidth: 52 },
  bottomIcon: { fontSize: 18, fontWeight: '700' },
  bottomLabel: { fontSize: 10 },
  pageMeta: { flex: 1, alignItems: 'center' },
  pageMetaText: { ...typography.caption },

  tocHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  tocTitle: { ...typography.h3 },
  tocRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1 },
  tocRowText: { ...typography.body },

  settingsBackdrop: { flex: 1, justifyContent: 'flex-end' },
  settingsCard: { padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, ...{ shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -2 } } },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#0001' },
  setLabel: { ...typography.body },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1 },
  stepTxt: { ...typography.body, fontWeight: '600' },
  stepVal: { ...typography.body, minWidth: 36, textAlign: 'center' },
  fontPick: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  fontPickOn: { borderColor: colors.terracotta },
  fontPickTxt: { ...typography.body },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeSwatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  themeSwatchOn: { borderColor: colors.terracotta },

  cmtBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  cmtSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  cmtHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  cmtTitle: { ...typography.h3, marginBottom: spacing.md },
  cmtEmpty: { ...typography.body, color: colors.textFaint, textAlign: 'center', paddingVertical: spacing.lg },
  cmtRow: { flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  cmtAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center' },
  cmtAvatarImg: { width: '100%', height: '100%' },
  cmtName: { ...typography.caption, fontWeight: '700', color: colors.text },
  noteTag: { color: colors.textFaint, fontWeight: '400' },
  cmtText: { ...typography.body, fontSize: 15, marginTop: 2, lineHeight: 21 },
  cmtDel: { ...typography.caption, color: colors.textFaint, marginTop: 4 },
  likeBtn: { alignItems: 'center', paddingHorizontal: spacing.sm },
  likeIcon: { fontSize: 16, color: colors.textFaint },
  likeNum: { fontSize: 11, color: colors.textMuted },
  cmtInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  cmtInput: { flex: 1, ...typography.body, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 100 },
  cmtNoteBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  cmtNoteTxt: { ...typography.caption, color: colors.textMuted },
  cmtSend: { backgroundColor: colors.terracotta, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  cmtSendTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
