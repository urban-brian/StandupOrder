// js/views/admin-vote.js — Manage voting (open/close, full breakdown)

import { requireAdmin } from '../auth.js';
import { load, get } from '../store.js';
import { getApproved } from '../recipes.js';
import {
  isVotingOpen, openVoting, closeVoting,
  getVoteState, getVoteTotals, getFullVoteBreakdown,
  getCurrentWeekLabel
} from '../votes.js';
import { formatTime } from '../recipes.js';
import { commitSession } from '../store.js';
import { toast, setNav } from '../ui.js';

export async function render() {
  if (!requireAdmin()) return;
  setNav('admin');

  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  await Promise.all([load('votes'), load('recipes')]);
  renderVoteAdmin(content);
}

function renderVoteAdmin(content) {
  const open = isVotingOpen();
  const voteState = getVoteState();
  const recipes = getApproved();
  const week = getCurrentWeekLabel();

  let html = `
    <div class="section-header">
      <div class="page-title" style="padding:0;">Voting</div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="row-between">
        <div>
          <strong>${open ? 'Voting is open' : 'Voting is closed'}</strong>
          <div class="text-small text-muted">Week: ${voteState.week || week}</div>
          ${voteState.opened_at ? `<div class="text-small text-muted">Opened: ${new Date(voteState.opened_at).toLocaleDateString()}</div>` : ''}
        </div>
        <div class="dot ${open ? 'dot-green' : 'dot-red'}"></div>
      </div>
      <div class="row" style="margin-top:12px; gap:8px;">
        ${!open ? `<button class="btn btn-primary" id="open-vote">Open Voting</button>` : ''}
        ${open ? `<button class="btn btn-danger" id="close-vote">Close Voting</button>` : ''}
        <button class="btn btn-ghost" id="reset-vote">Reset Votes</button>
      </div>
    </div>
  `;

  if (recipes.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">🥘</div>
        <h3>No approved recipes</h3>
        <p>Approve some recipes first.</p>
      </div>
    `;
  } else {
    html += `<h3 style="margin-bottom:12px; font-family:var(--font-serif);">Vote Breakdown</h3>`;
    html += `<div class="stack">`;

    for (const r of recipes) {
      const totals = getVoteTotals(r.id);
      const breakdown = getFullVoteBreakdown(r.id);
      const total = totals.thumbs_up + totals.thumbs_down + totals.neutral;
      const pct = total > 0 ? Math.round((totals.thumbs_up / total) * 100) : 0;

      html += `
        <div class="card">
          <div class="row-between">
            <div class="recipe-card-name">${r.name}</div>
            <div class="badge ${pct > 60 ? 'badge-green' : pct > 30 ? 'badge-yellow' : 'badge-red'}">
              ${pct}% ↑
            </div>
          </div>
          <div class="recipe-meta" style="margin-top:4px;">
            ${r.total_time ? `<span class="meta-item">⏱ ${formatTime(r.total_time)}</span>` : ''}
          </div>

          <div class="vote-bar" style="margin-top:10px;">
            <div class="vote-bar-fill" style="width:${pct}%"></div>
          </div>

          <div class="grid-3" style="margin-top:10px; text-align:center;">
            <div>
              <div style="font-size:1.2rem;">👍</div>
              <div style="font-size:1.1rem; font-weight:600;">${totals.thumbs_up}</div>
              <div class="text-small text-muted">up</div>
            </div>
            <div>
              <div style="font-size:1.2rem;">😐</div>
              <div style="font-size:1.1rem; font-weight:600;">${totals.neutral}</div>
              <div class="text-small text-muted">neutral</div>
            </div>
            <div>
              <div style="font-size:1.2rem;">👎</div>
              <div style="font-size:1.1rem; font-weight:600;">${totals.thumbs_down}</div>
              <div class="text-small text-muted">down</div>
            </div>
          </div>

          ${breakdown?.voters?.length > 0 ? `
            <div class="divider"></div>
            <div class="text-small text-muted" style="margin-top:4px;">
              ${breakdown.voters.map(v =>
                `<span style="margin-right:8px;">${v.name}: ${v.type === 'thumbs_up' ? '👍' : v.type === 'thumbs_down' ? '👎' : '😐'}</span>`
              ).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }
    html += `</div>`;
  }

  content.innerHTML = html;

  // Open voting
  document.getElementById('open-vote')?.addEventListener('click', async () => {
    openVoting(week);
    try {
      await commitSession('open voting');
      toast('Voting opened!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    renderVoteAdmin(content);
  });

  // Close voting
  document.getElementById('close-vote')?.addEventListener('click', async () => {
    closeVoting();
    try {
      await commitSession('close voting');
      toast('Voting closed');
    } catch (e) { toast(e.message, 'error'); }
    renderVoteAdmin(content);
  });

  // Reset
  document.getElementById('reset-vote')?.addEventListener('click', async () => {
    if (!confirm('Reset all votes for this week?')) return;
    openVoting(week); // resets with fresh votes
    try {
      await commitSession('reset votes');
      toast('Votes reset');
    } catch (e) { toast(e.message, 'error'); }
    renderVoteAdmin(content);
  });
}
