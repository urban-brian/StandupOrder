import fs from 'fs';
import path from 'path';

const INTER_PDF_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeFilename(name) {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')  // replace illegal filename chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);                  // cap length
}

export async function exportPdfs(page, recipes, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const total = recipes.length;
  console.log(`\nGenerating ${total} PDF(s) into ${outputDir} ...\n`);

  for (let i = 0; i < total; i++) {
    const recipe = recipes[i];
    const safeTitle = sanitizeFilename(recipe.title || `recipe-${i + 1}`);
    const filename = `${safeTitle}.pdf`;
    const filePath = path.join(outputDir, filename);

    process.stdout.write(`[${i + 1}/${total}] Saving "${filename}" ... `);

    try {
      await page.goto(recipe.sourceUrl, { waitUntil: 'networkidle2' });

      // Dismiss any cookie/paywall banners before printing
      await page.evaluate(() => {
        const selectors = [
          '[id*="modal"]',
          '[class*="modal"]',
          '[class*="paywall"]',
          '[class*="overlay"]',
          '[class*="cookie-banner"]',
        ];
        selectors.forEach((sel) => {
          document.querySelectorAll(sel).forEach((el) => el.remove());
        });
      });

      await page.pdf({
        path: filePath,
        format: 'Letter',
        printBackground: true,
        margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
      });

      process.stdout.write('done\n');
    } catch (err) {
      process.stdout.write(`ERROR: ${err.message}\n`);
    }

    if (i < total - 1) await sleep(INTER_PDF_DELAY_MS);
  }

  console.log('\nPDF export complete.\n');
}
