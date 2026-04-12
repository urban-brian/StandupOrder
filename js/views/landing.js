// js/views/landing.js — Name selection screen

import { login, isLoggedIn, getCurrentUser } from '../auth.js';
import { FAMILY_MEMBERS } from '../config.js';
import { navigate } from '../router.js';
import { toast } from '../ui.js';

export function render() {
  // If already logged in, redirect
  if (isLoggedIn()) {
    navigate('/vote');
    return;
  }

  document.getElementById('app-nav').classList.add('hidden');
  document.getElementById('bottom-nav').classList.add('hidden');
  document.getElementById('app-content').innerHTML = '';

  const avatarColors = [
    'linear-gradient(135deg, #C8553D, #E8724A)',
    'linear-gradient(135deg, #7B9E87, #5C7F6A)',
    'linear-gradient(135deg, #8B5E3C, #C8893D)',
    'linear-gradient(135deg, #5C7F9E, #3D5C7F)',
    'linear-gradient(135deg, #9E7B8B, #7F5C6A)',
    'linear-gradient(135deg, #C8A83D, #A88C2B)',
  ];

  const el = document.createElement('div');
  el.className = 'landing-page';
  el.innerHTML = `
    <div style="text-align:center; margin-bottom: 8px;">
      <div style="font-size:2.5rem; margin-bottom:8px;">🍽️</div>
      <div class="landing-logo">What's for <span>Dinner?</span></div>
      <div class="landing-tagline">Pick your name to get started</div>
    </div>
    <div class="name-grid">
      ${FAMILY_MEMBERS.map((m, i) => `
        <button class="name-btn" data-name="${m.name}">
          <div class="name-avatar" style="background: ${avatarColors[i % avatarColors.length]}">
            ${m.name.charAt(0)}
          </div>
          ${m.name}
          ${m.admin ? '<small>Admin</small>' : ''}
        </button>
      `).join('')}
    </div>
  `;

  document.getElementById('app-content').appendChild(el);

  // Bind clicks
  el.querySelectorAll('.name-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      login(name);
      toast(`Welcome, ${name}!`);
      navigate('/vote');
    });
  });
}
