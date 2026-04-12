// js/suggestions.js — Family meal suggestions

import { get, set } from './store.js';
import { getCurrentUser } from './auth.js';

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() :
    Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getSuggestions() {
  return get('suggestions') || [];
}

export function addSuggestion(text) {
  const user = getCurrentUser();
  if (!text.trim()) return;
  const suggestion = {
    id: uuid(),
    submitted_by: user,
    submitted_at: new Date().toISOString(),
    text: text.trim(),
    status: 'pending',
  };
  const suggestions = [...getSuggestions(), suggestion];
  set('suggestions', suggestions);
  return suggestion;
}

export function markReviewed(id) {
  const suggestions = getSuggestions().map(s =>
    s.id === id ? { ...s, status: 'reviewed' } : s
  );
  set('suggestions', suggestions);
}

export function deleteSuggestion(id) {
  set('suggestions', getSuggestions().filter(s => s.id !== id));
}
