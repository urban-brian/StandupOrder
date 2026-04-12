// js/planner.js — Plan generation + approval

import { get, set, getCurrentPlan, getApprovedRecipes } from './store.js';
import { getCurrentVotes, getCurrentWeekLabel } from './votes.js';
import { generateWeeklyPlan } from './claude.js';
import { HISTORY_WEEKS } from './config.js';

export function getPlan() {
  return getCurrentPlan();
}

export function isPlanApproved() {
  return getCurrentPlan().status === 'approved';
}

// Generate plan using Claude
export async function createPlan(nights) {
  const recipes = getApprovedRecipes();
  const votes = getCurrentVotes();
  const history = get('history') || [];

  const generated = await generateWeeklyPlan({ recipes, votes, nights, history });

  const week = getCurrentWeekLabel();
  const plan = {
    week,
    status: 'draft',
    nights: generated.nights || nights.map(n => ({ ...n, recipe_id: null, notes: '' })),
    cook_once_suggestions: generated.cook_once_suggestions || [],
    prep_ahead_suggestions: generated.prep_ahead_suggestions || [],
    generated_at: new Date().toISOString(),
    approved_at: null,
  };

  set('plan', plan);
  return plan;
}

// Admin can manually assign a recipe to a night
export function assignRecipe(nightIndex, recipeId) {
  const plan = { ...getCurrentPlan() };
  plan.nights = plan.nights.map((n, i) =>
    i === nightIndex ? { ...n, recipe_id: recipeId } : n
  );
  set('plan', plan);
}

// Admin approves the plan
export function approvePlan() {
  const plan = { ...getCurrentPlan(), status: 'approved', approved_at: new Date().toISOString() };
  set('plan', plan);

  // Archive to history
  const history = [...(get('history') || [])];
  // Don't duplicate same week
  const existing = history.findIndex(h => h.week === plan.week);
  if (existing >= 0) {
    history[existing] = plan;
  } else {
    history.push(plan);
  }
  // Trim history
  set('history', history.slice(-HISTORY_WEEKS));

  return plan;
}

// Reset plan back to draft for re-generation
export function resetPlan() {
  const plan = { ...getCurrentPlan(), status: 'draft', approved_at: null };
  set('plan', plan);
}

// Build night objects from admin UI input
export function buildNights(nightConfigs) {
  // nightConfigs: [{day, date, type}]
  return nightConfigs.map(n => ({
    day: n.day,
    date: n.date,
    type: n.type || 'normal',
    recipe_id: null,
    notes: '',
  }));
}

// Get the recipe object for a given night
export function getRecipeForNight(night) {
  if (!night.recipe_id) return null;
  return getApprovedRecipes().find(r => r.id === night.recipe_id) || null;
}

// Get next 7 days starting from next Monday
export function getUpcomingWeekDays() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const daysUntilMon = (8 - dow) % 7 || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMon);

  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  return days.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      day,
      date: d.toISOString().slice(0, 10),
      type: 'normal',
    };
  });
}
