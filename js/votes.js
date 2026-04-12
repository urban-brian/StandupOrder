// js/votes.js — Voting logic

import { get, set, getCurrentVotes } from './store.js';
import { getCurrentUser, isAdmin } from './auth.js';

export function getVoteState() {
  return getCurrentVotes();
}

export function isVotingOpen() {
  return !!getCurrentVotes().is_open;
}

export function openVoting(weekLabel) {
  set('votes', {
    week: weekLabel || getCurrentWeekLabel(),
    is_open: true,
    opened_at: new Date().toISOString(),
    closed_at: null,
    votes: {},
  });
}

export function closeVoting() {
  const v = getCurrentVotes();
  set('votes', { ...v, is_open: false, closed_at: new Date().toISOString() });
}

export function castVote(recipeId, type) {
  // type: 'thumbs_up' | 'thumbs_down' | 'neutral'
  const user = getCurrentUser();
  if (!user) return;
  const v = { ...getCurrentVotes() };
  if (!v.votes) v.votes = {};
  if (!v.votes[recipeId]) v.votes[recipeId] = { thumbs_up: 0, thumbs_down: 0, neutral: 0, voters: [] };

  const entry = { ...v.votes[recipeId] };
  const voters = entry.voters || [];

  // Remove previous vote from this user
  const prev = voters.find(x => x.name === user);
  if (prev) {
    entry[prev.type] = Math.max(0, (entry[prev.type] || 0) - 1);
    entry.voters = voters.filter(x => x.name !== user);
  }

  // Add new vote (allow toggling off)
  if (!prev || prev.type !== type) {
    entry[type] = (entry[type] || 0) + 1;
    entry.voters = [...(entry.voters || []), { name: user, type }];
  }

  v.votes[recipeId] = entry;
  set('votes', v);
}

export function getUserVote(recipeId) {
  const user = getCurrentUser();
  const v = getCurrentVotes();
  const entry = v.votes?.[recipeId];
  if (!entry) return null;
  const voter = (entry.voters || []).find(x => x.name === user);
  return voter?.type || null;
}

export function getVoteTotals(recipeId) {
  const v = getCurrentVotes();
  const entry = v.votes?.[recipeId];
  if (!entry) return { thumbs_up: 0, thumbs_down: 0, neutral: 0 };
  return {
    thumbs_up: entry.thumbs_up || 0,
    thumbs_down: entry.thumbs_down || 0,
    neutral: entry.neutral || 0,
  };
}

// Admin only — full vote breakdown including who voted
export function getFullVoteBreakdown(recipeId) {
  if (!isAdmin()) return null;
  const v = getCurrentVotes();
  return v.votes?.[recipeId] || null;
}

export function getVoteScore(recipeId) {
  const { thumbs_up, thumbs_down } = getVoteTotals(recipeId);
  return (thumbs_up * 2) - (thumbs_down * 2);
}

export function getCurrentWeekLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
