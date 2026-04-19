import fs from 'fs';
import path from 'path';

export function exportJson(newRecipes, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const outPath = path.join(outputDir, 'recipes.json');

  // Merge with any previously exported recipes
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  } catch {}

  const existingUrls = new Set(existing.map((r) => r.source_url));
  const toAdd = newRecipes.filter((r) => !existingUrls.has(r.source_url));
  const merged = [...existing, ...toAdd];

  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`JSON updated: ${outPath} (${toAdd.length} added, ${merged.length} total)\n`);
  return outPath;
}
