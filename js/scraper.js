// js/scraper.js — Recipe scraper sync (triggers GitLab CI pipeline)

import { triggerPipeline, getPipelineStatus, readJSON } from './api.js';
import { mergeScraperRecipes } from './recipes.js';

let pollInterval = null;

export async function triggerSync() {
  const pipeline = await triggerPipeline('main');
  return pipeline.id;
}

export function startPolling(pipelineId, onUpdate, onComplete, onError) {
  clearPolling();
  let attempts = 0;
  const maxAttempts = 60; // 5 min at 5s intervals

  pollInterval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearPolling();
      onError(new Error('Pipeline timed out after 5 minutes.'));
      return;
    }
    try {
      const status = await getPipelineStatus(pipelineId);
      onUpdate(status);

      if (['success', 'failed', 'canceled', 'skipped'].includes(status.status)) {
        clearPolling();
        onComplete(status);
      }
    } catch (e) {
      clearPolling();
      onError(e);
    }
  }, 5000);
}

export function clearPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// After successful sync, read the updated recipes from remote and merge
export async function importNewRecipes() {
  const scraperData = await readJSON('data/scraped_recipes.json');
  if (!scraperData || !Array.isArray(scraperData)) return [];
  return mergeScraperRecipes(scraperData);
}

export function pipelineStatusLabel(status) {
  const map = {
    pending:  { label: 'Queued',     dot: 'dot-yellow' },
    running:  { label: 'Running…',   dot: 'dot-yellow' },
    success:  { label: 'Completed',  dot: 'dot-green'  },
    failed:   { label: 'Failed',     dot: 'dot-red'    },
    canceled: { label: 'Cancelled',  dot: 'dot-red'    },
    skipped:  { label: 'Skipped',    dot: 'dot-gray'   },
  };
  return map[status] || { label: status, dot: 'dot-gray' };
}
