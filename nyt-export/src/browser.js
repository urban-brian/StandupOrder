import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import readline from 'readline';
import os from 'os';
import path from 'path';
import fs from 'fs';

puppeteer.use(StealthPlugin());

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE_DIR = path.join(os.homedir(), '.nyt-export-profile');
const NYT_COOKING_URL = 'https://cooking.nytimes.com';
const LOGGED_IN_SELECTOR = '[href="/recipe-box"], [href*="recipe-box"]';

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function isLoggedIn(page) {
  try {
    await page.goto(NYT_COOKING_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    return !!(await page.$(LOGGED_IN_SELECTOR));
  } catch {
    return false;
  }
}

export async function launchBrowser() {
  const firstRun = !fs.existsSync(PROFILE_DIR);

  // First run: open headed so the user can log in
  if (firstRun) {
    console.log('First run — opening Chrome so you can log in to NYT Cooking...\n');
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: PROFILE_DIR,
    headless: firstRun ? false : 'new',
    defaultViewport: firstRun ? null : { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  if (firstRun) {
    await page.goto(NYT_COOKING_URL, { waitUntil: 'domcontentloaded' });
    await waitForEnter('Log in to NYT Cooking, then press Enter here to start the export: ');
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      await browser.close();
      // Remove profile so next run tries again
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
      throw new Error('Login not detected. Please re-run and log in before pressing Enter.');
    }
    console.log('\nLogin saved. Future runs will be fully headless.\n');
  } else {
    console.log('Using saved session (headless)...\n');
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      await browser.close();
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
      throw new Error('Saved session expired. Re-run to log in again.');
    }
  }

  return { browser, page };
}
