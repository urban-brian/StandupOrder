import puppeteer from 'puppeteer';
import readline from 'readline';

const NYT_COOKING_URL = 'https://cooking.nytimes.com';

// Selector present only when logged in (the "Recipe Box" nav link)
const LOGGED_IN_SELECTOR = 'a[href="/recipe-box"]';
const LOGIN_CHECK_INTERVAL_MS = 2000;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function waitForLogin(page) {
  console.log('\nWaiting for you to log in to NYT Cooking...');
  console.log('(You can also press Enter here once you are logged in)\n');

  let resolved = false;

  const enterPromise = waitForEnter('Press Enter once logged in: ').then(() => {
    resolved = true;
  });

  const pollPromise = new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(async () => {
      if (resolved) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (Date.now() - start > LOGIN_TIMEOUT_MS) {
        clearInterval(interval);
        reject(new Error('Timed out waiting for login (5 minutes). Please try again.'));
        return;
      }
      try {
        const found = await page.$(LOGGED_IN_SELECTOR);
        if (found) {
          resolved = true;
          clearInterval(interval);
          resolve();
        }
      } catch {
        // page may be navigating; ignore and retry
      }
    }, LOGIN_CHECK_INTERVAL_MS);
  });

  await Promise.race([enterPromise, pollPromise]);
  console.log('\nLogin detected. Starting export...\n');
}

export async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Mimic a real browser to reduce bot-detection risk
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  console.log(`Opening NYT Cooking at ${NYT_COOKING_URL} ...`);
  await page.goto(NYT_COOKING_URL, { waitUntil: 'domcontentloaded' });

  // Check if already logged in
  const alreadyLoggedIn = await page.$(LOGGED_IN_SELECTOR);
  if (!alreadyLoggedIn) {
    await waitForLogin(page);
  } else {
    console.log('Already logged in. Starting export...\n');
  }

  return { browser, page };
}
