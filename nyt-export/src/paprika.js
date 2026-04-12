import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { ZipBuilder } from './zip.js';

const gzip = promisify(zlib.gzip);

function buildPaprikaRecord(recipe) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  return {
    uid: crypto.randomUUID(),
    name: recipe.title || 'Untitled Recipe',
    description: recipe.description || '',
    ingredients: recipe.ingredients || '',
    directions: recipe.directions || '',
    servings: recipe.servings || '',
    total_time: recipe.totalTime || '',
    prep_time: recipe.prepTime || '',
    cook_time: recipe.cookTime || '',
    source: 'NYT Cooking',
    source_url: recipe.sourceUrl || '',
    image_url: recipe.imageUrl || '',
    photo_url: '',
    photo: '',
    photo_hash: '',
    categories: ['NYT Cooking'],
    notes: '',
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
