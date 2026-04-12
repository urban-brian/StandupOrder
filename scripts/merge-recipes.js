#!/usr/bin/env node
// scripts/merge-recipes.js
// Merges scraped recipes JSON into the repo's scraped_recipes.json
// Usage: node scripts/merge-recipes.js <input.json> <output.json>
//
// This script is called by the GitLab CI scrape-recipes job.
// It deduplicates by 'uid' field so re-running never creates duplicates.

const fs = require('fs');
const path = require('path');

const [,, inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node merge-recipes.js <input.json> <output.json>');
  process.exit(1);
}

// Read new scraped recipes
let newRecipes = [];
try {
  const raw = fs.readFileSync(inputPath, 'utf8');
  newRecipes = JSON.parse(raw);
  if (!Array.isArray(newRecipes)) {
    console.error('Input JSON must be an array of recipes');
    process.exit(1);
  }
} catch (e) {
  console.error(`Failed to read input file: ${e.message}`);
  process.exit(1);
}

// Read existing scraped recipes (if any)
let existing = [];
const absOut = path.resolve(outputPath);
if (fs.existsSync(absOut)) {
  try {
    existing = JSON.parse(fs.readFileSync(absOut, 'utf8'));
    if (!Array.isArray(existing)) existing = [];
  } catch (e) {
    existing = [];
  }
}

// Deduplicate by uid
const existingUids = new Set(existing.map(r => r.uid).filter(Boolean));
const added = [];

for (const recipe of newRecipes) {
  const uid = recipe.uid || recipe.id;
  if (!uid) {
    console.warn(`Recipe "${recipe.name}" has no uid — skipping`);
    continue;
  }
  if (!existingUids.has(uid)) {
    existing.push({ ...recipe, uid });
    existingUids.add(uid);
    added.push(recipe.name || uid);
  }
}

// Write output
fs.mkdirSync(path.dirname(absOut), { recursive: true });
fs.writeFileSync(absOut, JSON.stringify(existing, null, 2));

console.log(`Merge complete: ${added.length} new recipe(s) added.`);
if (added.length > 0) {
  console.log('New recipes:', added.join(', '));
}
