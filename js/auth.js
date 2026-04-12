// js/auth.js — Session management (name-based, no passwords)

import { ADMIN_NAME } from './config.js';

const SESSION_KEY = 'mealplanner_user';

export function login(name) {
  sessionStorage.setItem(SESSION_KEY, name);
  dispatchEvent(new CustomEvent('auth:change', { detail: { name } }));
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  dispatchEvent(new CustomEvent('auth:change', { detail: { name: null } }));
}

export function getCurrentUser() {
  return sessionStorage.getItem(SESSION_KEY) || null;
}

export function isLoggedIn() {
  return !!getCurrentUser();
}

export function isAdmin() {
  return getCurrentUser() === ADMIN_NAME;
}

export function requireLogin() {
  if (!isLoggedIn()) {
    location.hash = '/';
    return false;
  }
  return true;
}

export function requireAdmin() {
  if (!isAdmin()) {
    location.hash = '/';
    return false;
  }
  return true;
}
