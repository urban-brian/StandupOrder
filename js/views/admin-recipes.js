// js/views/admin-recipes.js — Recipe list, edit metadata, approve scraped

import { requireAdmin } from '../auth.js';
import { load, get, set } from '../store.js';
import { getAllRecipes, updateRecipe, deleteRecipe, approveRecipe, formatTime, spiceBadge } from '../recipes.js';
import { commitSession } from '../store.js';
import { toast, setNav } from '../ui.js';
import { navigate } from '../router.js';

let activeTab = 'pending';

export async function render() {
  if (!requireAdmin()) return;
  setNav('admin');

  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  await load('recipes');
  renderList(content);
}

function renderList(content) {
  const all = getAllRecipes();
  const pending = all.filter(r => !r.approved);
  const approved = all.filter(r => r.approved);
  const shown = activeTab === 'pending' ? pending : approved;

  let html = `
    <div class="section-header">
      <div class="page-title" style="padding:0;">Recipes</div>
      <a href="#/admin/upload" class="btn btn-primary btn-sm">+ Add</a>
    </div>

    <div class="pill-tabs">
      <button class="pill-tab ${activeTab === 'pending' ? 'active' : ''}" data-tab="pending">
        Pending (${pending.length})
      </button>
      <button class="pill-tab ${activeTab === 'approved' ? 'active' : ''}" data-tab="approved">
        Approved (${approved.length})
      </button>
    </div>
  `;

  if (shown.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">${activeTab === 'pending' ? '✅' : '🥘'}</div>
        <h3>${activeTab === 'pending' ? 'All caught up!' : 'No recipes yet'}</h3>
        <p>${activeTab === 'pending' ? 'No recipes awaiting review.' : 'Add recipes via upload or sync.'}</p>
      </div>
    `;
  } else {
    html += `<div class="stack" id="recipe-list">`;
    for (const r of shown) {
      html += `
        <div class="recipe-card">
          <div class="recipe-card-body">
            <div class="row-between">
              <div class="recipe-card-name">${r.name}</div>
              <span class="badge ${r.source === 'scraper' ? 'badge-sage' : r.source === 'manual' ? 'badge-gray' : 'badge-terracotta'}">
                ${r.source}
              </span>
            </div>
            <div class="recipe-meta" style="margin-top:6px;">
              ${r.total_time ? `<span class="meta-item">⏱ ${formatTime(r.total_time)}</span>` : ''}
              ${r.cuisine_type ? `<span class="meta-item">🌍 ${r.cuisine_type}</span>` : ''}
              ${r.spice_level ? `<span class="meta-item">${spiceBadge(r.spice_level)}</span>` : ''}
            </div>
            <div class="recipe-flags" style="margin-top:8px;">
              ${r.is_vegetarian ? '<span class="badge badge-green">🌿 Veg</span>' : ''}
              ${r.is_fish ? '<span class="badge badge-sage">🐟 Fish</span>' : ''}
              ${r.is_pasta ? '<span class="badge badge-terracotta">🍝 Pasta</span>' : ''}
              ${r.make_ahead_potential ? '<span class="badge badge-yellow">⏰ Ahead</span>' : ''}
            </div>
            <div class="row" style="margin-top:12px; gap:6px;">
              <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${r.id}">Edit</button>
              ${!r.approved ? `<button class="btn btn-accent btn-sm" data-action="approve" data-id="${r.id}">Approve</button>` : ''}
              <button class="btn btn-danger btn-sm" data-action="delete" data-id="${r.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }
    html += `</div>`;
  }

  content.innerHTML = html;

  // Tab switching
  content.querySelectorAll('.pill-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      renderList(content);
    });
  });

  // Action buttons
  content.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const recipe = getAllRecipes().find(r => r.id === id);

      if (action === 'delete') {
        if (!confirm(`Delete "${recipe?.name}"?`)) return;
        deleteRecipe(id);
        try {
          await commitSession('delete recipe');
          toast('Recipe deleted');
        } catch (e) { toast(e.message, 'error'); }
        renderList(content);

      } else if (action === 'approve') {
        approveRecipe(id);
        try {
          await commitSession('approve recipe');
          toast('Recipe approved!', 'success');
        } catch (e) { toast(e.message, 'error'); }
        renderList(content);

      } else if (action === 'edit') {
        showEditor(content, recipe);
      }
    });
  });
}

function showEditor(content, recipe) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;overflow-y:auto;padding:16px;';
  el.innerHTML = `
    <div class="card" style="max-width:520px;margin:0 auto;">
      <div class="row-between" style="margin-bottom:16px;">
        <h3 style="font-family:var(--font-serif);">Edit Recipe</h3>
        <button class="btn btn-ghost btn-sm" id="close-editor">✕</button>
      </div>

      <div class="stack">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input class="form-input" id="ed-name" value="${esc(recipe.name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="ed-desc" rows="2">${esc(recipe.description || '')}</textarea>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Total Time (min)</label>
            <input class="form-input" id="ed-total" type="number" value="${recipe.total_time || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Active Cook (min)</label>
            <input class="form-input" id="ed-active" type="number" value="${recipe.active_cook_time || ''}">
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Cuisine</label>
            <input class="form-input" id="ed-cuisine" value="${esc(recipe.cuisine_type || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Spice Level</label>
            <select class="form-select" id="ed-spice">
              <option value="mild" ${recipe.spice_level === 'mild' ? 'selected' : ''}>Mild</option>
              <option value="medium" ${recipe.spice_level === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="spicy" ${recipe.spice_level === 'spicy' ? 'selected' : ''}>Spicy</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Flags</label>
          <div class="row" style="flex-wrap:wrap; gap:12px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
              <input type="checkbox" id="ed-veg" ${recipe.is_vegetarian ? 'checked' : ''}> 🌿 Vegetarian
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
              <input type="checkbox" id="ed-fish" ${recipe.is_fish ? 'checked' : ''}> 🐟 Fish
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
              <input type="checkbox" id="ed-pasta" ${recipe.is_pasta ? 'checked' : ''}> 🍝 Pasta
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
              <input type="checkbox" id="ed-ahead" ${recipe.make_ahead_potential ? 'checked' : ''}> ⏰ Make Ahead
            </label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Source URL</label>
          <input class="form-input" id="ed-url" type="url" value="${esc(recipe.source_url || '')}">
        </div>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:8px;">
          <button class="btn btn-ghost" id="cancel-edit">Cancel</button>
          <button class="btn btn-primary" id="save-edit">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(el);

  el.querySelector('#close-editor').addEventListener('click', () => el.remove());
  el.querySelector('#cancel-edit').addEventListener('click', () => el.remove());
  el.querySelector('#save-edit').addEventListener('click', async () => {
    const changes = {
      name: el.querySelector('#ed-name').value,
      description: el.querySelector('#ed-desc').value,
      total_time: parseInt(el.querySelector('#ed-total').value) || null,
      active_cook_time: parseInt(el.querySelector('#ed-active').value) || null,
      cuisine_type: el.querySelector('#ed-cuisine').value,
      spice_level: el.querySelector('#ed-spice').value,
      is_vegetarian: el.querySelector('#ed-veg').checked,
      is_fish: el.querySelector('#ed-fish').checked,
      is_pasta: el.querySelector('#ed-pasta').checked,
      make_ahead_potential: el.querySelector('#ed-ahead').checked,
      source_url: el.querySelector('#ed-url').value,
    };
    updateRecipe(recipe.id, changes);
    try {
      await commitSession('update recipe metadata');
      toast('Recipe saved!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    el.remove();
    renderList(content);
  });
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
