/**
 * BookMirror MBTI 题库
 *
 * 53 题完整测评 + 20 题快速测评（`inQuick: true` 标记）。
 *
 * 题型：
 *  - 'yesno'   → 三按钮（是 / 否 / 看情况），custom labels via yesnoLabels
 *  - 'slider'  → 0–5 游标卡尺，可选 leftLabel / rightLabel
 *  - 'choice3' → 三个自定义选项按钮
 *
 * 评分：不在客户端做。前端把"题目原文 + 用户答案"打包丢给后端 /api/mbti，
 * 由 Claude 推断 4 字母 MBTI，返回 { mbti, confidence, reasoning }。
 */

export type MbtiQuestionType = 'yesno' | 'slider' | 'choice3';

export interface MbtiQuestion {
  id: number;
  text: string;
  type: MbtiQuestionType;
  /** Override the default 是 / 否 / 看情况 labels (yesno only). */
  yesnoLabels?: { yes: string; no: string; neutral: string };
  /** Optional left/right anchors for 0–5 slider. */
  sliderLabels?: { left: string; right: string };
  /** 3 custom button labels (choice3 only). */
  choices?: [string, string, string];
  /** Included in the 20-question quick test. */
  inQuick: boolean;
}

export const MBTI_QUESTIONS: MbtiQuestion[] = [
  { id: 1,  type: 'yesno',  inQuick: true,
    text: '你经常结交新朋友吗？',
    yesnoLabels: { yes: '是', no: '否', neutral: '看环境需要' } },

  { id: 2,  type: 'slider', inQuick: true,
    text: '复杂新颖的想法比简单直接的想法更能激发你的兴趣？',
    sliderLabels: { left: '完全不会', right: '非常激发' } },

  { id: 3,  type: 'slider', inQuick: true,
    text: '你更容易被那些引起情感共鸣的事物所说服，而不是理性的事实论据。',
    sliderLabels: { left: '完全不会', right: '完全会' } },

  { id: 4,  type: 'yesno',  inQuick: true,
    text: '你的生活空间是干净整洁的。' },

  { id: 5,  type: 'slider', inQuick: false,
    text: '即使在压力很大的情况下，你通常也能保持冷静。',
    sliderLabels: { left: '完全做不到', right: '完全可以' } },

  { id: 6,  type: 'slider', inQuick: false,
    text: '你觉得与陌生人建立人脉或像商品一般推销自己是一件非常害怕的事情。',
    sliderLabels: { left: '一点不怕', right: '非常害怕' } },

  { id: 7,  type: 'yesno',  inQuick: true,
    text: '你能够有效地安排好任务的优先级并且做好计划，一般都能在截止日期前完成。' },

  { id: 8,  type: 'yesno',  inQuick: false,
    text: '你认为人们的故事和情感比数字或数据更有说服力吗？' },

  { id: 9,  type: 'yesno',  inQuick: false,
    text: '即使是微小的错误也会让你怀疑自己的整体能力和知识水平。' },

  { id: 10, type: 'slider', inQuick: false,
    text: '你对艺术作品的各种解读与讨论感兴趣吗？',
    sliderLabels: { left: '完全不感兴趣', right: '非常感兴趣' } },

  { id: 11, type: 'slider', inQuick: true,
    text: '在决定行动方案时，你更注重事实还是人们的感受？',
    sliderLabels: { left: '事实', right: '感受' } },

  { id: 12, type: 'yesno',  inQuick: true,
    text: '你会允许自己一天顺其自然、没有计划地展开吗？' },

  { id: 13, type: 'slider', inQuick: false,
    text: '你很少担心自己给遇到的人留下坏印象？',
    sliderLabels: { left: '经常担心', right: '从不担心' } },

  { id: 14, type: 'choice3', inQuick: true,
    text: '你休闲的时候喜欢参加团队活动还是个人独处？',
    choices: ['团队活动', '个人独处', '看情况'] },

  { id: 15, type: 'yesno',  inQuick: true,
    text: '你喜欢尝试新的、未经试验的方法吗？' },

  { id: 16, type: 'slider', inQuick: false,
    text: '你会更注重情绪和精神，还是实际行动与诚实？',
    sliderLabels: { left: '情绪与精神', right: '行动与诚实' } },

  { id: 17, type: 'slider', inQuick: false,
    text: '你会担心当下做的事情逐渐恶化吗？',
    sliderLabels: { left: '完全不会', right: '非常担心' } },

  { id: 18, type: 'slider', inQuick: true,
    text: '你做事情更注重效率，还是更注重情感？',
    sliderLabels: { left: '效率', right: '情感' } },

  { id: 19, type: 'slider', inQuick: false,
    text: '你有想过自己以写小说为生吗？',
    sliderLabels: { left: '完全没有', right: '经常想' } },

  { id: 20, type: 'slider', inQuick: true,
    text: '在意见分歧时，你会优先考虑证明自己的观点，还是顾及他人的感受？',
    sliderLabels: { left: '证明观点', right: '顾及感受' } },

  { id: 21, type: 'yesno',  inQuick: true,
    text: '在社交聚会上，你通常会等待别人先自我介绍吗？' },

  { id: 22, type: 'slider', inQuick: false,
    text: '你的情绪变化快吗？',
    sliderLabels: { left: '非常稳定', right: '非常快变' } },

  { id: 23, type: 'slider', inQuick: false,
    text: '你不容易被情绪化的论点所左右？',
    sliderLabels: { left: '非常容易', right: '完全不会' } },

  { id: 24, type: 'yesno',  inQuick: true,
    text: '你经常在最后一刻才去做事情。' },

  { id: 25, type: 'yesno',  inQuick: false,
    text: '你喜欢探讨伦理困境？' },

  { id: 26, type: 'yesno',  inQuick: true,
    text: '当讨论变得逐渐理论化的时候，你会感觉无趣。' },

  { id: 27, type: 'slider', inQuick: false,
    text: '当事实与感受发生冲突的时候，你通常会偏向哪一边？',
    sliderLabels: { left: '事实', right: '自己的感受' } },

  { id: 28, type: 'slider', inQuick: false,
    text: '你觉得保持规律的学习和自律很困难。',
    sliderLabels: { left: '一点不难', right: '非常困难' } },

  { id: 29, type: 'slider', inQuick: false,
    text: '你很少质疑自己做出的选择？',
    sliderLabels: { left: '经常质疑', right: '从不质疑' } },

  { id: 30, type: 'slider', inQuick: true,
    text: '朋友会说你较为开朗还是较为内敛？',
    sliderLabels: { left: '开朗', right: '内敛' } },

  { id: 31, type: 'slider', inQuick: false,
    text: '你对各种创意表达很感兴趣，例如写作、自我 DIY 等等。',
    sliderLabels: { left: '完全不感兴趣', right: '非常感兴趣' } },

  { id: 32, type: 'slider', inQuick: false,
    text: '你通常会根据客观事实而不是情感印象做选择。',
    sliderLabels: { left: '凭情感印象', right: '凭客观事实' } },

  { id: 33, type: 'yesno',  inQuick: true,
    text: '你喜欢给自己列一个待办清单吗？' },

  { id: 34, type: 'slider', inQuick: false,
    text: '你会感觉自己没有安全感吗？',
    sliderLabels: { left: '非常安全', right: '完全没安全感' } },

  { id: 35, type: 'yesno',  inQuick: false,
    text: '你尽量避免打电话吗？',
    yesnoLabels: { yes: '是', no: '否', neutral: '看心情' } },

  { id: 36, type: 'slider', inQuick: true,
    text: '你喜欢探索自己不熟悉的想法和观点吗？',
    sliderLabels: { left: '完全不喜欢', right: '非常喜欢' } },

  { id: 37, type: 'slider', inQuick: false,
    text: '如果你的计划被打乱了，你会先让自己冷静回到正轨做事情？还是先处理好自己的情绪？',
    sliderLabels: { left: '回到正轨做事', right: '先处理情绪' } },

  { id: 38, type: 'slider', inQuick: false,
    text: '你至今会为你以前犯下的错误而感到困扰吗？',
    sliderLabels: { left: '完全不困扰', right: '非常困扰' } },

  { id: 39, type: 'yesno',  inQuick: false,
    text: '你对讨论未来世界的样子不感兴趣。' },

  { id: 40, type: 'slider', inQuick: false,
    text: '情绪控制你的程度远大于你控制情绪的程度。',
    sliderLabels: { left: '被情绪控制', right: '自主控制情绪' } },

  { id: 41, type: 'slider', inQuick: false,
    text: '做决定时，你更关注别人的感受，还是最合乎逻辑的有效做法？',
    sliderLabels: { left: '别人的感受', right: '合乎逻辑' } },

  { id: 42, type: 'slider', inQuick: true,
    text: '你的个人风格接近于自发的精力爆发，还是有条不紊持之以恒的努力？',
    sliderLabels: { left: '精力爆发', right: '持之以恒' } },

  { id: 43, type: 'choice3', inQuick: false,
    text: '当别人看重你的时候，你会觉得开心被认可，还是害怕他们失望？',
    choices: ['认可', '失望', '看情况'] },

  { id: 44, type: 'choice3', inQuick: true,
    text: '你会比较喜欢个人工作，而不是团体协作？',
    choices: ['个人工作', '团体协作', '看情况'] },

  { id: 45, type: 'yesno',  inQuick: false,
    text: '在你眼里思考抽象的哲学问题就是在浪费时间。' },

  { id: 46, type: 'yesno',  inQuick: false,
    text: '你喜欢热闹繁华的氛围，而不是安静私密的地方。' },

  { id: 47, type: 'choice3', inQuick: false,
    text: '你会一边做事情一边怀疑这件事是对的，还是认定的事情就不会改变？',
    choices: ['会有犹豫', '不会改变', '看环境'] },

  { id: 48, type: 'yesno',  inQuick: false,
    text: '你认为某个决定是正确的时候，会进一步收集更多证据去佐证你的行动吗？哪怕有可能证明是错的。' },

  { id: 49, type: 'yesno',  inQuick: false,
    text: '你经常会觉得压力巨大。' },

  { id: 50, type: 'yesno',  inQuick: true,
    text: '你做事情几乎不会跳步骤？' },

  { id: 51, type: 'slider', inQuick: true,
    text: '你更喜欢提出创造性解决方案的任务，而不是遵循具体步骤的任务。',
    sliderLabels: { left: '具体步骤', right: '创新方案' } },

  { id: 52, type: 'slider', inQuick: true,
    text: '在做选择时，你倾向情感直觉还是逻辑推理？',
    sliderLabels: { left: '情感直觉', right: '逻辑推理' } },

  { id: 53, type: 'yesno',  inQuick: false,
    text: '你对自己时常充满信心，相信事情都会朝对你有利的方向发展。' },
];

export const QUICK_QUESTIONS: MbtiQuestion[] = MBTI_QUESTIONS.filter((q) => q.inQuick);
export const FULL_QUESTIONS: MbtiQuestion[] = MBTI_QUESTIONS;

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
