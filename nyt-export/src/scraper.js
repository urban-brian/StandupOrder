const RECIPE_BOX_URL = 'https://cooking.nytimes.com/recipe-box';
const INTER_RECIPE_DELAY_MS = 1500;
const PAGE_LOAD_WAIT_MS = 2000;

const RECIPE_CARD_LINK_SELECTOR = 'a[href^="/recipes/"]';
const NEXT_PAGE_SELECTOR = 'a[aria-label="Next page"], a[rel="next"], a[href*="page="]:last-of-type';

const FISH_TERMS = ['fish','seafood','salmon','tuna','shrimp','cod','halibut','tilapia','trout','bass','anchovy','sardine','mackerel','clam','lobster','crab','scallop','mussel','squid','octopus'];
const PASTA_TERMS = ['pasta','noodle','spaghetti','penne','rigatoni','linguine','fettuccine','lasagna','gnocchi','orzo','tagliatelle','bucatini','ziti','farfalle','fusilli','ravioli','tortellini'];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pageUrl(pageNum) {
  return pageNum === 1 ? RECIPE_BOX_URL : `${RECIPE_BOX_URL}?page=${pageNum}`;
}

async function getUrlsFromPage(page) {
  return page.evaluate((sel) => {
    const links = Array.from(document.querySelectorAll(sel));
    return [...new Set(links.map((a) => a.href))];
  }, RECIPE_CARD_LINK_SELECTOR);
}

export async function collectRecipeUrls(page) {
  const seen = new Set();
  let pageNum = 1;

  console.log('Collecting recipes from Recipe Box...');

  while (true) {
    const url = pageUrl(pageNum);
    process.stdout.write(`  Page ${pageNum}: ${url} ... `);
    await page.goto(url, { waitUntil: 'networkidle2' });
    await sleep(PAGE_LOAD_WAIT_MS);

    const urls = await getUrlsFromPage(page);
    if (urls.length === 0) {
      process.stdout.write('no recipes found, stopping.\n');
      break;
    }

    urls.forEach((u) => seen.add(u));
    process.stdout.write(`${urls.length} recipes (total: ${seen.size})\n`);

    const nextExists = await page.evaluate((sel) => !!document.querySelector(sel), NEXT_PAGE_SELECTOR);

    if (!nextExists) {
      const nextUrl = pageUrl(pageNum + 1);
      await page.goto(nextUrl, { waitUntil: 'networkidle2' });
      await sleep(PAGE_LOAD_WAIT_MS);
      const nextUrls = await getUrlsFromPage(page);
      if (nextUrls.length === 0) break;
      nextUrls.forEach((u) => seen.add(u));
      process.stdout.write(`  Page ${pageNum + 1} (speculative): ${nextUrls.length} recipes (total: ${seen.size})\n`);
      pageNum += 2;
    } else {
      pageNum++;
    }
  }

  const urls = [...seen];
  console.log(`\nFound ${urls.length} saved recipe(s) across ${pageNum - 1} page(s).\n`);
  return urls;
}

async function extractRecipeData(page, url, index, total) {
  process.stdout.write(`[${index}/${total}] Scraping: ${url} ... `);

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await sleep(INTER_RECIPE_DELAY_MS);

    const data = await page.evaluate((fishTerms, pastaTerms) => {
      // ── Helpers ──────────────────────────────────────────────────────────────
      function parseIsoDuration(str) {
        const m = (str || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        if (!m) return null;
        const minutes = parseInt(m[1] || 0) * 60 + parseInt(m[2] || 0);
        return minutes || null;
      }

      function extractId(href) {
        const m = href.match(/\/recipes\/(\d+)-/);
        return m ? m[1] : null;
      }

      function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
      }

      function getMetaContent(prop) {
        return (
          document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ||
          document.querySelector(`meta[name="${prop}"]`)?.getAttribute('content') ||
          ''
        );
      }

      function getText(sel) {
        return document.querySelector(sel)?.textContent?.trim() ?? '';
      }

      // ── JSON-LD extraction ────────────────────────────────────────────────
      let ld = null;
      document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
        try {
          const parsed = JSON.parse(el.textContent);
          const candidates = Array.isArray(parsed) ? parsed : [parsed];
          for (const c of candidates) {
            if (c['@type'] === 'Recipe' || (Array.isArray(c['@type']) && c['@type'].includes('Recipe'))) {
              ld = c;
              break;
            }
          }
        } catch { /* malformed JSON-LD */ }
      });

      const sourceUrl = window.location.href;
      const id = extractId(sourceUrl);

      // ── Fields from JSON-LD (preferred) with CSS fallbacks ───────────────
      const name = ld?.name || getText('h1[class*="recipe-title"], h1[class*="RecipeTitle"], h1') || document.title;

      const description = ld?.description ||
        getText('[class*="recipe-summary"], [class*="RecipeSummary"], [class*="topnote"]') ||
        getMetaContent('og:description');

      const rawImage = ld?.image;
      const image_url = (Array.isArray(rawImage) ? rawImage[0] : rawImage) ||
        getMetaContent('og:image') ||
        document.querySelector('img[class*="recipe-image"], img[class*="RecipeImage"]')?.src ||
        '';

      const total_time = parseIsoDuration(ld?.totalTime) ??
        (() => { const t = getText('[class*="total-time"], [class*="TotalTime"], [data-testid*="total-time"]'); return t ? null : null; })();

      const prep_time = parseIsoDuration(ld?.prepTime) ?? null;
      const active_cook_time = parseIsoDuration(ld?.cookTime) ?? null;

      const rawYield = ld?.recipeYield;
      const servings = (Array.isArray(rawYield) ? rawYield[0] : rawYield)?.replace(/\s*servings?/i, '').trim() ||
        getText('[class*="yield"], [class*="Yield"], [data-testid*="yield"], [data-testid*="serving"]') ||
        null;

      // Ingredients — JSON-LD gives a clean array
      const ingredients = ld?.recipeIngredient?.length
        ? ld.recipeIngredient
        : Array.from(document.querySelectorAll('[class*="ingredient"] li, [data-testid*="ingredient"] li, ul[class*="Ingredient"] li'))
            .map((el) => el.textContent.trim()).filter(Boolean);

      // Directions — join step objects/strings into one string
      const rawInstructions = ld?.recipeInstructions;
      let directions = '';
      if (Array.isArray(rawInstructions) && rawInstructions.length) {
        directions = rawInstructions
          .map((step) => (typeof step === 'string' ? step : step.text || ''))
          .filter(Boolean)
          .join('\n');
      } else {
        directions = Array.from(document.querySelectorAll(
          '[class*="step"] li, [data-testid*="step"] li, ol[class*="Step"] li, [class*="instructions"] li'
        )).map((el) => el.textContent.trim()).filter(Boolean).join('\n');
      }

      // Notes — only in HTML, not JSON-LD
      const notes = getText('[class*="topnote"], [class*="Topnote"], [class*="cook-note"], [class*="CookNote"], [class*="tip"]:not(script)') || null;

      // Cuisine
      const cuisine_type = ld?.recipeCuisine || null;

      // Categories / tags
      const kwRaw = ld?.keywords;
      const keywords = typeof kwRaw === 'string'
        ? kwRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : toArray(kwRaw);
      const recipeCategory = toArray(ld?.recipeCategory);
      const categories = [...new Set([...keywords, ...recipeCategory])].filter(Boolean);

      // Dietary flags
      const diets = toArray(ld?.suitableForDiet).map((s) => s.toLowerCase());
      const is_vegetarian = diets.some((d) => d.includes('vegetarian'));

      // Infer fish / pasta from combined keywords + name
      const haystack = [...categories, name].join(' ').toLowerCase();
      const is_fish  = fishTerms.some((t) => haystack.includes(t));
      const is_pasta = pastaTerms.some((t) => haystack.includes(t));

      return {
        id: id || crypto.randomUUID(),
        uid: id || null,
        name,
        source_url: sourceUrl,
        total_time,
        active_cook_time,
        prep_time,
        servings,
        ingredients,
        directions,
        notes,
        description,
        cuisine_type,
        spice_level: null,
        make_ahead_potential: null,
        is_vegetarian,
        is_fish,
        is_pasta,
        categories,
        image_url,
        pdf_path: null,          // populated by pdf-exporter after saving
        source: 'nyt_cooking',
        imported_at: new Date().toISOString(),
        approved: true,
      };
    }, FISH_TERMS, PASTA_TERMS);

    process.stdout.write('done\n');
    return data;
  } catch (err) {
    process.stdout.write(`ERROR: ${err.message}\n`);
    return null;
  }
}

/**
 * Scrape recipe data for a specific list of URLs.
 * Use this when you already have the URL list (avoids re-fetching the recipe box).
 */
export async function scrapeRecipeData(page, urls) {
  const recipes = [];
  for (let i = 0; i < urls.length; i++) {
    const data = await extractRecipeData(page, urls[i], i + 1, urls.length);
    if (data) recipes.push(data);
  }
  return recipes;
}
