// js/views/admin-dashboard.js — Admin home

import { requireAdmin } from '../auth.js';
import { load, get, getApprovedRecipes } from '../store.js';
import { isVotingOpen, getCurrentWeekLabel } from '../votes.js';
import { isPlanApproved } from '../planner.js';
import { getSuggestions } from '../suggestions.js';
import { navigate } from '../router.js';
import { setNav } from '../ui.js';

export async function render() {
  if (!requireAdmin()) return;
  setNav('admin');

  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  await Promise.all([
    load('recipes'), load('votes'), load('plan'), load('suggestions')
  ]);

  const recipes = get('recipes') || [];
  const approved = getApprovedRecipes();
  const pending = recipes.filter(r => !r.approved);
  const votingOpen = isVotingOpen();
  const planApproved = isPlanApproved();
  const suggestions = getSuggestions().filter(s => s.status === 'pending');

  const week = getCurrentWeekLabel();

  content.innerHTML = `
    <div class="page-title">Admin Dashboard</div>
    <div class="page-subtitle" style="margin-bottom:20px;">${week}</div>

    <div class="stack">
      <!-- Status cards -->
      <div class="admin-grid">
        <div class="card" style="text-align:center;">
          <div style="font-size:1.8rem; font-family:var(--font-serif); color:var(--primary);">${approved.length}</div>
          <div class="text-small text-muted">Approved Recipes</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:1.8rem; font-family:var(--font-serif); color:var(--warn);">${pending.length}</div>
          <div class="text-small text-muted">Awaiting Review</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:1.5rem;">${votingOpen ? '🟢' : '⭕'}</div>
          <div class="text-small text-muted">${votingOpen ? 'Voting Open' : 'Voting Closed'}</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:1.5rem;">${planApproved ? '✅' : '📋'}</div>
          <div class="text-small text-muted">${planApproved ? 'Plan Approved' : 'Plan Pending'}</div>
        </div>
      </div>

      <!-- Quick actions -->
      <h3 style="font-family:var(--font-serif); margin-top:8px;">Quick Actions</h3>

      <a href="#/admin/upload" class="card" style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;">
        <span style="font-size:1.6rem;">📄</span>
        <div>
          <strong>Upload Recipes</strong>
          <div class="text-small text-muted">Add PDFs or enter recipes manually</div>
        </div>
        <span style="margin-left:auto; color:var(--text-muted);">›</span>
      </a>

      <a href="#/admin/sync" class="card" style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;">
        <span style="font-size:1.6rem;">🔄</span>
        <div>
          <strong>Sync Recipes</strong>
          <div class="text-small text-muted">Import latest from NYT Cooking</div>
        </div>
        <span style="margin-left:auto; color:var(--text-muted);">›</span>
      </a>

      <a href="#/admin/recipes" class="card" style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;">
        <span style="font-size:1.6rem;">📚</span>
        <div>
          <strong>Manage Recipes</strong>
          <div class="text-small text-muted">${pending.length > 0 ? `${pending.length} pending review` : `${approved.length} approved`}</div>
        </div>
        <span style="margin-left:auto; color:var(--text-muted);">›</span>
      </a>

      <a href="#/admin/vote" class="card" style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;">
        <span style="font-size:1.6rem;">🗳️</span>
        <div>
          <strong>Manage Voting</strong>
          <div class="text-small text-muted">${votingOpen ? 'Voting is open' : 'Open voting for this week'}</div>
        </div>
        <span style="margin-left:auto; color:var(--text-muted);">›</span>
      </a>

      <a href="#/admin/plan" class="card" style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;">
        <span style="font-size:1.6rem;">🗓️</span>
        <div>
          <strong>Generate Plan</strong>
          <div class="text-small text-muted">${planApproved ? 'Plan approved — view or regenerate' : 'Set nights and generate this week\'s plan'}</div>
        </div>
        <span style="margin-left:auto; color:var(--text-muted);">›</span>
      </a>

      ${suggestions.length > 0 ? `
        <a href="#/admin/suggestions" class="card" style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit; border-color:var(--warn);">
          <span style="font-size:1.6rem;">💬</span>
          <div>
            <strong>Family Suggestions</strong>
            <div class="text-small text-muted">${suggestions.length} new suggestion${suggestions.length !== 1 ? 's' : ''}</div>
          </div>
          <span style="margin-left:auto; color:var(--text-muted);">›</span>
        </a>
      ` : ''}

      <a href="#/settings" class="card" style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;">
        <span style="font-size:1.6rem;">⚙️</span>
        <div>
          <strong>Settings</strong>
          <div class="text-small text-muted">GitLab token, Claude API key</div>
        </div>
        <span style="margin-left:auto; color:var(--text-muted);">›</span>
      </a>
    </div>
  `;
}
