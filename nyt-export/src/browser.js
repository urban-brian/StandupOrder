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

// GitLab (and most CI systems) set CI=true automatically
const IS_CI = process.env.CI === 'true';

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function isLoggedIn(page) {
  try {
    await page.goto(NYT_COOKING_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // NYT nav is client-side rendered — wait for the element rather than relying on networkidle2
    await page.waitForSelector(LOGGED_IN_SELECTOR, { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a raw Cookie header string into Puppeteer cookie objects.
 * e.g. "NYT-S=abc123; AUID=xyz; ..."
 */
function parseCookieString(cookieStr) {
  return cookieStr
    .split(';')
    .map((pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return null;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      return { name, value, domain: '.nytimes.com', path: '/' };
    })
    .filter(Boolean);
}

async function launchCiBrowser() {
  const cookieStr = process.env.NYT_COOKIE;
  if (!cookieStr) {
    throw new Error(
      'CI mode requires the NYT_COOKIE environment variable.\n' +
      'Set it in GitLab: Settings → CI/CD → Variables → NYT_COOKIE (mark as Masked)\n' +
      'Value: copy the Cookie header from a logged-in browser session at cooking.nytimes.com'
    );
  }

  const launchOptions = {
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setCookie(...parseCookieString(cookieStr));

  console.log('Running in CI mode (headless). Verifying cookie auth...');
  const loggedIn = await isLoggedIn(page);
  if (!loggedIn) {
    await browser.close();
    throw new Error(
      'Cookie authentication failed — NYT_COOKIE may be expired.\n' +
      'Refresh it by copying a fresh Cookie header from cooking.nytimes.com in your browser.'
    );
  }
  console.log('Cookie authentication successful.\n');
  return { browser, page };
}

async function launchLocalBrowser() {
  const firstRun = !fs.existsSync(PROFILE_DIR);

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
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
      throw new Error('Login not detected. Please re-run and log in before pressing Enter.');
    }
    console.log('\nLogin saved. Future runs will be fully headless.\n');
  } else {
    console.log('Using saved session (headless)...\n');
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      await browser.close();
      throw new Error(
        'Saved session has expired. Delete the profile and re-run to log in again:\n' +
        `  rm -rf "${PROFILE_DIR}"`
      );
    }
  }

  return { browser, page };
}

export async function launchBrowser() {
  return IS_CI ? launchCiBrowser() : launchLocalBrowser();
}
