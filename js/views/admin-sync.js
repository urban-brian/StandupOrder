// js/views/admin-sync.js — Trigger recipe scraper, review new imports

import { requireAdmin } from '../auth.js';
import { load, get } from '../store.js';
import { triggerSync, startPolling, clearPolling, pipelineStatusLabel } from '../scraper.js';
import { reload, commitSession } from '../store.js';
import { mergeScraperRecipes } from '../recipes.js';
import { readJSON } from '../api.js';
import { approveRecipe } from '../recipes.js';
import { toast, setNav } from '../ui.js';

let pipelineId = null;

export async function render() {
  if (!requireAdmin()) return;
  setNav('admin');

  const content = document.getElementById('app-content');

  content.innerHTML = `
    <div class="section-header">
      <div class="page-title" style="padding:0;">Recipe Sync</div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="font-family:var(--font-serif); font-size:1.1rem; margin-bottom:6px;">
        NYT Cooking Sync
      </div>
      <div class="text-small text-muted" style="margin-bottom:16px;">
        Triggers a GitLab CI pipeline that fetches your latest NYT Cooking recipes and
        imports them for review. New recipes appear below after the sync completes.
      </div>

      <div class="scraper-status hidden" id="pipeline-status">
        <div class="dot dot-yellow" id="status-dot"></div>
        <span id="status-label">Idle</span>
      </div>

      <button class="btn btn-primary" id="sync-btn" style="margin-top:12px;">
        🔄 Sync Now
      </button>
    </div>

    <div id="new-recipes-section" class="hidden">
      <h3 style="margin-bottom:12px; font-family:var(--font-serif);">New Recipes to Review</h3>
      <div class="stack" id="new-recipes-list"></div>
    </div>

    <div class="card" style="margin-top:16px; background:#FFF9F5;">
      <div class="text-small text-muted">
        <strong>Setup required:</strong> Make sure your GitLab project has a
        <code>scrape-recipes</code> CI job and your pipeline trigger token is set in Settings.
        The scraper should output JSON to <code>data/scraped_recipes.json</code> in the repo.
      </div>
    </div>
  `;

  document.getElementById('sync-btn').addEventListener('click', async () => {
    const btn = document.getElementById('sync-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Starting…';

    try {
      pipelineId = await triggerSync();

      const statusEl = document.getElementById('pipeline-status');
      const dotEl = document.getElementById('status-dot');
      const labelEl = document.getElementById('status-label');
      statusEl.classList.remove('hidden');

      startPolling(
        pipelineId,
        (status) => {
          const info = pipelineStatusLabel(status.status);
          dotEl.className = `dot ${info.dot}`;
          labelEl.textContent = info.label;
          btn.textContent = info.label;
        },
        async (finalStatus) => {
          if (finalStatus.status === 'success') {
            toast('Sync complete! Loading new recipes…', 'success');
            await loadNewRecipes();
          } else {
            toast(`Pipeline ${finalStatus.status}. Check GitLab for details.`, 'error');
          }
          btn.disabled = false;
          btn.textContent = '🔄 Sync Now';
        },
        (err) => {
          toast(`Pipeline error: ${err.message}`, 'error');
          btn.disabled = false;
          btn.textContent = '🔄 Sync Now';
        }
      );
    } catch (e) {
      toast(`Failed to trigger sync: ${e.message}`, 'error');
      btn.disabled = false;
      btn.textContent = '🔄 Sync Now';
    }
  });
}

async function loadNewRecipes() {
  await reload('recipes');
  const scraperData = await readJSON('data/scraped_recipes.json').catch(() => null);
  if (!scraperData?.length) return;

  const newRecipes = mergeScraperRecipes(scraperData);
  if (newRecipes.length === 0) {
    toast('No new recipes found.', 'success');
    return;
  }

  const section = document.getElementById('new-recipes-section');
  const list = document.getElementById('new-recipes-list');
  section.classList.remove('hidden');

  list.innerHTML = newRecipes.map(r => `
    <div class="card" id="new-${r.id}">
      <div class="row-between">
        <strong class="recipe-card-name">${r.name}</strong>
        <span class="badge badge-sage">New</span>
      </div>
      ${r.source_url ? `<div class="text-small text-muted" style="margin-top:4px;">${r.source_url}</div>` : ''}
      <div class="row" style="margin-top:10px; gap:8px;">
        <button class="btn btn-accent btn-sm approve-new" data-id="${r.id}">Approve</button>
        <button class="btn btn-ghost btn-sm skip-new" data-id="${r.id}">Skip</button>
      </div>
    </div>
  `).join('');

  // Approve buttons
  list.querySelectorAll('.approve-new').forEach(btn => {
    btn.addEventListener('click', async () => {
      approveRecipe(btn.dataset.id);
      try {
        await commitSession('approve synced recipe');
        toast('Recipe approved!', 'success');
      } catch (e) { toast(e.message, 'error'); }
      document.getElementById(`new-${btn.dataset.id}`)?.remove();
    });
  });

  // Skip buttons
  list.querySelectorAll('.skip-new').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`new-${btn.dataset.id}`)?.remove();
    });
  });
}
