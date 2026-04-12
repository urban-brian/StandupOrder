import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from './src/browser.js';
import { scrapeRecipeBox } from './src/scraper.js';
import { exportPdfs, loadManifest } from './src/pdf-exporter.js';
import { exportPaprika } from './src/paprika.js';
import { exportJson } from './src/json-exporter.js';

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

    // Load manifest of already-exported recipe URLs
    const exportedUrls = loadManifest(OUTPUT_DIR);

    // 1. Scrape only recipes not yet exported
    const recipes = await scrapeRecipeBox(page, exportedUrls);

    if (recipes.length === 0) {
      await browser.close();
      return;
    }

    // 2. Always export JSON
    exportJson(recipes, OUTPUT_DIR);

    // 3. Export PDFs (always locally; opt-in via EXPORT_PDF=true in CI)
    if (EXPORT_PDF) {
      await exportPdfs(page, recipes, PDF_DIR, exportedUrls);
    }

    // 4. Export Paprika archive
    await exportPaprika(recipes, OUTPUT_DIR);

    // Summary
    console.log('=== Export complete ===');
    console.log(`  Recipes exported : ${recipes.length}`);
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
