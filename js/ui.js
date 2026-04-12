// js/ui.js — Shared UI utilities (toast, nav highlighting)

import { isAdmin, isLoggedIn, logout, getCurrentUser } from './auth.js';
import { isDirty, commitSession } from './store.js';
import { navigate } from './router.js';

// --- Toast notifications ---
let toastContainer = null;

export function toast(message, type = '') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const el = document.createElement('div');
  el.className = `toast${type ? ' ' + type : ''}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

// --- Nav highlight ---
export function setNav(active) {
  // Update top nav user info
  const navUser = document.getElementById('nav-user-name');
  if (navUser) navUser.textContent = getCurrentUser() || '';

  // Show/hide nav
  const topNav = document.getElementById('app-nav');
  const bottomNav = document.getElementById('bottom-nav');

  if (isLoggedIn()) {
    topNav?.classList.remove('hidden');
    bottomNav?.classList.remove('hidden');
  }

  // Highlight bottom nav
  document.querySelectorAll('.bottom-nav a').forEach(a => {
    a.classList.remove('active');
    const href = a.getAttribute('href')?.replace('#/', '').replace('#', '') || '';
    if (active === href || (active === 'admin' && href.startsWith('admin'))) {
      a.classList.add('active');
    }
  });

  // Update admin visibility
  const adminItems = document.querySelectorAll('[data-admin-only]');
  adminItems.forEach(el => {
    el.style.display = isAdmin() ? '' : 'none';
  });
}

// --- Init nav event listeners ---
export function initNav() {
  // Sign out button
  document.getElementById('signout-btn')?.addEventListener('click', async () => {
    if (isDirty()) {
      const ok = confirm('You have unsaved changes. Save before signing out?');
      if (ok) {
        try {
          await commitSession('session end: save changes');
          toast('Changes saved!', 'success');
        } catch (e) {
          toast(`Save failed: ${e.message}`, 'error');
        }
      }
    }
    logout();
    navigate('/');
  });

  // Auth change listener
  window.addEventListener('auth:change', ({ detail }) => {
    const topNav = document.getElementById('app-nav');
    const bottomNav = document.getElementById('bottom-nav');

    if (!detail.name) {
      topNav?.classList.add('hidden');
      bottomNav?.classList.add('hidden');
    } else {
      topNav?.classList.remove('hidden');
      bottomNav?.classList.remove('hidden');
      const navUser = document.getElementById('nav-user-name');
      if (navUser) navUser.textContent = detail.name;
    }

    // Toggle admin-only nav items
    document.querySelectorAll('[data-admin-only]').forEach(el => {
      el.style.display = detail.name === 'Brian' ? '' : 'none';
    });
  });
}
