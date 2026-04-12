// js/views/suggest.js — Submit meal suggestions

import { requireLogin, getCurrentUser } from '../auth.js';
import { load } from '../store.js';
import { getSuggestions, addSuggestion } from '../suggestions.js';
import { commitSession } from '../store.js';
import { toast, setNav } from '../ui.js';

export async function render() {
  if (!requireLogin()) return;
  setNav('suggest');

  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  await load('suggestions');

  const user = getCurrentUser();
  const mySuggestions = getSuggestions().filter(s => s.submitted_by === user);

  content.innerHTML = `
    <div class="page-title">Suggest a Meal</div>
    <div class="page-subtitle" style="margin-bottom:20px;">
      Got a craving? Let the family know!
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="form-group">
        <label class="form-label">Your suggestion</label>
        <textarea id="suggestion-text" class="form-textarea"
          placeholder="e.g. Thai green curry, or maybe that pasta we had last month?"
          rows="3"></textarea>
      </div>
      <button id="submit-btn" class="btn btn-primary btn-full" style="margin-top:12px;">
        Submit Suggestion
      </button>
    </div>

    ${mySuggestions.length > 0 ? `
      <h3 style="margin-bottom:12px; font-family:var(--font-serif);">Your Suggestions</h3>
      <div class="stack">
        ${mySuggestions.map(s => `
          <div class="suggestion-card">
            <div class="suggestion-text">"${s.text}"</div>
            <div class="suggestion-meta">
              ${new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              · ${s.status === 'reviewed' ? '✓ Reviewed' : 'Pending'}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  document.getElementById('submit-btn').addEventListener('click', async () => {
    const text = document.getElementById('suggestion-text').value.trim();
    if (!text) {
      toast('Please enter a suggestion first.', 'error');
      return;
    }
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      addSuggestion(text);
      await commitSession('add meal suggestion');
      toast('Suggestion submitted!', 'success');
      render();
    } catch (e) {
      toast(`Error: ${e.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Suggestion';
    }
  });
}
