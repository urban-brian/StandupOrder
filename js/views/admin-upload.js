// js/views/admin-upload.js — PDF upload + Claude extraction + manual add

import { requireAdmin } from '../auth.js';
import { extractRecipeMetadata } from '../claude.js';
import { addRecipe, readPDFAsBase64, uploadRecipePDF } from '../recipes.js';
import { commitSession } from '../store.js';
import { toast, setNav } from '../ui.js';
import { navigate } from '../router.js';

export function render() {
  if (!requireAdmin()) return;
  setNav('admin');

  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="section-header">
      <div class="page-title" style="padding:0;">Add Recipes</div>
      <a href="#/admin/recipes" class="btn btn-ghost btn-sm">← Back</a>
    </div>

    <div class="pill-tabs" id="upload-tabs">
      <button class="pill-tab active" data-tab="pdf">Upload PDF</button>
      <button class="pill-tab" data-tab="manual">Manual Entry</button>
    </div>

    <div id="tab-pdf">
      <div class="upload-zone" id="drop-zone">
        <div class="upload-zone-icon">📄</div>
        <strong>Drop recipe PDFs here</strong>
        <div class="text-small text-muted" style="margin-top:4px;">or click to browse</div>
        <input type="file" id="file-input" accept=".pdf" multiple style="display:none;">
      </div>
      <div id="pdf-queue" class="stack" style="margin-top:16px;"></div>
    </div>

    <div id="tab-manual" class="hidden">
      <div class="card">
        <div class="stack">
          <div class="form-group">
            <label class="form-label">Recipe Name *</label>
            <input class="form-input" id="m-name" placeholder="e.g. Roast Chicken with Herbs">
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="m-desc" rows="2" placeholder="Brief description..."></textarea>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Total Time (min)</label>
              <input class="form-input" id="m-total" type="number" placeholder="60">
            </div>
            <div class="form-group">
              <label class="form-label">Active Cook (min)</label>
              <input class="form-input" id="m-active" type="number" placeholder="20">
            </div>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Cuisine</label>
              <input class="form-input" id="m-cuisine" placeholder="Italian">
            </div>
            <div class="form-group">
              <label class="form-label">Spice Level</label>
              <select class="form-select" id="m-spice">
                <option value="mild">Mild</option>
                <option value="medium">Medium</option>
                <option value="spicy">Spicy</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Flags</label>
            <div class="row" style="flex-wrap:wrap; gap:12px;">
              <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
                <input type="checkbox" id="m-veg"> 🌿 Vegetarian
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
                <input type="checkbox" id="m-fish"> 🐟 Fish
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
                <input type="checkbox" id="m-pasta"> 🍝 Pasta
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
                <input type="checkbox" id="m-ahead"> ⏰ Make Ahead
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Source URL</label>
            <input class="form-input" id="m-url" type="url" placeholder="https://cooking.nytimes.com/...">
          </div>
          <button class="btn btn-primary btn-full" id="manual-save">Add Recipe</button>
        </div>
      </div>
    </div>
  `;

  setupPDFUpload(content);
  setupManualEntry(content);

  // Tab switching
  content.querySelectorAll('#upload-tabs .pill-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      content.querySelectorAll('#upload-tabs .pill-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      content.getElementById && null;
      document.getElementById('tab-pdf').classList.toggle('hidden', tab.dataset.tab !== 'pdf');
      document.getElementById('tab-manual').classList.toggle('hidden', tab.dataset.tab !== 'manual');
    });
  });
}

function setupPDFUpload(content) {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const queue = document.getElementById('pdf-queue');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles([...e.dataTransfer.files].filter(f => f.type === 'application/pdf'));
  });

  fileInput.addEventListener('change', () => {
    handleFiles([...fileInput.files]);
    fileInput.value = '';
  });

  function handleFiles(files) {
    files.forEach(file => processFile(file, queue));
  }
}

async function processFile(file, queue) {
  const itemId = 'pdf-' + Math.random().toString(36).slice(2);
  const item = document.createElement('div');
  item.id = itemId;
  item.className = 'metadata-editor';
  item.innerHTML = `
    <div class="row-between" style="margin-bottom:8px;">
      <strong>${file.name}</strong>
      <div class="spinner"></div>
    </div>
    <div class="text-small text-muted">Extracting metadata with Claude…</div>
  `;
  queue.appendChild(item);

  try {
    const base64 = await readPDFAsBase64(file);
    let meta;
    try {
      meta = await extractRecipeMetadata(base64);
    } catch (e) {
      // Claude failed — show manual form
      meta = { name: file.name.replace('.pdf', '').replace(/_/g, ' ') };
      toast(`Claude extraction failed: ${e.message}. Please fill in manually.`, 'error');
    }

    renderExtractedForm(item, file, meta, base64);
  } catch (e) {
    item.innerHTML = `<div class="row-between"><strong>${file.name}</strong> <span class="badge badge-red">Error</span></div>
      <div class="text-small text-muted">${e.message}</div>`;
  }
}

function renderExtractedForm(item, file, meta, base64) {
  item.innerHTML = `
    <div class="row-between" style="margin-bottom:12px;">
      <strong style="font-family:var(--font-serif);">${meta.name || file.name}</strong>
      <span class="badge badge-sage">Extracted</span>
    </div>
    <div class="stack">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" data-f="name" value="${esc(meta.name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" data-f="description" rows="2">${esc(meta.description || '')}</textarea>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Total Time (min)</label>
          <input class="form-input" data-f="total_time" type="number" value="${meta.total_time || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Active Cook (min)</label>
          <input class="form-input" data-f="active_cook_time" type="number" value="${meta.active_cook_time || ''}">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Cuisine</label>
          <input class="form-input" data-f="cuisine_type" value="${esc(meta.cuisine_type || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Spice Level</label>
          <select class="form-select" data-f="spice_level">
            <option value="mild" ${meta.spice_level === 'mild' ? 'selected' : ''}>Mild</option>
            <option value="medium" ${meta.spice_level === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="spicy" ${meta.spice_level === 'spicy' ? 'selected' : ''}>Spicy</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Flags</label>
        <div class="row" style="flex-wrap:wrap; gap:12px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
            <input type="checkbox" data-f="is_vegetarian" ${meta.is_vegetarian ? 'checked' : ''}> 🌿 Vegetarian
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
            <input type="checkbox" data-f="is_fish" ${meta.is_fish ? 'checked' : ''}> 🐟 Fish
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
            <input type="checkbox" data-f="is_pasta" ${meta.is_pasta ? 'checked' : ''}> 🍝 Pasta
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;">
            <input type="checkbox" data-f="make_ahead_potential" ${meta.make_ahead_potential ? 'checked' : ''}> ⏰ Make Ahead
          </label>
        </div>
      </div>
      <div class="row" style="gap:8px; justify-content:flex-end; margin-top:4px;">
        <button class="btn btn-danger btn-sm discard-btn">Discard</button>
        <button class="btn btn-primary btn-sm save-btn">Save & Approve</button>
      </div>
    </div>
  `;

  item.querySelector('.discard-btn').addEventListener('click', () => item.remove());
  item.querySelector('.save-btn').addEventListener('click', async () => {
    const btn = item.querySelector('.save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const recipe = addRecipe({
      name:                 item.querySelector('[data-f="name"]').value,
      description:          item.querySelector('[data-f="description"]').value,
      total_time:           parseInt(item.querySelector('[data-f="total_time"]').value) || null,
      active_cook_time:     parseInt(item.querySelector('[data-f="active_cook_time"]').value) || null,
      cuisine_type:         item.querySelector('[data-f="cuisine_type"]').value,
      spice_level:          item.querySelector('[data-f="spice_level"]').value,
      is_vegetarian:        item.querySelector('[data-f="is_vegetarian"]').checked,
      is_fish:              item.querySelector('[data-f="is_fish"]').checked,
      is_pasta:             item.querySelector('[data-f="is_pasta"]').checked,
      make_ahead_potential: item.querySelector('[data-f="make_ahead_potential"]').checked,
      ingredients: meta.ingredients || [],
      directions: meta.directions || '',
      notes: meta.notes || '',
      source: 'pdf',
      approved: true,
    });

    try {
      // Upload PDF
      if (base64) {
        const pdfPath = await uploadRecipePDF(file, recipe.id);
        // patch pdf_path
        const { updateRecipe } = await import('../recipes.js');
        updateRecipe(recipe.id, { pdf_path: pdfPath });
      }
      await commitSession('add recipe from PDF');
      toast('Recipe saved!', 'success');
      item.remove();
    } catch (e) {
      toast(`Save failed: ${e.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Save & Approve';
    }
  });
}

function setupManualEntry(content) {
  document.getElementById('manual-save').addEventListener('click', async () => {
    const name = document.getElementById('m-name').value.trim();
    if (!name) { toast('Recipe name is required.', 'error'); return; }

    const btn = document.getElementById('manual-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    addRecipe({
      name,
      description: document.getElementById('m-desc').value,
      total_time: parseInt(document.getElementById('m-total').value) || null,
      active_cook_time: parseInt(document.getElementById('m-active').value) || null,
      cuisine_type: document.getElementById('m-cuisine').value,
      spice_level: document.getElementById('m-spice').value,
      is_vegetarian: document.getElementById('m-veg').checked,
      is_fish: document.getElementById('m-fish').checked,
      is_pasta: document.getElementById('m-pasta').checked,
      make_ahead_potential: document.getElementById('m-ahead').checked,
      source_url: document.getElementById('m-url').value,
      source: 'manual',
      approved: true,
    });

    try {
      await commitSession('add recipe manually');
      toast('Recipe added!', 'success');
      navigate('/admin/recipes');
    } catch (e) {
      toast(`Save failed: ${e.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Add Recipe';
    }
  });
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
