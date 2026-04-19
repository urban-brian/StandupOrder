import fs from 'fs';
import path from 'path';

const INTER_PDF_DELAY_MS = 1000;
const MANIFEST_FILE = 'exported-urls.json';

export function loadManifest(outputDir) {
  const manifestPath = path.join(outputDir, MANIFEST_FILE);
  try {
    return new Set(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  } catch {
    return new Set();
  }
}

function saveManifest(outputDir, exportedUrls) {
  const manifestPath = path.join(outputDir, MANIFEST_FILE);
  fs.writeFileSync(manifestPath, JSON.stringify([...exportedUrls], null, 2));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function sanitizeFilename(name) {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export async function exportPdfs(page, recipes, outputDir, exportedUrls) {
  fs.mkdirSync(outputDir, { recursive: true });

  const total = recipes.length;
  console.log(`\nGenerating ${total} PDF(s) into ${outputDir} ...\n`);

  for (let i = 0; i < total; i++) {
    const recipe = recipes[i];
    const safeTitle = sanitizeFilename(recipe.name || `recipe-${i + 1}`);
    const filename = `${safeTitle}.pdf`;
    const filePath = path.join(outputDir, filename);

    process.stdout.write(`[${i + 1}/${total}] Saving "${filename}" ... `);

    try {
      await page.goto(recipe.source_url, { waitUntil: 'networkidle2' });

      await page.evaluate(() => {
        ['[id*="modal"]', '[class*="modal"]', '[class*="paywall"]', '[class*="overlay"]', '[class*="cookie-banner"]']
          .forEach((sel) => document.querySelectorAll(sel).forEach((el) => el.remove()));
      });

      await page.pdf({
        path: filePath,
        format: 'Letter',
        printBackground: true,
        margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
      });

      // Record the relative path so it appears in recipes.json
      recipe.pdf_path = `pdfs/${filename}`;

      exportedUrls.add(recipe.source_url);
      saveManifest(path.dirname(outputDir), exportedUrls);
      process.stdout.write('done\n');
    } catch (err) {
      process.stdout.write(`ERROR: ${err.message}\n`);
    }

    if (i < total - 1) await sleep(INTER_PDF_DELAY_MS);
  }

  console.log('\nPDF export complete.\n');
}
