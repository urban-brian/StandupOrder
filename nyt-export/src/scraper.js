const RECIPE_BOX_URL = 'https://cooking.nytimes.com/recipe-box';
const INTER_RECIPE_DELAY_MS = 1500;
const PAGE_LOAD_WAIT_MS = 2000;

const RECIPE_CARD_LINK_SELECTOR = 'a[href^="/recipes/"]';
const NEXT_PAGE_SELECTOR = 'a[aria-label="Next page"], a[rel="next"], a[href*="page="]:last-of-type';

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

async function hasNextPage(page) {
  // Check for a visible "Next" pagination link
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return !!el && el.offsetParent !== null;
  }, NEXT_PAGE_SELECTOR);
}

async function collectRecipeUrls(page) {
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

    // Try URL-based next page first
    const nextUrl = pageUrl(pageNum + 1);
    const nextExists = await page.evaluate((sel) => !!document.querySelector(sel), NEXT_PAGE_SELECTOR);

    // Also try loading page N+1 directly and see if it has recipes
    if (!nextExists) {
      // Speculatively load next page to confirm it exists
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

    const data = await page.evaluate(() => {
      const getText = (sel) => document.querySelector(sel)?.textContent?.trim() ?? '';
      const getMeta = (prop) =>
        document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ??
        document.querySelector(`meta[name="${prop}"]`)?.getAttribute('content') ??
        '';

      // Title
      const title =
        getText('h1[class*="recipe-title"], h1[class*="RecipeTitle"], h1') || document.title;

      // Description
      const description =
        getText('[class*="recipe-summary"], [class*="RecipeSummary"], [class*="topnote"]') ||
        getMeta('og:description');

      // Image
      const imageUrl =
        getMeta('og:image') ||
        document.querySelector('img[class*="recipe-image"], img[class*="RecipeImage"]')?.src ||
        '';

      // Servings / yield
      const servings = getText(
        '[class*="yield"], [class*="Yield"], [data-testid*="yield"], [data-testid*="serving"]'
      );

      // Times
      const totalTime = getText(
        '[class*="total-time"], [class*="TotalTime"], [data-testid*="total-time"]'
      );
      const prepTime = getText(
        '[class*="prep-time"], [class*="PrepTime"], [data-testid*="prep-time"]'
      );
      const cookTime = getText(
        '[class*="cook-time"], [class*="CookTime"], [data-testid*="cook-time"]'
      );

      // Ingredients
      const ingredientEls = document.querySelectorAll(
        '[class*="ingredient"] li, [data-testid*="ingredient"] li, ul[class*="Ingredient"] li'
      );
      const ingredients = Array.from(ingredientEls)
        .map((el) => el.textContent.trim())
        .filter(Boolean)
        .join('\n');

      // Steps / directions
      const stepEls = document.querySelectorAll(
        '[class*="step"] li, [data-testid*="step"] li, ol[class*="Step"] li, [class*="instructions"] li'
      );
      const directions = Array.from(stepEls)
        .map((el) => el.textContent.trim())
        .filter(Boolean)
        .join('\n');

      return {
        title,
        description,
        imageUrl,
        servings,
        totalTime,
        prepTime,
        cookTime,
        ingredients,
        directions,
        sourceUrl: window.location.href,
      };
    });

    process.stdout.write('done\n');
    return data;
  } catch (err) {
    process.stdout.write(`ERROR: ${err.message}\n`);
    return null;
  }
}

export async function scrapeRecipeBox(page, alreadyExported = new Set()) {
  const urls = await collectRecipeUrls(page);

  const newUrls = urls.filter((url) => !alreadyExported.has(url));
  const skipped = urls.length - newUrls.length;
  if (skipped > 0) console.log(`Skipping ${skipped} already-exported recipe(s).\n`);
  if (newUrls.length === 0) {
    console.log('All recipes already exported.');
    return [];
  }

  const recipes = [];
  for (let i = 0; i < newUrls.length; i++) {
    const data = await extractRecipeData(page, newUrls[i], i + 1, newUrls.length);
    if (data) recipes.push(data);
  }

  return recipes;
}

export { collectRecipeUrls };
