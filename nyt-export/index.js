import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from './src/browser.js';
import { scrapeRecipeBox } from './src/scraper.js';
import { exportPdfs, loadManifest } from './src/pdf-exporter.js';
import { exportPaprika } from './src/paprika.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const PDF_DIR = path.join(OUTPUT_DIR, 'pdfs');
const PAPRIKA_DIR = OUTPUT_DIR;

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

    // 2. Export each recipe as an individual PDF
    await exportPdfs(page, recipes, PDF_DIR, exportedUrls);

    // 3. Export all recipes as a .paprikarecipes archive
    await exportPaprika(recipes, PAPRIKA_DIR);

    // Summary
    console.log('=== Export complete ===');
    console.log(`  Recipes exported : ${recipes.length}`);
    console.log(`  PDFs saved to    : ${PDF_DIR}`);
    console.log(`  Paprika file     : ${path.join(PAPRIKA_DIR, 'NYT-Recipes.paprikarecipes')}`);
    console.log('\nTo import into Paprika: open the app and use File → Import (or drag the .paprikarecipes file onto the app).');
  } catch (err) {
    console.error('\nFatal error:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

main();
