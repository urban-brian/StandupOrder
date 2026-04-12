// js/recipes.js — Recipe CRUD

import { get, set, getRecipes } from './store.js';
import { uploadBinaryFile } from './api.js';

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

export function getAllRecipes() {
  return getRecipes();
}

export function getApproved() {
  return getRecipes().filter(r => r.approved);
}

export function addRecipe(data) {
  const recipe = {
    id: uuid(),
    uid: data.uid || uuid(),
    name: data.name || 'Untitled Recipe',
    source_url: data.source_url || null,
    total_time: data.total_time ?? null,
    active_cook_time: data.active_cook_time ?? null,
    prep_time: data.prep_time ?? null,
    servings: data.servings || '4',
    ingredients: data.ingredients || [],
    directions: data.directions || '',
    notes: data.notes || '',
    description: data.description || '',
    cuisine_type: data.cuisine_type || '',
    spice_level: data.spice_level || 'mild',
    make_ahead_potential: data.make_ahead_potential ?? false,
    is_vegetarian: data.is_vegetarian ?? false,
    is_fish: data.is_fish ?? false,
    is_pasta: data.is_pasta ?? false,
    categories: data.categories || [],
    image_url: data.image_url || '',
    pdf_path: data.pdf_path || '',
    source: data.source || 'manual',
    imported_at: new Date().toISOString(),
    approved: data.approved ?? false,
  };

  const recipes = [...getRecipes(), recipe];
  set('recipes', recipes);
  return recipe;
}

export function updateRecipe(id, changes) {
  const recipes = getRecipes().map(r => r.id === id ? { ...r, ...changes } : r);
  set('recipes', recipes);
  return recipes.find(r => r.id === id);
}

export function deleteRecipe(id) {
  const recipes = getRecipes().filter(r => r.id !== id);
  set('recipes', recipes);
}

export function approveRecipe(id) {
  return updateRecipe(id, { approved: true });
}

// Merge recipes from scraper JSON (deduplicates by uid)
export function mergeScraperRecipes(scraperData) {
  const existing = getRecipes();
  const existingUids = new Set(existing.map(r => r.uid));
  const newRecipes = [];

  for (const r of scraperData) {
    if (existingUids.has(r.uid)) continue; // already imported
    newRecipes.push(addRecipe({
      ...r,
      source: 'scraper',
      approved: false,
      // Normalize fields
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : (r.ingredients || '').split('\n').filter(Boolean),
    }));
  }

  return newRecipes;
}

// Upload PDF and return the repo path
export async function uploadRecipePDF(file, recipeId) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `recipes/${recipeId}_${safeName}`;
        await uploadBinaryFile(path, base64, `upload recipe PDF: ${file.name}`);
        resolve(path);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read PDF file'));
    reader.readAsDataURL(file);
  });
}

// Read PDF as base64 for Claude
export function readPDFAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function formatTime(minutes) {
  if (!minutes) return '?';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function spiceBadge(level) {
  const map = { mild: '🌶️', medium: '🌶️🌶️', spicy: '🌶️🌶️🌶️' };
  return map[level] || '';
}
