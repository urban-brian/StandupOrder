import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from './src/browser.js';
import { collectRecipeUrls, scrapeRecipeData } from './src/scraper.js';
import { exportPdfs, loadManifest } from './src/pdf-exporter.js';
import { exportPaprika } from './src/paprika.js';
import { exportJson } from './src/json-exporter.js';
import { cleanupDeleted } from './src/cleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const PDF_DIR = path.join(OUTPUT_DIR, 'pdfs');

// In CI, skip PDFs by default (large/slow). Set EXPORT_PDF=true to enable in CI.
const IS_CI = process.env.CI === 'true';
const EXPORT_PDF = process.env.EXPORT_PDF === 'true' || !IS_CI;

async function main() {
  console.log('=== NYT Cooking Recipe Exporter ===\n');

  let browser;
  try {
    const { browser: b, page } = await launchBrowser();
    browser = b;

    // 1. Collect all current recipe URLs from the box (single fetch)
    const currentUrls = await collectRecipeUrls(page);
    const currentSet = new Set(currentUrls);

    // 2. Remove anything that was previously exported but is no longer in the box
    cleanupDeleted(currentSet, OUTPUT_DIR);

    // 3. Scrape only recipes not yet exported
    const exportedUrls = loadManifest(OUTPUT_DIR);
    const newUrls = currentUrls.filter((url) => !exportedUrls.has(url));

    if (newUrls.length === 0) {
      console.log('All recipes are up to date.');
      return;
    }

    const skipped = currentUrls.length - newUrls.length;
    if (skipped > 0) console.log(`Skipping ${skipped} already-exported recipe(s).\n`);

    const recipes = await scrapeRecipeData(page, newUrls);

    if (recipes.length === 0) return;

    // 4. Export JSON (merges with existing)
    exportJson(recipes, OUTPUT_DIR);

    // 5. Export PDFs (always locally; opt-in via EXPORT_PDF=true in CI)
    if (EXPORT_PDF) {
      await exportPdfs(page, recipes, PDF_DIR, exportedUrls);
    }

    // 6. Export Paprika archive
    await exportPaprika(recipes, OUTPUT_DIR);

    // Summary
    console.log('=== Export complete ===');
    console.log(`  New recipes      : ${recipes.length}`);
    console.log(`  JSON             : ${path.join(OUTPUT_DIR, 'recipes.json')}`);
    if (EXPORT_PDF) {
      console.log(`  PDFs saved to    : ${PDF_DIR}`);
    }
    console.log(`  Paprika file     : ${path.join(OUTPUT_DIR, 'NYT-Recipes.paprikarecipes')}`);
    console.log('\nTo import into Paprika: open the app and use File \u2192 Import (or drag the .paprikarecipes file onto the app).');
  } catch (err) {
    console.error('\nFatal error:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

main();
