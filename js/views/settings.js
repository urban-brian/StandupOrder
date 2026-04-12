// js/views/settings.js — GitLab token, Claude API key, project settings

import { requireAdmin } from '../auth.js';
import { getSettings, saveSettings } from '../api.js';
import { getClaudeKey, saveClaudeKey } from '../claude.js';
import { toast, setNav } from '../ui.js';

export function render() {
  if (!requireAdmin()) return;
  setNav('admin');

  const s = getSettings();
  const claudeKey = getClaudeKey();

  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="page-title">Settings</div>
    <div class="page-subtitle" style="margin-bottom:20px;">Configuration stored locally in your browser</div>

    <!-- GitLab section -->
    <div class="card" style="margin-bottom:16px;">
      <h3 style="font-family:var(--font-serif); margin-bottom:14px;">GitLab</h3>

      <div class="stack">
        <div class="form-group">
          <label class="form-label">Project ID or namespace/repo</label>
          <input class="form-input" id="s-project" placeholder="e.g. username/meal-planner or 12345678"
                 value="${esc(s.projectId || '')}">
          <div class="form-hint">Find in GitLab → Settings → General → Project ID</div>
        </div>

        <div class="form-group">
          <label class="form-label">Personal Access Token</label>
          <div class="token-input-row">
            <input class="form-input" id="s-token" type="password"
                   placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                   value="${esc(s.token || '')}">
            <button class="btn btn-ghost btn-sm" id="toggle-token">Show</button>
          </div>
          <div class="form-hint">Needs <code>api</code> scope. Settings → Access Tokens.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Branch</label>
          <input class="form-input" id="s-branch" placeholder="main" value="${esc(s.branch || 'main')}">
        </div>

        <div class="form-group">
          <label class="form-label">Pipeline Trigger Token (for recipe sync)</label>
          <div class="token-input-row">
            <input class="form-input" id="s-pipeline-token" type="password"
                   placeholder="Optional — needed for Sync Recipes"
                   value="${esc(s.pipelineTriggerToken || '')}">
            <button class="btn btn-ghost btn-sm" id="toggle-pipeline-token">Show</button>
          </div>
          <div class="form-hint">Settings → CI/CD → Pipeline trigger tokens.</div>
        </div>

        <button class="btn btn-primary" id="save-gitlab">Save GitLab Settings</button>
        <button class="btn btn-ghost btn-sm" id="test-gitlab">Test Connection</button>
      </div>
    </div>

    <!-- Claude section -->
    <div class="card" style="margin-bottom:16px;">
      <h3 style="font-family:var(--font-serif); margin-bottom:14px;">Claude API</h3>
      <div class="stack">
        <div class="form-group">
          <label class="form-label">Anthropic API Key</label>
          <div class="token-input-row">
            <input class="form-input" id="s-claude" type="password"
                   placeholder="sk-ant-xxxxxxxxxxxx"
                   value="${esc(claudeKey)}">
            <button class="btn btn-ghost btn-sm" id="toggle-claude">Show</button>
          </div>
          <div class="form-hint">
            Required for PDF extraction and plan generation.
            Get your key at console.anthropic.com
          </div>
        </div>
        <button class="btn btn-primary" id="save-claude">Save Claude Key</button>
      </div>
    </div>

    <!-- Info -->
    <div class="card" style="background:#FFF9F5; font-size:.85rem; color:var(--text-muted);">
      <strong>Privacy note:</strong> All keys are stored only in your browser's localStorage.
      They are never sent to any server except the respective APIs (GitLab, Anthropic).
    </div>
  `;

  // Toggle visibility
  document.getElementById('toggle-token').addEventListener('click', () => toggleVisibility('s-token', 'toggle-token'));
  document.getElementById('toggle-pipeline-token').addEventListener('click', () => toggleVisibility('s-pipeline-token', 'toggle-pipeline-token'));
  document.getElementById('toggle-claude').addEventListener('click', () => toggleVisibility('s-claude', 'toggle-claude'));

  // Save GitLab
  document.getElementById('save-gitlab').addEventListener('click', () => {
    const projectId = document.getElementById('s-project').value.trim();
    const token = document.getElementById('s-token').value.trim();
    const branch = document.getElementById('s-branch').value.trim() || 'main';
    const pipelineTriggerToken = document.getElementById('s-pipeline-token').value.trim();

    if (!projectId || !token) {
      toast('Project ID and token are required.', 'error');
      return;
    }
    saveSettings({ projectId, token, branch, pipelineTriggerToken });
    toast('GitLab settings saved!', 'success');
  });

  // Test connection
  document.getElementById('test-gitlab').addEventListener('click', async () => {
    const btn = document.getElementById('test-gitlab');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    try {
      const { readFile } = await import('../api.js');
      await readFile('data/recipes.json');
      toast('Connection successful!', 'success');
    } catch (e) {
      toast(`Connection failed: ${e.message}`, 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Test Connection';
  });

  // Save Claude key
  document.getElementById('save-claude').addEventListener('click', () => {
    const key = document.getElementById('s-claude').value.trim();
    if (!key) { toast('Enter a Claude API key.', 'error'); return; }
    saveClaudeKey(key);
    toast('Claude key saved!', 'success');
  });
}

function toggleVisibility(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
