// Keep in sync with backend/app/data/tags.py

export const GOAL_KEYS = [
  'expression',
  'emotion',
  'career',
  'power',
  'relationship',
  'learning',
  'finance',
  'romance',
  'self_discipline',
] as const;

export const PREFERENCE_KEYS = [
  'novel',
  'non_fiction',
  'history',
  'psychology',
  'business',
  'philosophy',
  'biography',
] as const;

export const PROBLEM_KEYS = [
  'overthinking',
  'low_execution',
  'people_pleasing',
  'poor_expression',
  'idealism',
  'procrastination',
  'anxiety',
  'no_action',
] as const;

export type GoalKey = (typeof GOAL_KEYS)[number];
export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];
export type ProblemKey = (typeof PROBLEM_KEYS)[number];
