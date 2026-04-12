import fs from 'fs';
import path from 'path';

export function exportJson(recipes, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const outPath = path.join(outputDir, 'recipes.json');
  fs.writeFileSync(outPath, JSON.stringify(recipes, null, 2), 'utf-8');

  console.log(`JSON export saved to: ${outPath} (${recipes.length} recipe(s))\n`);
  return outPath;
}
