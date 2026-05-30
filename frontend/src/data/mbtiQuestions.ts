/**
 * BookMirror MBTI 题库（中英双语）
 *
 * 53 题完整测评 + 20 题快速测评（`inQuick: true` 标记）。
 *
 * 题型：
 *  - 'yesno'   → 三按钮（是 / 否 / 看情况），custom labels via yesnoLabels
 *  - 'slider'  → 0–5 游标卡尺，可选 leftLabel / rightLabel
 *  - 'choice3' → 三个自定义选项按钮
 *
 * 双语：每题都带 `*_en` 字段。渲染/上报时用 localizeQuestion(q, lang)
 * 把题面与选项切换成对应语言，英文模式下发给后端的也是英文题面。
 *
 * 评分：不在客户端做。前端把"题目原文 + 用户答案"打包丢给后端 /api/mbti，
 * 由 Claude 推断 4 字母 MBTI，返回 { mbti, confidence, reasoning }。
 */

import type { Language } from '../types';

export type MbtiQuestionType = 'yesno' | 'slider' | 'choice3';

export interface MbtiQuestion {
  id: number;
  text: string;
  text_en: string;
  type: MbtiQuestionType;
  /** Override the default 是 / 否 / 看情况 labels (yesno only). */
  yesnoLabels?: { yes: string; no: string; neutral: string };
  yesnoLabels_en?: { yes: string; no: string; neutral: string };
  /** Optional left/right anchors for 0–5 slider. */
  sliderLabels?: { left: string; right: string };
  sliderLabels_en?: { left: string; right: string };
  /** 3 custom button labels (choice3 only). */
  choices?: [string, string, string];
  choices_en?: [string, string, string];
  /** Included in the 20-question quick test. */
  inQuick: boolean;
}

export const MBTI_QUESTIONS: MbtiQuestion[] = [
  { id: 1,  type: 'yesno',  inQuick: true,
    text: '你经常结交新朋友吗？',
    text_en: 'Do you often make new friends?',
    yesnoLabels: { yes: '是', no: '否', neutral: '看环境需要' },
    yesnoLabels_en: { yes: 'Yes', no: 'No', neutral: 'Depends on the setting' } },

  { id: 2,  type: 'slider', inQuick: true,
    text: '复杂新颖的想法比简单直接的想法更能激发你的兴趣？',
    text_en: 'Complex, novel ideas excite you more than simple, straightforward ones.',
    sliderLabels: { left: '完全不会', right: '非常激发' },
    sliderLabels_en: { left: 'Not at all', right: 'Very much' } },

  { id: 3,  type: 'slider', inQuick: true,
    text: '你更容易被那些引起情感共鸣的事物所说服，而不是理性的事实论据。',
    text_en: "You're more easily persuaded by things that resonate emotionally than by rational facts.",
    sliderLabels: { left: '完全不会', right: '完全会' },
    sliderLabels_en: { left: 'Not at all', right: 'Completely' } },

  { id: 4,  type: 'yesno',  inQuick: true,
    text: '你的生活空间是干净整洁的。',
    text_en: 'Your living space is clean and tidy.' },

  { id: 5,  type: 'slider', inQuick: false,
    text: '即使在压力很大的情况下，你通常也能保持冷静。',
    text_en: 'Even under a lot of pressure, you usually stay calm.',
    sliderLabels: { left: '完全做不到', right: '完全可以' },
    sliderLabels_en: { left: 'Not at all', right: 'Definitely' } },

  { id: 6,  type: 'slider', inQuick: false,
    text: '你觉得与陌生人建立人脉或像商品一般推销自己是一件非常害怕的事情。',
    text_en: 'Networking with strangers or selling yourself feels very scary to you.',
    sliderLabels: { left: '一点不怕', right: '非常害怕' },
    sliderLabels_en: { left: 'Not scary at all', right: 'Very scary' } },

  { id: 7,  type: 'yesno',  inQuick: true,
    text: '你能够有效地安排好任务的优先级并且做好计划，一般都能在截止日期前完成。',
    text_en: 'You prioritize and plan tasks well, and usually finish before the deadline.' },

  { id: 8,  type: 'yesno',  inQuick: false,
    text: '你认为人们的故事和情感比数字或数据更有说服力吗？',
    text_en: "Do you find people's stories and emotions more convincing than numbers or data?" },

  { id: 9,  type: 'yesno',  inQuick: false,
    text: '即使是微小的错误也会让你怀疑自己的整体能力和知识水平。',
    text_en: 'Even a tiny mistake makes you doubt your overall ability and knowledge.' },

  { id: 10, type: 'slider', inQuick: false,
    text: '你对艺术作品的各种解读与讨论感兴趣吗？',
    text_en: 'Are you interested in different interpretations and discussions of art?',
    sliderLabels: { left: '完全不感兴趣', right: '非常感兴趣' },
    sliderLabels_en: { left: 'Not at all', right: 'Very interested' } },

  { id: 11, type: 'slider', inQuick: true,
    text: '在决定行动方案时，你更注重事实还是人们的感受？',
    text_en: "When deciding what to do, do you focus more on facts or people's feelings?",
    sliderLabels: { left: '事实', right: '感受' },
    sliderLabels_en: { left: 'Facts', right: 'Feelings' } },

  { id: 12, type: 'yesno',  inQuick: true,
    text: '你会允许自己一天顺其自然、没有计划地展开吗？',
    text_en: 'Would you let a day unfold naturally, without any plan?' },

  { id: 13, type: 'slider', inQuick: false,
    text: '你很少担心自己给遇到的人留下坏印象？',
    text_en: 'You rarely worry about making a bad impression on people you meet.',
    sliderLabels: { left: '经常担心', right: '从不担心' },
    sliderLabels_en: { left: 'Worry often', right: 'Never worry' } },

  { id: 14, type: 'choice3', inQuick: true,
    text: '你休闲的时候喜欢参加团队活动还是个人独处？',
    text_en: 'In your free time, do you prefer group activities or being alone?',
    choices: ['团队活动', '个人独处', '看情况'],
    choices_en: ['Group activities', 'Being alone', 'Depends'] },

  { id: 15, type: 'yesno',  inQuick: true,
    text: '你喜欢尝试新的、未经试验的方法吗？',
    text_en: 'Do you like trying new, untested approaches?' },

  { id: 16, type: 'slider', inQuick: false,
    text: '你会更注重情绪和精神，还是实际行动与诚实？',
    text_en: 'Do you value emotion and spirit, or practical action and honesty?',
    sliderLabels: { left: '情绪与精神', right: '行动与诚实' },
    sliderLabels_en: { left: 'Emotion & spirit', right: 'Action & honesty' } },

  { id: 17, type: 'slider', inQuick: false,
    text: '你会担心当下做的事情逐渐恶化吗？',
    text_en: "Do you worry that what you're doing now will gradually get worse?",
    sliderLabels: { left: '完全不会', right: '非常担心' },
    sliderLabels_en: { left: 'Not at all', right: 'Very worried' } },

  { id: 18, type: 'slider', inQuick: true,
    text: '你做事情更注重效率，还是更注重情感？',
    text_en: 'Do you focus more on efficiency or on emotion when doing things?',
    sliderLabels: { left: '效率', right: '情感' },
    sliderLabels_en: { left: 'Efficiency', right: 'Emotion' } },

  { id: 19, type: 'slider', inQuick: false,
    text: '你有想过自己以写小说为生吗？',
    text_en: 'Have you ever thought about making a living writing novels?',
    sliderLabels: { left: '完全没有', right: '经常想' },
    sliderLabels_en: { left: 'Never', right: 'Often' } },

  { id: 20, type: 'slider', inQuick: true,
    text: '在意见分歧时，你会优先考虑证明自己的观点，还是顾及他人的感受？',
    text_en: "In a disagreement, do you prioritize proving your point or considering others' feelings?",
    sliderLabels: { left: '证明观点', right: '顾及感受' },
    sliderLabels_en: { left: 'Prove my point', right: 'Consider feelings' } },

  { id: 21, type: 'yesno',  inQuick: true,
    text: '在社交聚会上，你通常会等待别人先自我介绍吗？',
    text_en: 'At social gatherings, do you usually wait for others to introduce themselves first?' },

  { id: 22, type: 'slider', inQuick: false,
    text: '你的情绪变化快吗？',
    text_en: 'Do your moods change quickly?',
    sliderLabels: { left: '非常稳定', right: '非常快变' },
    sliderLabels_en: { left: 'Very stable', right: 'Very changeable' } },

  { id: 23, type: 'slider', inQuick: false,
    text: '你不容易被情绪化的论点所左右？',
    text_en: "You're not easily swayed by emotional arguments.",
    sliderLabels: { left: '非常容易', right: '完全不会' },
    sliderLabels_en: { left: 'Very easily', right: 'Not at all' } },

  { id: 24, type: 'yesno',  inQuick: true,
    text: '你经常在最后一刻才去做事情。',
    text_en: 'You often do things at the last minute.' },

  { id: 25, type: 'yesno',  inQuick: false,
    text: '你喜欢探讨伦理困境？',
    text_en: 'Do you enjoy discussing ethical dilemmas?' },

  { id: 26, type: 'yesno',  inQuick: true,
    text: '当讨论变得逐渐理论化的时候，你会感觉无趣。',
    text_en: 'When a discussion gets increasingly theoretical, you find it boring.' },

  { id: 27, type: 'slider', inQuick: false,
    text: '当事实与感受发生冲突的时候，你通常会偏向哪一边？',
    text_en: 'When facts and feelings conflict, which side do you usually lean toward?',
    sliderLabels: { left: '事实', right: '自己的感受' },
    sliderLabels_en: { left: 'Facts', right: 'My feelings' } },

  { id: 28, type: 'slider', inQuick: false,
    text: '你觉得保持规律的学习和自律很困难。',
    text_en: 'You find it hard to keep a regular study routine and self-discipline.',
    sliderLabels: { left: '一点不难', right: '非常困难' },
    sliderLabels_en: { left: 'Not hard at all', right: 'Very hard' } },

  { id: 29, type: 'slider', inQuick: false,
    text: '你很少质疑自己做出的选择？',
    text_en: 'You rarely question the choices you make.',
    sliderLabels: { left: '经常质疑', right: '从不质疑' },
    sliderLabels_en: { left: 'Question often', right: 'Never question' } },

  { id: 30, type: 'slider', inQuick: true,
    text: '朋友会说你较为开朗还是较为内敛？',
    text_en: 'Would friends call you more outgoing or more reserved?',
    sliderLabels: { left: '开朗', right: '内敛' },
    sliderLabels_en: { left: 'Outgoing', right: 'Reserved' } },

  { id: 31, type: 'slider', inQuick: false,
    text: '你对各种创意表达很感兴趣，例如写作、自我 DIY 等等。',
    text_en: "You're very interested in creative expression, like writing, DIY, and so on.",
    sliderLabels: { left: '完全不感兴趣', right: '非常感兴趣' },
    sliderLabels_en: { left: 'Not at all', right: 'Very interested' } },

  { id: 32, type: 'slider', inQuick: false,
    text: '你通常会根据客观事实而不是情感印象做选择。',
    text_en: 'You usually decide based on objective facts rather than emotional impressions.',
    sliderLabels: { left: '凭情感印象', right: '凭客观事实' },
    sliderLabels_en: { left: 'By emotional impression', right: 'By objective facts' } },

  { id: 33, type: 'yesno',  inQuick: true,
    text: '你喜欢给自己列一个待办清单吗？',
    text_en: 'Do you like making yourself a to-do list?' },

  { id: 34, type: 'slider', inQuick: false,
    text: '你会感觉自己没有安全感吗？',
    text_en: 'Do you feel insecure?',
    sliderLabels: { left: '非常安全', right: '完全没安全感' },
    sliderLabels_en: { left: 'Very secure', right: 'Very insecure' } },

  { id: 35, type: 'yesno',  inQuick: false,
    text: '你尽量避免打电话吗？',
    text_en: 'Do you try to avoid phone calls?',
    yesnoLabels: { yes: '是', no: '否', neutral: '看心情' },
    yesnoLabels_en: { yes: 'Yes', no: 'No', neutral: 'Depends on mood' } },

  { id: 36, type: 'slider', inQuick: true,
    text: '你喜欢探索自己不熟悉的想法和观点吗？',
    text_en: "Do you like exploring ideas and viewpoints you're unfamiliar with?",
    sliderLabels: { left: '完全不喜欢', right: '非常喜欢' },
    sliderLabels_en: { left: 'Not at all', right: 'Very much' } },

  { id: 37, type: 'slider', inQuick: false,
    text: '如果你的计划被打乱了，你会先让自己冷静回到正轨做事情？还是先处理好自己的情绪？',
    text_en: 'If your plans are disrupted, do you first calm down and get back on track, or first deal with your emotions?',
    sliderLabels: { left: '回到正轨做事', right: '先处理情绪' },
    sliderLabels_en: { left: 'Get back on track', right: 'Deal with emotions first' } },

  { id: 38, type: 'slider', inQuick: false,
    text: '你至今会为你以前犯下的错误而感到困扰吗？',
    text_en: 'Do past mistakes still bother you today?',
    sliderLabels: { left: '完全不困扰', right: '非常困扰' },
    sliderLabels_en: { left: 'Not at all', right: 'Very much' } },

  { id: 39, type: 'yesno',  inQuick: false,
    text: '你对讨论未来世界的样子不感兴趣。',
    text_en: "You're not interested in discussing what the future world will look like." },

  { id: 40, type: 'slider', inQuick: false,
    text: '情绪控制你的程度远大于你控制情绪的程度。',
    text_en: 'Your emotions control you far more than you control them.',
    sliderLabels: { left: '被情绪控制', right: '自主控制情绪' },
    sliderLabels_en: { left: 'Controlled by emotion', right: 'I control my emotions' } },

  { id: 41, type: 'slider', inQuick: false,
    text: '做决定时，你更关注别人的感受，还是最合乎逻辑的有效做法？',
    text_en: "When deciding, do you focus on others' feelings or the most logical, effective approach?",
    sliderLabels: { left: '别人的感受', right: '合乎逻辑' },
    sliderLabels_en: { left: "Others' feelings", right: 'Logical approach' } },

  { id: 42, type: 'slider', inQuick: true,
    text: '你的个人风格接近于自发的精力爆发，还是有条不紊持之以恒的努力？',
    text_en: 'Is your style closer to spontaneous bursts of energy or steady, methodical effort?',
    sliderLabels: { left: '精力爆发', right: '持之以恒' },
    sliderLabels_en: { left: 'Bursts of energy', right: 'Steady effort' } },

  { id: 43, type: 'choice3', inQuick: false,
    text: '当别人看重你的时候，你会觉得开心被认可，还是害怕他们失望？',
    text_en: 'When others value you, do you feel happy to be recognized, or afraid of disappointing them?',
    choices: ['认可', '失望', '看情况'],
    choices_en: ['Recognized', 'Afraid of letdown', 'Depends'] },

  { id: 44, type: 'choice3', inQuick: true,
    text: '你会比较喜欢个人工作，而不是团体协作？',
    text_en: 'Do you prefer working alone over collaborating in a team?',
    choices: ['个人工作', '团体协作', '看情况'],
    choices_en: ['Work alone', 'Teamwork', 'Depends'] },

  { id: 45, type: 'yesno',  inQuick: false,
    text: '在你眼里思考抽象的哲学问题就是在浪费时间。',
    text_en: 'To you, pondering abstract philosophical questions is a waste of time.' },

  { id: 46, type: 'yesno',  inQuick: false,
    text: '你喜欢热闹繁华的氛围，而不是安静私密的地方。',
    text_en: 'You prefer lively, bustling settings over quiet, private places.' },

  { id: 47, type: 'choice3', inQuick: false,
    text: '你会一边做事情一边怀疑这件事是对的，还是认定的事情就不会改变？',
    text_en: "Do you doubt whether something's right while doing it, or stick firmly once you've decided?",
    choices: ['会有犹豫', '不会改变', '看环境'],
    choices_en: ['I have doubts', "Won't change", 'Depends'] },

  { id: 48, type: 'yesno',  inQuick: false,
    text: '你认为某个决定是正确的时候，会进一步收集更多证据去佐证你的行动吗？哪怕有可能证明是错的。',
    text_en: 'When you think a decision is right, do you gather more evidence to back it up—even if it might prove you wrong?' },

  { id: 49, type: 'yesno',  inQuick: false,
    text: '你经常会觉得压力巨大。',
    text_en: 'You often feel under enormous pressure.' },

  { id: 50, type: 'yesno',  inQuick: true,
    text: '你做事情几乎不会跳步骤？',
    text_en: 'You almost never skip steps when doing things.' },

  { id: 51, type: 'slider', inQuick: true,
    text: '你更喜欢提出创造性解决方案的任务，而不是遵循具体步骤的任务。',
    text_en: 'You prefer tasks that call for creative solutions over tasks that follow specific steps.',
    sliderLabels: { left: '具体步骤', right: '创新方案' },
    sliderLabels_en: { left: 'Specific steps', right: 'Creative solutions' } },

  { id: 52, type: 'slider', inQuick: true,
    text: '在做选择时，你倾向情感直觉还是逻辑推理？',
    text_en: 'When making choices, do you lean on emotional intuition or logical reasoning?',
    sliderLabels: { left: '情感直觉', right: '逻辑推理' },
    sliderLabels_en: { left: 'Emotional intuition', right: 'Logical reasoning' } },

  { id: 53, type: 'yesno',  inQuick: false,
    text: '你对自己时常充满信心，相信事情都会朝对你有利的方向发展。',
    text_en: "You're often full of confidence, believing things will work out in your favor." },
];

export const QUICK_QUESTIONS: MbtiQuestion[] = MBTI_QUESTIONS.filter((q) => q.inQuick);
export const FULL_QUESTIONS: MbtiQuestion[] = MBTI_QUESTIONS;

/**
 * 按当前语言返回题面与选项。英文模式下用 *_en 覆盖；缺省回退中文，保证不空。
 */
export function localizeQuestion(q: MbtiQuestion, lang: Language): MbtiQuestion {
  if (lang !== 'en') return q;
  return {
    ...q,
    text: q.text_en || q.text,
    yesnoLabels: q.yesnoLabels_en ?? q.yesnoLabels,
    sliderLabels: q.sliderLabels_en ?? q.sliderLabels,
    choices: q.choices_en ?? q.choices,
  };
}

// ---------- Answer encoding sent to backend ----------

export type AnswerValue =
  | { kind: 'yesno'; value: 'yes' | 'no' | 'neutral'; label: string }
  | { kind: 'slider'; value: number; min: 0; max: 5 }
  | { kind: 'choice3'; index: 0 | 1 | 2; label: string };

export interface MbtiAnswer {
  question_id: number;
  question_text: string;
  answer: AnswerValue;
}
