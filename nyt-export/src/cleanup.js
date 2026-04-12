import fs from 'fs';
import path from 'path';

const MANIFEST_FILE = 'exported-urls.json';

function sanitizeFilename(name) {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function cleanupDeleted(currentUrls, outputDir) {
  const manifestPath = path.join(outputDir, MANIFEST_FILE);
  const recipesPath = path.join(outputDir, 'recipes.json');
  const pdfsDir = path.join(outputDir, 'pdfs');

  // Load manifest — nothing to do if it doesn't exist yet
  let manifestUrls;
  try {
    manifestUrls = new Set(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')));
  } catch {
    return;
  }

  const deletedUrls = [...manifestUrls].filter((url) => !currentUrls.has(url));
  if (deletedUrls.length === 0) return;

  console.log(`Removing ${deletedUrls.length} recipe(s) no longer in your Recipe Box...\n`);

  // Load recipes.json to look up titles → PDF filenames
  let recipes = [];
  try {
    recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf-8'));
  } catch {}

  const deletedSet = new Set(deletedUrls);

  for (const url of deletedUrls) {
    const recipe = recipes.find((r) => r.sourceUrl === url);
    if (recipe?.title) {
      const pdfPath = path.join(pdfsDir, `${sanitizeFilename(recipe.title)}.pdf`);
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        console.log(`  Deleted PDF : ${path.basename(pdfPath)}`);
      }
      console.log(`  Removed     : ${recipe.title}`);
    } else {
      console.log(`  Removed     : ${url}`);
    }
  }

  // Update recipes.json
  const updatedRecipes = recipes.filter((r) => !deletedSet.has(r.sourceUrl));
  fs.writeFileSync(recipesPath, JSON.stringify(updatedRecipes, null, 2), 'utf-8');

  // Update manifest
  const updatedManifest = [...manifestUrls].filter((url) => !deletedSet.has(url));
  fs.writeFileSync(manifestPath, JSON.stringify(updatedManifest, null, 2));

  console.log(`\nCleanup complete: ${deletedUrls.length} recipe(s) removed.\n`);
}
