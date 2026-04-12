// js/app.js — App entry point: registers routes + starts router

import { register, start } from './router.js';
import { initNav } from './ui.js';
import { isLoggedIn, isAdmin } from './auth.js';
import { navigate } from './router.js';

import { render as renderLanding }          from './views/landing.js';
import { render as renderVote }             from './views/vote.js';
import { render as renderPlan }             from './views/plan.js';
import { render as renderSuggest }          from './views/suggest.js';
import { render as renderAdminDash }        from './views/admin-dashboard.js';
import { render as renderAdminRecipes }     from './views/admin-recipes.js';
import { render as renderAdminUpload }      from './views/admin-upload.js';
import { render as renderAdminVote }        from './views/admin-vote.js';
import { render as renderAdminPlan }        from './views/admin-plan.js';
import { render as renderAdminSync }        from './views/admin-sync.js';
import { render as renderAdminSuggestions } from './views/admin-suggestions.js';
import { render as renderSettings }         from './views/settings.js';

// Register all routes
register('/',                    renderLanding);
register('/vote',                renderVote);
register('/plan',                renderPlan);
register('/suggest',             renderSuggest);
register('/admin',               renderAdminDash);
register('/admin/recipes',       renderAdminRecipes);
register('/admin/upload',        renderAdminUpload);
register('/admin/vote',          renderAdminVote);
register('/admin/plan',          renderAdminPlan);
register('/admin/sync',          renderAdminSync);
register('/admin/suggestions',   renderAdminSuggestions);
register('/settings',            renderSettings);

// Init shared UI (nav event listeners)
initNav();

// Start the router
start();
