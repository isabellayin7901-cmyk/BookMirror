/**
 * 阅读页的弹出面板：分享好句 / 本章好句与讨论 / 我的笔记 / AI 翻译与理解 / 版本选择。
 * 样式沿用阅读页原有的段评面板（底部抽屉 + 莫兰迪配色）。
 * 所有列表都只展示服务器返回的真实数据；空了就显示空状态，加载失败就说失败。
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView, TextInput, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Dimensions,
} from 'react-native';

import { colors, spacing, typography, radius } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { useI18n } from '../lib/LanguageContext';
import {
  addParagraphComment, deleteParagraphComment, likeParagraphComment,
  fetchChapterDiscussion, fetchMyNotes, explainPassage,
  type ParagraphComment, type ExplainResult,
} from '../lib/api';
import { editionLabel } from '../lib/readerSource';
import type { BookEdition, ChapterSource, Language } from '../types';

// ---------- 通用：底部抽屉 ----------

// 内容区最多占屏幕六成高，长内容（AI 解读、长讨论）在里面滚动，不会把抽屉撑出屏幕
const SCROLL_MAX_H = Math.round(Dimensions.get('window').height * 0.6);

function Sheet({ visible, onClose, title, children, footer }: {
  visible: boolean; onClose: () => void; title: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.handle} />
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>{typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : title}</View>
              <Pressable onPress={onClose} hitSlop={10}><Text style={styles.close}>✕</Text></Pressable>
            </View>
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">{children}</ScrollView>
            {footer}
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function QuoteBlock({ text, caption }: { text: string; caption?: string }) {
  return (
    <View style={styles.quoteBlock}>
      <Text style={styles.quoteText} selectable>{text}</Text>
      {!!caption && <Text style={styles.quoteCaption}>{caption}</Text>}
    </View>
  );
}

/** 一条讨论/笔记卡片 */
function PostCard({ c, uid, editions, showUser, onChanged }: {
  c: ParagraphComment; uid: string; editions: BookEdition[]; showUser: boolean;
  onChanged: (next: ParagraphComment | null) => void;
}) {
  const { t, lang } = useI18n();
  const ed = c.edition ? editions.find((e) => e.id === c.edition) : undefined;

  const toggleLike = async () => {
    const r = await likeParagraphComment(uid, c.id);
    if (r) onChanged({ ...c, liked: r.liked, likes: r.likes });
  };
  const remove = () => {
    Alert.alert(t('reader.deleteComment'), undefined, [
      { text: t('dm.cancel'), style: 'cancel' },
      { text: t('msgMenu.delete'), style: 'destructive', onPress: async () => { await deleteParagraphComment(uid, c.id); onChanged(null); } },
    ]);
  };

  return (
    <View style={styles.card}>
      {!!c.quote && (
        <QuoteBlock
          text={c.quote}
          caption={ed && editions.length > 1 ? t('disc.fromEdition', { name: editionLabel(ed, lang) }) : undefined}
        />
      )}
      <View style={styles.cardRow}>
        {showUser && (
          <View style={styles.avatar}>
            {c.user.avatar_url ? <Image source={{ uri: c.user.avatar_url }} style={styles.avatarImg} /> : <Snowman size={24} pose="wave" />}
          </View>
        )}
        <View style={{ flex: 1, marginLeft: showUser ? spacing.sm : 0 }}>
          {showUser && <Text style={styles.name}>{c.is_mine ? t('disc.me') : (c.user.username || (c.user.handle ? '@' + c.user.handle : t('book.aReader')))}</Text>}
          {!!c.text && <Text style={styles.body}>{c.text}</Text>}
          {c.is_mine && <Pressable onPress={remove} hitSlop={6}><Text style={styles.del}>{t('msgMenu.delete')}</Text></Pressable>}
        </View>
        {c.kind === 'comment' && (
          <Pressable onPress={toggleLike} style={styles.likeBtn} hitSlop={8}>
            <Text style={[styles.likeIcon, c.liked && { color: colors.terracotta }]}>♥</Text>
            <Text style={styles.likeNum}>{c.likes}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---------- 分享好句 ----------

export function QuoteSheet({ visible, quote, bookId, chapterIndex, chapterTitle, paragraph, edition, editions, uid, onClose, onPosted }: {
  visible: boolean; quote: string; bookId: string; chapterIndex: number; chapterTitle: string;
  paragraph: number; edition: BookEdition | null; editions: BookEdition[]; uid: string;
  onClose: () => void; onPosted: (c: ParagraphComment) => void;
}) {
  const { t, lang } = useI18n();
  const [text, setText] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) { setText(''); setIsPublic(true); setBusy(false); } }, [visible]);

  const submit = async () => {
    if (busy || !uid) return;
    setBusy(true);
    const c = await addParagraphComment({
      userId: uid, bookId, chapterIndex, paragraph: Math.max(0, paragraph),
      kind: isPublic ? 'comment' : 'note', text: text.trim(), quote, edition: edition?.id,
    });
    setBusy(false);
    if (!c) { Alert.alert(t('quote.failed')); return; }
    onPosted(c);
  };

  const caption = [chapterTitle, edition && editions.length > 1 ? editionLabel(edition, lang) : ''].filter(Boolean).join(' · ');

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('quote.title')}
      footer={
        <View>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('quote.thoughtPh')}
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <View style={styles.segment}>
            {[true, false].map((pub) => (
              <Pressable key={String(pub)} onPress={() => setIsPublic(pub)} style={[styles.segBtn, isPublic === pub && styles.segBtnOn]}>
                <Text style={[styles.segText, isPublic === pub && styles.segTextOn]}>{pub ? t('quote.public') : t('quote.private')}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>{isPublic ? t('quote.publicHint') : t('quote.privateHint')}</Text>
          <Pressable onPress={submit} disabled={busy} style={[styles.primaryBtn, busy && { opacity: 0.5 }]}>
            <Text style={styles.primaryText}>{busy ? '…' : isPublic ? t('quote.submit') : t('quote.save')}</Text>
          </Pressable>
        </View>
      }
    >
      <QuoteBlock text={quote} caption={caption} />
    </Sheet>
  );
}

// ---------- 本章好句与讨论 ----------

export function DiscussionSheet({ visible, bookId, chapterIndex, chapterTitle, totalChapters, chapterSource, editions, uid, onClose, onChangeChapter }: {
  visible: boolean; bookId: string; chapterIndex: number; chapterTitle: string; totalChapters: number;
  chapterSource?: ChapterSource; editions: BookEdition[]; uid: string;
  onClose: () => void;
  /** 在面板里切章：阅读页同步翻到那一章 */
  onChangeChapter: (index: number) => void;
}) {
  const { t } = useI18n();
  const [list, setList] = useState<ParagraphComment[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setList(null); setFailed(false);
    const r = await fetchChapterDiscussion(bookId, chapterIndex, uid);
    if (r === null) setFailed(true); else setList(r);
  }, [bookId, chapterIndex, uid]);

  // 章节切换时讨论区跟着切
  useEffect(() => { if (visible) load(); }, [visible, load]);

  const title = (
    <View>
      <Text style={styles.title}>{t('disc.title')}</Text>
      <View style={styles.chapterNav}>
        <Pressable disabled={chapterIndex <= 0} onPress={() => onChangeChapter(chapterIndex - 1)} hitSlop={8}>
          <Text style={[styles.navArrow, chapterIndex <= 0 && styles.navOff]}>‹</Text>
        </Pressable>
        <Text style={styles.chapterName} numberOfLines={1}>{chapterTitle}</Text>
        <Pressable disabled={chapterIndex >= totalChapters - 1} onPress={() => onChangeChapter(chapterIndex + 1)} hitSlop={8}>
          <Text style={[styles.navArrow, chapterIndex >= totalChapters - 1 && styles.navOff]}>›</Text>
        </Pressable>
      </View>
      {chapterSource && <Text style={styles.sourceTag}>{t(`disc.chapterSource.${chapterSource}`)}</Text>}
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {failed ? (
        <Text style={styles.empty}>{t('disc.loadFailed')}</Text>
      ) : list === null ? (
        <ActivityIndicator color={colors.terracotta} style={{ marginVertical: spacing.lg }} />
      ) : list.length === 0 ? (
        <Text style={styles.empty}>{t('disc.empty')}</Text>
      ) : list.map((c) => (
        <PostCard
          key={c.id} c={c} uid={uid} editions={editions} showUser
          onChanged={(n) => setList((l) => (l ? (n ? l.map((x) => (x.id === c.id ? n : x)) : l.filter((x) => x.id !== c.id)) : l))}
        />
      ))}
    </Sheet>
  );
}

// ---------- 我的笔记 ----------

export function NotesSheet({ visible, bookId, chapterTitles, editions, uid, onClose }: {
  visible: boolean; bookId: string; chapterTitles: string[]; editions: BookEdition[]; uid: string; onClose: () => void;
}) {
  const { t } = useI18n();
  const [list, setList] = useState<ParagraphComment[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setList(null); setFailed(false);
    fetchMyNotes(bookId, uid).then((r) => { if (r === null) setFailed(true); else setList(r); });
  }, [visible, bookId, uid]);

  let lastChapter = -1;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('notes.title')}>
      {failed ? (
        <Text style={styles.empty}>{t('notes.loadFailed')}</Text>
      ) : list === null ? (
        <ActivityIndicator color={colors.terracotta} style={{ marginVertical: spacing.lg }} />
      ) : list.length === 0 ? (
        <Text style={styles.empty}>{t('notes.empty')}</Text>
      ) : list.map((c) => {
        const ci = c.chapter_index ?? 0;
        const header = ci !== lastChapter ? (chapterTitles[ci] || `#${ci + 1}`) : null;
        lastChapter = ci;
        return (
          <View key={c.id}>
            {header && <Text style={styles.groupHead}>{header}</Text>}
            <PostCard
              c={c} uid={uid} editions={editions} showUser={false}
              onChanged={(n) => setList((l) => (l ? (n ? l.map((x) => (x.id === c.id ? n : x)) : l.filter((x) => x.id !== c.id)) : l))}
            />
          </View>
        );
      })}
    </Sheet>
  );
}

// ---------- AI 翻译与理解 ----------

export function ExplainSheet({ visible, text, context, bookId, bookTitle, chapterTitle, edition, defaultTarget, onClose }: {
  visible: boolean; text: string; context: string; bookId: string; bookTitle: string; chapterTitle: string;
  edition: BookEdition | null;
  /** 默认译成手机系统语言 */
  defaultTarget: Language;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [target, setTarget] = useState<Language>(defaultTarget);
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [state, setState] = useState<'loading' | 'done' | 'failed'>('loading');

  const run = useCallback(async (to: Language) => {
    setState('loading'); setResult(null);
    const r = await explainPassage({
      bookId, bookTitle, chapterTitle,
      editionLabel: edition ? edition.labelEn : '', sourceLang: edition?.lang,
      text, context, targetLang: to,
    });
    if (r) { setResult(r); setState('done'); } else setState('failed');
  }, [bookId, bookTitle, chapterTitle, edition, text, context]);

  useEffect(() => { if (visible) { setTarget(defaultTarget); run(defaultTarget); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchTarget = (to: Language) => { if (to !== target) { setTarget(to); run(to); } };

  const title = (
    <View style={styles.titleRow}>
      <Text style={styles.title}>{t('explain.title')}</Text>
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>{t('explain.target')}</Text>
        {(['zh', 'en'] as Language[]).map((l) => (
          <Pressable key={l} onPress={() => switchTarget(l)} style={[styles.targetBtn, target === l && styles.targetBtnOn]}>
            <Text style={[styles.targetText, target === l && styles.targetTextOn]}>{l === 'zh' ? '中文' : 'EN'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {/* 原文始终保留，方便对照 */}
      <Text style={styles.sectionHead}>{t('explain.original')}</Text>
      <QuoteBlock text={text} caption={[chapterTitle, edition ? editionLabel(edition, lang) : ''].filter(Boolean).join(' · ')} />

      {state === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.terracotta} />
          <Text style={styles.hint}>{t('explain.loading')}</Text>
        </View>
      )}
      {state === 'failed' && (
        <View style={styles.center}>
          <Text style={styles.empty}>{t('explain.unavailable')}</Text>
          <Pressable onPress={() => run(target)} style={styles.ghostBtn}><Text style={styles.ghostText}>{t('explain.retry')}</Text></Pressable>
        </View>
      )}
      {state === 'done' && result && (
        <View>
          <Text style={styles.sectionHead}>{result.same_language ? t('explain.paraphrase') : t('explain.translation')}</Text>
          <Text style={styles.translation} selectable>{result.translation}</Text>

          {!!result.meaning && (<>
            <Text style={styles.sectionHead}>{t('explain.meaning')}</Text>
            <Text style={styles.body} selectable>{result.meaning}</Text>
          </>)}

          {result.breakdown.length > 0 && (<>
            <Text style={styles.sectionHead}>{t('explain.breakdown')}</Text>
            {result.breakdown.map((b, i) => (
              <View key={i} style={styles.item}>
                <Text style={styles.itemKey}>{b.segment}</Text>
                <Text style={styles.body}>{b.explanation}</Text>
              </View>
            ))}
          </>)}

          {result.ambiguities.length > 0 && (<>
            <Text style={styles.sectionHead}>{t('explain.ambiguities')}</Text>
            {result.ambiguities.map((a, i) => (
              <View key={i} style={[styles.item, styles.ambiguity]}>
                <Text style={styles.itemKey}>{a.segment}</Text>
                <Text style={styles.body}>{t('explain.options')}{a.options.join(' / ')}</Text>
                {!!a.note && <Text style={styles.hint}>{a.note}</Text>}
              </View>
            ))}
          </>)}

          {result.notes.length > 0 && (<>
            <Text style={styles.sectionHead}>{t('explain.notes')}</Text>
            {result.notes.map((n, i) => (
              <View key={i} style={styles.item}>
                <Text style={styles.itemKey}>{n.term}</Text>
                <Text style={styles.body}>{n.note}</Text>
              </View>
            ))}
          </>)}

          {result.terms.length > 0 && (<>
            <Text style={styles.sectionHead}>{t('explain.terms')}</Text>
            <View style={styles.termWrap}>
              {result.terms.map((x, i) => (
                <View key={i} style={[styles.termChip, x.consistent && styles.termChipFixed]}>
                  <Text style={styles.termText}>{x.term} → {x.rendering}</Text>
                  <Text style={styles.termTag}>{x.consistent ? t('explain.termConsistent') : t('explain.termNew')}</Text>
                </View>
              ))}
            </View>
          </>)}

          <Text style={[styles.hint, { marginTop: spacing.lg }]}>{t('explain.disclaimer')}</Text>
        </View>
      )}
    </Sheet>
  );
}

// ---------- 版本选择 ----------

export function EditionPicker({ visible, editions, currentId, onPick, onClose }: {
  visible: boolean; editions: BookEdition[]; currentId: string | null;
  onPick: (e: BookEdition) => void; onClose: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('edition.title')}>
      {editions.map((e) => {
        const on = e.id === currentId;
        return (
          <Pressable key={e.id} onPress={() => onPick(e)} style={[styles.edRow, on && styles.edRowOn]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.edName}>
                {editionLabel(e, lang)}
                <Text style={styles.edKind}>  {e.kind === 'original' ? t('edition.original') : t('edition.translation')}</Text>
              </Text>
              <Text style={styles.edSource}>{e.source}</Text>
            </View>
            {on && <Text style={styles.check}>✓</Text>}
          </Pressable>
        );
      })}
      <Text style={[styles.hint, { marginTop: spacing.md }]}>{t('edition.hint')}</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: '88%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  title: { ...typography.h3 },
  close: { fontSize: 18, color: colors.textMuted, paddingLeft: spacing.md },
  scroll: { flexGrow: 0, maxHeight: SCROLL_MAX_H },

  quoteBlock: { borderLeftWidth: 3, borderLeftColor: colors.terracotta, backgroundColor: colors.surface, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  quoteText: { ...typography.body, fontSize: 15, lineHeight: 24 },
  quoteCaption: { ...typography.caption, color: colors.textFaint, marginTop: 4 },

  card: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  cardRow: { flexDirection: 'row' },
  avatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  name: { ...typography.caption, fontWeight: '700', color: colors.text },
  body: { ...typography.body, fontSize: 15, lineHeight: 22 },
  del: { ...typography.caption, color: colors.textFaint, marginTop: 4 },
  likeBtn: { alignItems: 'center', paddingHorizontal: spacing.sm },
  likeIcon: { fontSize: 16, color: colors.textFaint },
  likeNum: { fontSize: 11, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textFaint, textAlign: 'center', paddingVertical: spacing.lg },
  groupHead: { ...typography.caption, fontWeight: '700', color: colors.primary, marginTop: spacing.md },

  input: { ...typography.body, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 64, maxHeight: 120, marginTop: spacing.md, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', backgroundColor: colors.bgSoft, borderRadius: radius.pill, padding: 3, marginTop: spacing.md },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.pill },
  segBtnOn: { backgroundColor: colors.surface },
  segText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  segTextOn: { color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  primaryBtn: { backgroundColor: colors.terracotta, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  primaryText: { color: '#fff', fontWeight: '700' },
  ghostBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.sm },
  ghostText: { color: colors.text, fontWeight: '600' },
  center: { alignItems: 'center', paddingVertical: spacing.lg },

  chapterNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  navArrow: { fontSize: 22, color: colors.terracotta, paddingHorizontal: 4 },
  navOff: { color: colors.textFaint },
  chapterName: { ...typography.body, fontWeight: '600', flexShrink: 1 },
  sourceTag: { ...typography.caption, color: colors.textFaint, marginTop: 2 },

  titleRow: { gap: spacing.sm },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  targetLabel: { ...typography.caption, color: colors.textMuted, marginRight: 2 },
  targetBtn: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  targetBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  targetText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  targetTextOn: { color: '#fff' },
  sectionHead: { ...typography.caption, fontWeight: '700', color: colors.primary, marginTop: spacing.md, marginBottom: spacing.xs },
  translation: { ...typography.body, fontSize: 17, lineHeight: 27, color: colors.text },
  item: { marginBottom: spacing.sm },
  itemKey: { ...typography.body, fontSize: 15, fontWeight: '700', color: colors.text },
  ambiguity: { backgroundColor: '#F6E9DA', borderRadius: radius.sm, padding: spacing.sm },
  termWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  termChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: colors.surface },
  termChipFixed: { borderColor: colors.sage },
  termText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  termTag: { fontSize: 10, color: colors.textMuted },

  edRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.sm },
  edRowOn: { borderColor: colors.terracotta },
  edName: { ...typography.body, fontWeight: '600' },
  edKind: { ...typography.caption, color: colors.textMuted, fontWeight: '400' },
  edSource: { ...typography.caption, color: colors.textFaint, marginTop: 2 },
  check: { fontSize: 18, color: colors.terracotta, marginLeft: spacing.sm },
});
