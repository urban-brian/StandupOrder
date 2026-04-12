// js/views/admin-suggestions.js — Review family suggestions

import { requireAdmin } from '../auth.js';
import { load } from '../store.js';
import { getSuggestions, markReviewed, deleteSuggestion } from '../suggestions.js';
import { commitSession } from '../store.js';
import { toast, setNav } from '../ui.js';

export async function render() {
  if (!requireAdmin()) return;
  setNav('admin');

  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  await load('suggestions');
  renderSuggestions(content);
}

function renderSuggestions(content) {
  const suggestions = getSuggestions();
  const pending = suggestions.filter(s => s.status === 'pending');
  const reviewed = suggestions.filter(s => s.status === 'reviewed');

  let html = `
    <div class="page-title">Family Suggestions</div>
    <div class="page-subtitle" style="margin-bottom:16px;">${pending.length} pending</div>
  `;

  if (suggestions.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <h3>No suggestions yet</h3>
        <p>Family members can submit meal ideas from the Suggest page.</p>
      </div>
    `;
  } else {
    if (pending.length > 0) {
      html += `<div class="stack" id="suggestion-list">`;
      for (const s of pending) {
        html += `
          <div class="suggestion-card" id="sug-${s.id}">
            <div class="suggestion-text">"${s.text}"</div>
            <div class="suggestion-meta">
              From <strong>${s.submitted_by}</strong> ·
              ${new Date(s.submitted_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
            </div>
            <div class="row" style="margin-top:10px; gap:6px;">
              <button class="btn btn-accent btn-sm" data-action="reviewed" data-id="${s.id}">✓ Mark Reviewed</button>
              <button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}">Delete</button>
            </div>
          </div>
        `;
      }
      html += `</div>`;
    }

    if (reviewed.length > 0) {
      html += `
        <h3 style="margin-top:20px; margin-bottom:10px; font-family:var(--font-serif);">Previously Reviewed</h3>
        <div class="stack-sm">
          ${reviewed.map(s => `
            <div class="suggestion-card" style="opacity:.6;">
              <div class="suggestion-text">"${s.text}"</div>
              <div class="suggestion-meta">
                ${s.submitted_by} · ✓ Reviewed
                <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${s.id}" style="margin-left:8px;">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  content.innerHTML = html;

  content.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'reviewed') {
        markReviewed(id);
        try { await commitSession('mark suggestion reviewed'); } catch (e) { toast(e.message, 'error'); }
        renderSuggestions(content);
      } else if (btn.dataset.action === 'delete') {
        deleteSuggestion(id);
        try { await commitSession('delete suggestion'); } catch (e) { toast(e.message, 'error'); }
        renderSuggestions(content);
      }
    });
  });
}
