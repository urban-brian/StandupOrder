// js/views/admin-plan.js — Set nights, generate plan, approve

import { requireAdmin } from '../auth.js';
import { load, getApprovedRecipes } from '../store.js';
import { getPlan, isPlanApproved, createPlan, approvePlan, resetPlan, assignRecipe, getUpcomingWeekDays } from '../planner.js';
import { NIGHT_TYPES } from '../config.js';
import { formatTime } from '../recipes.js';
import { commitSession } from '../store.js';
import { toast, setNav } from '../ui.js';

let nights = [];
let viewMode = 'setup'; // 'setup' | 'review'

export async function render() {
  if (!requireAdmin()) return;
  setNav('admin');

  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  await Promise.all([load('plan'), load('recipes'), load('votes'), load('history')]);

  const plan = getPlan();
  if (plan.status === 'draft' && plan.nights?.length > 0) {
    viewMode = 'review';
    nights = plan.nights;
  } else if (plan.status === 'approved') {
    viewMode = 'review';
    nights = plan.nights;
  } else {
    viewMode = 'setup';
    nights = getUpcomingWeekDays();
  }

  renderContent(content);
}

function renderContent(content) {
  const plan = getPlan();
  const approved = isPlanApproved();

  let html = `
    <div class="section-header">
      <div class="page-title" style="padding:0;">Weekly Plan</div>
      ${approved ? '<span class="badge badge-green">✓ Approved</span>' : plan.status === 'draft' ? '<span class="badge badge-yellow">Draft</span>' : ''}
    </div>
  `;

  if (viewMode === 'setup') {
    html += renderSetup();
  } else {
    html += renderReview(plan);
  }

  content.innerHTML = html;
  bindEvents(content);
}

function renderSetup() {
  const days = getUpcomingWeekDays();
  const checked = new Set(nights.map(n => n.day));

  let html = `
    <div class="card" style="margin-bottom:16px;">
      <strong>Select nights to plan</strong>
      <div class="text-small text-muted" style="margin-top:4px;">Check the nights and set a cooking mode for each.</div>
    </div>
    <div class="stack" id="nights-list">
  `;

  for (const day of days) {
    const night = nights.find(n => n.day === day.day) || day;
    html += `
      <div class="night-row" data-day="${day.day}">
        <input type="checkbox" id="chk-${day.day}" ${checked.has(day.day) ? 'checked' : ''}
               style="width:18px;height:18px;accent-color:var(--primary);">
        <label for="chk-${day.day}" style="flex:1;cursor:pointer;">
          <strong>${day.day}</strong>
          <span class="text-small text-muted"> · ${day.date}</span>
        </label>
        <div class="night-type-toggle">
          ${Object.entries(NIGHT_TYPES).map(([type, info]) => `
            <button class="night-type-btn ${night.type === type ? 'active' : ''}"
                    data-type="${type}" data-day="${day.day}"
                    title="${info.label}: ${info.desc}">
              ${info.emoji}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  html += `
    </div>
    <button class="btn btn-primary btn-full" id="generate-btn" style="margin-top:20px;">
      ✨ Generate Plan with Claude
    </button>
    <div class="text-small text-muted text-center" style="margin-top:8px;">
      Claude will suggest meals based on votes and constraints
    </div>
  `;
  return html;
}

function renderReview(plan) {
  const recipes = getApprovedRecipes();
  const approved = isPlanApproved();

  let html = `
    <div class="stack" id="plan-nights">
  `;

  for (let i = 0; i < plan.nights.length; i++) {
    const night = plan.nights[i];
    const recipe = recipes.find(r => r.id === night.recipe_id);
    const typeInfo = NIGHT_TYPES[night.type] || {};

    html += `
      <div class="plan-night">
        <div class="plan-night-header">
          <span>${night.day} <span class="text-muted text-small">· ${night.date}</span></span>
          <span class="night-type-${night.type}">${typeInfo.emoji} ${typeInfo.label}</span>
        </div>
        <div class="plan-night-recipe">
    `;

    if (recipe) {
      html += `
          <div class="recipe-card-name">${recipe.name}</div>
          <div class="recipe-meta" style="margin-top:4px;">
            ${recipe.total_time ? `<span class="meta-item">⏱ ${formatTime(recipe.total_time)}</span>` : ''}
            ${recipe.cuisine_type ? `<span class="meta-item">🌍 ${recipe.cuisine_type}</span>` : ''}
          </div>
      `;
    } else {
      html += `<div class="text-muted text-small">No recipe assigned</div>`;
    }

    if (!approved) {
      html += `
          <div class="form-group" style="margin-top:10px;">
            <select class="form-select assign-select" data-night="${i}">
              <option value="">— Change recipe —</option>
              ${recipes.map(r => `
                <option value="${r.id}" ${r.id === night.recipe_id ? 'selected' : ''}>
                  ${r.name} (${formatTime(r.total_time)})
                </option>
              `).join('')}
            </select>
          </div>
      `;
    }

    html += `</div></div>`;
  }

  html += `</div>`;

  // Suggestions
  if (plan.cook_once_suggestions?.length || plan.prep_ahead_suggestions?.length) {
    if (plan.cook_once_suggestions?.length) {
      html += `
        <h3 style="margin:20px 0 10px; font-family:var(--font-serif);">🔄 Cook Once, Use Twice</h3>
        <div class="stack-sm">
          ${plan.cook_once_suggestions.map(s => `<div class="card card-accent text-small">${s}</div>`).join('')}
        </div>
      `;
    }
    if (plan.prep_ahead_suggestions?.length) {
      html += `
        <h3 style="margin:16px 0 10px; font-family:var(--font-serif);">⏰ Prep Ahead</h3>
        <div class="stack-sm">
          ${plan.prep_ahead_suggestions.map(s => `<div class="card card-accent text-small">${s}</div>`).join('')}
        </div>
      `;
    }
  }

  // Actions
  if (!approved) {
    html += `
      <div class="stack" style="margin-top:20px;">
        <button class="btn btn-accent btn-full" id="approve-btn">✓ Approve Plan for Family</button>
        <button class="btn btn-ghost btn-full" id="regenerate-btn">↺ Regenerate with Claude</button>
        <button class="btn btn-ghost btn-full" id="back-setup-btn">← Back to Setup</button>
      </div>
    `;
  } else {
    html += `
      <div class="stack" style="margin-top:20px;">
        <div class="card" style="background:#F0FBF4; border-color:var(--success); text-align:center;">
          <strong style="color:var(--success);">✓ Plan is approved and visible to the family</strong>
          <div class="text-small text-muted" style="margin-top:4px;">
            Approved ${new Date(plan.approved_at).toLocaleDateString()}
          </div>
        </div>
        <button class="btn btn-ghost btn-full" id="reset-plan-btn">Reset & Regenerate</button>
      </div>
    `;
  }

  return html;
}

function bindEvents(content) {
  // Night checkboxes
  content.querySelectorAll('.night-row input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', () => {
      const day = chk.id.replace('chk-', '');
      if (chk.checked) {
        if (!nights.find(n => n.day === day)) {
          const dayData = getUpcomingWeekDays().find(d => d.day === day);
          nights.push(dayData || { day, date: '', type: 'normal' });
        }
      } else {
        nights = nights.filter(n => n.day !== day);
      }
    });
  });

  // Night type buttons
  content.querySelectorAll('.night-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = btn.dataset.day;
      const type = btn.dataset.type;
      nights = nights.map(n => n.day === day ? { ...n, type } : n);
      // Update button UI
      btn.closest('.night-type-toggle').querySelectorAll('.night-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Generate plan
  document.getElementById('generate-btn')?.addEventListener('click', async () => {
    const selected = nights.filter((_, i) => {
      const day = nights[i]?.day;
      const chk = document.getElementById(`chk-${day}`);
      return !chk || chk.checked;
    });

    if (selected.length === 0) {
      toast('Select at least one night.', 'error');
      return;
    }

    const btn = document.getElementById('generate-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Generating…';

    try {
      await createPlan(nights.filter(n => {
        const chk = document.getElementById(`chk-${n.day}`);
        return !chk || chk.checked;
      }));
      viewMode = 'review';
      renderContent(content);
      toast('Plan generated!', 'success');
    } catch (e) {
      toast(`Generation failed: ${e.message}`, 'error');
      btn.disabled = false;
      btn.textContent = '✨ Generate Plan with Claude';
    }
  });

  // Assign recipe dropdowns
  content.querySelectorAll('.assign-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = parseInt(sel.dataset.night);
      assignRecipe(i, sel.value || null);
    });
  });

  // Approve
  document.getElementById('approve-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('approve-btn');
    btn.disabled = true;
    btn.textContent = 'Approving…';
    try {
      approvePlan();
      await commitSession('approve weekly plan');
      toast('Plan approved!', 'success');
      renderContent(content);
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false;
      btn.textContent = '✓ Approve Plan for Family';
    }
  });

  // Regenerate
  document.getElementById('regenerate-btn')?.addEventListener('click', () => {
    resetPlan();
    viewMode = 'setup';
    renderContent(content);
  });

  document.getElementById('back-setup-btn')?.addEventListener('click', () => {
    viewMode = 'setup';
    renderContent(content);
  });

  // Reset approved plan
  document.getElementById('reset-plan-btn')?.addEventListener('click', async () => {
    if (!confirm('This will un-approve the plan and hide it from the family. Continue?')) return;
    resetPlan();
    await commitSession('reset plan');
    viewMode = 'setup';
    renderContent(content);
  });
}
