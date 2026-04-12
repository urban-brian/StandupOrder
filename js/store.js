// js/store.js — In-memory data store with dirty tracking + batch commit

import { readJSON, commitMultiple } from './api.js';
import { DATA_FILES } from './config.js';

const state = {
  recipes:     null,
  votes:       null,
  plan:        null,
  history:     null,
  suggestions: null,
};

const dirty = new Set();
let loading = {};

// --- Load data ---
export async function load(key) {
  if (state[key] !== null) return state[key];
  if (loading[key]) return loading[key];

  loading[key] = readJSON(DATA_FILES[key]).then(data => {
    state[key] = data ?? defaultFor(key);
    loading[key] = null;
    return state[key];
  });
  return loading[key];
}

export async function loadAll() {
  await Promise.all(Object.keys(DATA_FILES).map(load));
}

function defaultFor(key) {
  switch (key) {
    case 'recipes':     return [];
    case 'votes':       return { week: null, is_open: false, votes: {} };
    case 'plan':        return { week: null, status: 'none', nights: [] };
    case 'history':     return [];
    case 'suggestions': return [];
    default:            return null;
  }
}

// --- Get data ---
export function get(key) {
  return state[key];
}

// --- Mutate data (marks dirty) ---
export function set(key, value) {
  state[key] = value;
  dirty.add(key);
}

export function update(key, updater) {
  const current = state[key];
  const updated = updater(current);
  set(key, updated);
  return updated;
}

export function isDirty() {
  return dirty.size > 0;
}

// --- Commit all dirty files in one batch ---
export async function commitSession(message) {
  if (dirty.size === 0) return;
  const files = Array.from(dirty).map(key => ({
    path: DATA_FILES[key],
    content: state[key],
  }));
  const msg = message || `meal planner: save session ${new Date().toISOString().slice(0, 10)}`;
  await commitMultiple(files, msg);
  dirty.clear();
}

// --- Force reload a key from remote ---
export async function reload(key) {
  state[key] = null;
  return load(key);
}

// --- Helpers for recipes ---
export function getRecipes() { return state.recipes || []; }
export function getApprovedRecipes() { return (state.recipes || []).filter(r => r.approved); }
export function getRecipeById(id) { return (state.recipes || []).find(r => r.id === id); }

// --- Helpers for votes ---
export function getCurrentVotes() { return state.votes || { week: null, is_open: false, votes: {} }; }

// --- Helpers for plan ---
export function getCurrentPlan() { return state.plan || { week: null, status: 'none', nights: [] }; }
