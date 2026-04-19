// js/config.js — App configuration & family member list

export const FAMILY_MEMBERS = [
  { name: 'Brian',  emoji: '👨‍🍳', admin: true },
  { name: 'Jess',   emoji: '👩‍🍳', admin: false },
  { name: 'Oliver', emoji: '🧒',   admin: false },
  { name: 'Mia',    emoji: '👧',   admin: false },
];

export const ADMIN_NAME = 'Brian';

export const DATA_FILES = {
  recipes:     'data/recipes.json',
  votes:       'data/votes.json',
  plan:        'data/plan.json',
  history:     'data/history.json',
  suggestions: 'data/suggestions.json',
};

export const CLAUDE_MODEL = 'claude-sonnet-4-6';

// Night type definitions
export const NIGHT_TYPES = {
  normal:  { label: 'Normal',  emoji: '🟢', desc: '45+ min active cook' },
  quick:   { label: 'Quick',   emoji: '🟡', desc: 'Under 45 min total' },
  minimal: { label: 'Minimal', emoji: '🔴', desc: 'Prep-ahead / minimal cooking' },
};

// Weekly hard constraints
export const CONSTRAINTS = {
  max_fish:      1,
  max_pasta:     1,
  min_vegetarian: 1,
};

// How many weeks of history to keep
export const HISTORY_WEEKS = 8;
