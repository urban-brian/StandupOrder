// js/api.js — GitLab API wrapper

const SETTINGS_KEY = 'mealplanner_gitlab';

// --- Settings ---
export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch { return {}; }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function cfg() {
  const s = getSettings();
  if (!s.token || !s.projectId) throw new Error('GitLab not configured. Go to Settings first.');
  return s;
}

function apiBase(projectId) {
  return `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}`;
}

function headers(token) {
  return { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' };
}

// --- File reading ---
export async function readFile(filePath) {
  const { token, projectId, branch = 'main' } = cfg();
  const url = `${apiBase(projectId)}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${branch}`;
  const res = await fetch(url, { headers: { 'PRIVATE-TOKEN': token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitLab read error ${res.status}: ${filePath}`);
  return res.text();
}

export async function readJSON(filePath) {
  const text = await readFile(filePath);
  if (text === null) return null;
  return JSON.parse(text);
}

// Get file SHA (needed for updates)
async function getFileSHA(filePath) {
  const { token, projectId, branch = 'main' } = cfg();
  const url = `${apiBase(projectId)}/repository/files/${encodeURIComponent(filePath)}?ref=${branch}`;
  const res = await fetch(url, { headers: { 'PRIVATE-TOKEN': token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitLab SHA error: ${filePath}`);
  const data = await res.json();
  return data.last_commit_id || null;
}

// --- File writing ---
export async function writeFile(filePath, content, commitMessage) {
  const { token, projectId, branch = 'main' } = cfg();
  const base = apiBase(projectId);
  const encodedPath = encodeURIComponent(filePath);
  const body = JSON.stringify({
    branch,
    content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    commit_message: commitMessage || `update ${filePath}`,
    encoding: 'text',
  });

  // Try update first, then create
  let res = await fetch(`${base}/repository/files/${encodedPath}`, {
    method: 'PUT',
    headers: headers(token),
    body,
  });

  if (res.status === 400 || res.status === 404) {
    // File doesn't exist yet — create it
    res = await fetch(`${base}/repository/files/${encodedPath}`, {
      method: 'POST',
      headers: headers(token),
      body,
    });
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitLab write error ${res.status}: ${err}`);
  }
  return res.json();
}

// Write multiple files in one logical session commit
// GitLab doesn't have a multi-file atomic commit via simple files API,
// so we use the Commits API which does support it.
export async function commitMultiple(files, commitMessage) {
  const { token, projectId, branch = 'main' } = cfg();
  const actions = files.map(({ path, content }) => ({
    action: 'update',
    file_path: path,
    content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    encoding: 'text',
  }));

  // First pass: check which files exist and which need 'create' action
  // We'll try with 'update' and fall back to handling errors
  const body = JSON.stringify({
    branch,
    commit_message: commitMessage,
    actions,
  });

  let res = await fetch(`${apiBase(projectId)}/repository/commits`, {
    method: 'POST',
    headers: headers(token),
    body,
  });

  if (!res.ok) {
    // Some files might not exist yet — retry with create for new files
    const errText = await res.text();
    // If error mentions "not found", try create action for all
    if (errText.includes('not found') || errText.includes('new_file')) {
      const createActions = actions.map(a => ({ ...a, action: 'create' }));
      // Try update for existing, create for new — use upsert workaround
      const updateBody = JSON.stringify({
        branch,
        commit_message: commitMessage,
        actions: createActions,
      });
      res = await fetch(`${apiBase(projectId)}/repository/commits`, {
        method: 'POST',
        headers: headers(token),
        body: updateBody,
      });
    }
    if (!res.ok) {
      const e = await res.text();
      throw new Error(`GitLab commit error: ${e}`);
    }
  }
  return res.json();
}

// --- Pipeline trigger ---
export async function triggerPipeline(ref = 'main') {
  const { token, projectId, pipelineTriggerToken } = cfg();
  if (!pipelineTriggerToken) throw new Error('Pipeline trigger token not configured in Settings.');
  const url = `${apiBase(projectId)}/trigger/pipeline`;
  const body = new URLSearchParams({ token: pipelineTriggerToken, ref });
  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) {
    const e = await res.text();
    throw new Error(`Pipeline trigger failed: ${e}`);
  }
  return res.json();
}

export async function getPipelineStatus(pipelineId) {
  const { token, projectId } = cfg();
  const res = await fetch(`${apiBase(projectId)}/pipelines/${pipelineId}`, {
    headers: { 'PRIVATE-TOKEN': token },
  });
  if (!res.ok) throw new Error(`Pipeline status error: ${res.status}`);
  return res.json();
}

// --- Upload file (binary, base64) ---
export async function uploadBinaryFile(filePath, base64Content, commitMessage) {
  const { token, projectId, branch = 'main' } = cfg();
  const body = JSON.stringify({
    branch,
    content: base64Content,
    commit_message: commitMessage || `upload ${filePath}`,
    encoding: 'base64',
  });
  const encodedPath = encodeURIComponent(filePath);
  let res = await fetch(`${apiBase(projectId)}/repository/files/${encodedPath}`, {
    method: 'PUT',
    headers: headers(token),
    body,
  });
  if (res.status === 400 || res.status === 404) {
    res = await fetch(`${apiBase(projectId)}/repository/files/${encodedPath}`, {
      method: 'POST',
      headers: headers(token),
      body,
    });
  }
  if (!res.ok) {
    const e = await res.text();
    throw new Error(`File upload error: ${e}`);
  }
  return res.json();
}
