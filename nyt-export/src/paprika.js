import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { ZipBuilder } from './zip.js';

const gzip = promisify(zlib.gzip);

function formatMinutes(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} hr${h > 1 ? 's' : ''}${m ? ` ${m} min` : ''}` : `${m} min`;
}

function buildPaprikaRecord(recipe) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.join('\n')
    : (recipe.ingredients || '');

  return {
    uid: recipe.uid || crypto.randomUUID(),
    name: recipe.name || 'Untitled Recipe',
    description: recipe.description || '',
    ingredients,
    directions: recipe.directions || '',
    servings: recipe.servings || '',
    total_time: formatMinutes(recipe.total_time),
    prep_time: formatMinutes(recipe.prep_time),
    cook_time: formatMinutes(recipe.active_cook_time),
    source: 'NYT Cooking',
    source_url: recipe.source_url || '',
    image_url: recipe.image_url || '',
    photo_url: '',
    photo: '',
    photo_hash: '',
    categories: recipe.categories?.length ? recipe.categories : ['NYT Cooking'],
    notes: recipe.notes || '',
    rating: 0,
    difficulty: '',
    on_favorites: false,
    scale: '',
    deleted: false,
    nutritional_info: '',
    created: now,
  };
}

export async function exportPaprika(recipes, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const zip = new ZipBuilder();

  console.log(`Building Paprika archive for ${recipes.length} recipe(s)...`);

  for (const recipe of recipes) {
    const record = buildPaprikaRecord(recipe);
    const json = JSON.stringify(record);
    const compressed = await gzip(Buffer.from(json, 'utf-8'));
    zip.addFile(`${record.uid}.paprikarecipe`, compressed);
  }

  const zipBuffer = zip.build();
  const outPath = path.join(outputDir, 'NYT-Recipes.paprikarecipes');
  fs.writeFileSync(outPath, zipBuffer);

  console.log(`Paprika archive saved to: ${outPath}\n`);
  return outPath;
}
