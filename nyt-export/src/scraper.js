const RECIPE_BOX_URL = 'https://cooking.nytimes.com/recipe-box';
const SCROLL_PAUSE_MS = 1500;
const INTER_RECIPE_DELAY_MS = 1500;

// Selectors — NYT Cooking uses data-testid and semantic markup
const RECIPE_CARD_LINK_SELECTOR = 'a[href^="/recipes/"]';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrollToBottom(page) {
  let previousCount = 0;
  let stableRounds = 0;

  while (stableRounds < 2) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await sleep(SCROLL_PAUSE_MS);

    const currentCount = await page.evaluate(
      (sel) => document.querySelectorAll(sel).length,
      RECIPE_CARD_LINK_SELECTOR
    );

    if (currentCount === previousCount) {
      stableRounds++;
    } else {
      stableRounds = 0;
      previousCount = currentCount;
    }
  }
}

async function collectRecipeUrls(page) {
  console.log('Navigating to Recipe Box...');
  await page.goto(RECIPE_BOX_URL, { waitUntil: 'networkidle2' });

  console.log('Scrolling to load all saved recipes...');
  await scrollToBottom(page);

  const urls = await page.evaluate((sel) => {
    const links = Array.from(document.querySelectorAll(sel));
    const seen = new Set();
    return links
      .map((a) => a.href)
      .filter((href) => {
        if (seen.has(href)) return false;
        seen.add(href);
        return true;
      });
  }, RECIPE_CARD_LINK_SELECTOR);

  console.log(`Found ${urls.length} saved recipe(s).\n`);
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

export async function scrapeRecipeBox(page) {
  const urls = await collectRecipeUrls(page);

  const recipes = [];
  for (let i = 0; i < urls.length; i++) {
    const data = await extractRecipeData(page, urls[i], i + 1, urls.length);
    if (data) recipes.push(data);
  }

  return recipes;
}

export { collectRecipeUrls };
