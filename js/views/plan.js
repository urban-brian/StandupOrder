// js/views/plan.js — Family plan view (approved plan only)

import { requireLogin } from '../auth.js';
import { load, getApprovedRecipes } from '../store.js';
import { getPlan, isPlanApproved, getRecipeForNight } from '../planner.js';
import { formatTime, spiceBadge } from '../recipes.js';
import { NIGHT_TYPES } from '../config.js';
import { setNav } from '../ui.js';

export async function render() {
  if (!requireLogin()) return;
  setNav('plan');

  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading plan…</p></div>`;

  await Promise.all([load('plan'), load('recipes')]);

  const plan = getPlan();

  if (!isPlanApproved() || !plan.nights || plan.nights.length === 0) {
    content.innerHTML = `
      <div class="page-title">This Week's Plan</div>
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <h3>No plan yet</h3>
        <p>The plan hasn't been approved yet. Check back soon!</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="page-title">This Week's Plan</div>
    <div class="page-subtitle" style="margin-bottom:16px;">${plan.week || ''}</div>
    <div class="stack">
  `;

  for (const night of plan.nights) {
    const recipe = getRecipeForNight(night);
    const typeInfo = NIGHT_TYPES[night.type] || {};

    html += `
      <div class="plan-night">
        <div class="plan-night-header">
          <span>${night.day} <span class="text-muted text-small">· ${night.date}</span></span>
          <span class="night-type-${night.type}">${typeInfo.emoji || ''} ${typeInfo.label || night.type}</span>
        </div>
        <div class="plan-night-recipe">
    `;

    if (recipe) {
      html += `
          <div class="recipe-card-name">${recipe.name}</div>
          <div class="recipe-meta" style="margin-top:6px;">
            ${recipe.total_time ? `<span class="meta-item">⏱ ${formatTime(recipe.total_time)}</span>` : ''}
            ${recipe.active_cook_time ? `<span class="meta-item">🔥 ${formatTime(recipe.active_cook_time)} active</span>` : ''}
            ${recipe.cuisine_type ? `<span class="meta-item">🌍 ${recipe.cuisine_type}</span>` : ''}
            ${recipe.spice_level ? `<span class="meta-item">${spiceBadge(recipe.spice_level)}</span>` : ''}
          </div>
          <div class="recipe-flags" style="margin-top:8px;">
            ${recipe.is_vegetarian ? '<span class="badge badge-green">🌿 Vegetarian</span>' : ''}
            ${recipe.is_fish ? '<span class="badge badge-sage">🐟 Fish</span>' : ''}
            ${recipe.is_pasta ? '<span class="badge badge-terracotta">🍝 Pasta</span>' : ''}
            ${recipe.make_ahead_potential ? '<span class="badge badge-yellow">⏰ Make Ahead</span>' : ''}
          </div>
          ${recipe.source_url ? `<a href="${recipe.source_url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-top:10px;">View Recipe ↗</a>` : ''}
          ${night.notes ? `<div class="text-small text-muted" style="margin-top:8px;">📝 ${night.notes}</div>` : ''}
      `;
    } else {
      html += `<div class="text-muted">TBD</div>`;
    }

    html += `</div></div>`;
  }

  html += `</div>`;

  // Cook once / prep ahead suggestions
  if (plan.cook_once_suggestions?.length || plan.prep_ahead_suggestions?.length) {
    html += `<div style="margin-top:24px;">`;

    if (plan.cook_once_suggestions?.length) {
      html += `
        <h3 style="margin-bottom:10px; font-family:var(--font-serif);">🔄 Cook Once, Use Twice</h3>
        <div class="stack-sm">
          ${plan.cook_once_suggestions.map(s =>
            `<div class="card card-accent"><div class="text-small">${s}</div></div>`
          ).join('')}
        </div>
      `;
    }

    if (plan.prep_ahead_suggestions?.length) {
      html += `
        <h3 style="margin-top:16px; margin-bottom:10px; font-family:var(--font-serif);">⏰ Prep Ahead</h3>
        <div class="stack-sm">
          ${plan.prep_ahead_suggestions.map(s =>
            `<div class="card card-accent"><div class="text-small">${s}</div></div>`
          ).join('')}
        </div>
      `;
    }

    html += `</div>`;
  }

  content.innerHTML = html;
}
