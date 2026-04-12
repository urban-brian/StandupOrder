// js/views/vote.js — Family voting view

import { requireLogin } from '../auth.js';
import { load } from '../store.js';
import { getApproved } from '../recipes.js';
import { isVotingOpen, castVote, getUserVote, getVoteTotals, getVoteState } from '../votes.js';
import { formatTime, spiceBadge } from '../recipes.js';
import { toast, setNav } from '../ui.js';
import { navigate } from '../router.js';

export async function render() {
  if (!requireLogin()) return;
  setNav('vote');

  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading recipes…</p></div>`;

  await Promise.all([load('recipes'), load('votes')]);

  const open = isVotingOpen();
  const recipes = getApproved();
  const voteState = getVoteState();

  let html = `
    <div class="page-title">This Week's Recipes</div>
    <div class="page-subtitle">${voteState.week || ''}</div>
  `;

  if (!open) {
    html += `
      <div class="card" style="margin: 12px 0; background: #FFF9F0; border-color: var(--border-dk);">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.4rem;">🗳️</span>
          <div>
            <strong>Voting is closed</strong>
            <div class="text-small text-muted">Check back when the admin opens voting for the week.</div>
          </div>
        </div>
      </div>
    `;
  }

  if (recipes.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">🥘</div>
        <h3>No recipes yet</h3>
        <p>The admin hasn't added any recipes. Check back soon!</p>
      </div>
    `;
  } else {
    html += `<div class="stack" id="recipe-vote-list">`;
    for (const r of recipes) {
      const myVote = getUserVote(r.id);
      const totals = getVoteTotals(r.id);
      const total = totals.thumbs_up + totals.thumbs_down + totals.neutral;
      const pct = total > 0 ? Math.round((totals.thumbs_up / total) * 100) : 0;

      html += `
        <div class="vote-card ${myVote === 'thumbs_up' ? 'voted-up' : myVote === 'thumbs_down' ? 'voted-down' : ''}"
             data-id="${r.id}">
          <div class="recipe-card-name">${r.name}</div>
          <div class="recipe-meta">
            ${r.total_time ? `<span class="meta-item">⏱ ${formatTime(r.total_time)}</span>` : ''}
            ${r.cuisine_type ? `<span class="meta-item">🌍 ${r.cuisine_type}</span>` : ''}
            ${r.spice_level ? `<span class="meta-item">${spiceBadge(r.spice_level)}</span>` : ''}
          </div>
          <div class="recipe-flags">
            ${r.is_vegetarian ? '<span class="badge badge-green">🌿 Vegetarian</span>' : ''}
            ${r.is_fish ? '<span class="badge badge-sage">🐟 Fish</span>' : ''}
            ${r.is_pasta ? '<span class="badge badge-terracotta">🍝 Pasta</span>' : ''}
            ${r.make_ahead_potential ? '<span class="badge badge-yellow">⏰ Make Ahead</span>' : ''}
          </div>
          ${r.description ? `<div class="text-small text-muted" style="margin-top:8px;font-style:italic;">${r.description}</div>` : ''}

          <div class="vote-bar" style="margin-top:10px;">
            <div class="vote-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="row-between" style="margin-top:4px; font-size:.75rem; color:var(--text-muted);">
            <span>${totals.thumbs_up} up · ${totals.thumbs_down} down · ${totals.neutral} neutral</span>
            ${total > 0 ? `<span>${pct}% positive</span>` : ''}
          </div>

          ${open ? `
          <div class="vote-buttons">
            <button class="vote-btn ${myVote === 'thumbs_up' ? 'active-up' : ''}" data-vote="thumbs_up" data-rid="${r.id}">
              👍 <span class="vote-count">${totals.thumbs_up}</span>
            </button>
            <button class="vote-btn ${myVote === 'neutral' ? 'active-neutral' : ''}" data-vote="neutral" data-rid="${r.id}">
              😐 <span class="vote-count">${totals.neutral}</span>
            </button>
            <button class="vote-btn ${myVote === 'thumbs_down' ? 'active-down' : ''}" data-vote="thumbs_down" data-rid="${r.id}">
              👎 <span class="vote-count">${totals.thumbs_down}</span>
            </button>
          </div>
          ` : ''}
        </div>
      `;
    }
    html += `</div>`;
  }

  content.innerHTML = html;

  // Vote button handlers
  if (open) {
    content.querySelectorAll('[data-vote]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rid = btn.dataset.rid;
        const type = btn.dataset.vote;
        castVote(rid, type);
        toast('Vote saved!');
        render(); // re-render to update
      });
    });
  }
}
