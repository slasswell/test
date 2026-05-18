#!/usr/bin/env node
'use strict';

/**
 * LinkedIn Session Setup
 * Run once interactively to authenticate and save cookies.
 * Usage: node executor/integrations/linkedin-setup.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const COOKIES_FILE = path.join(os.homedir(), '.agent_linkedin_cookies.json');

async function setup() {
  console.log('\nLinkedIn Session Setup');
  console.log('══════════════════════════════════════════');
  console.log('A browser window will open. Log in to LinkedIn, complete any');
  console.log('verification or 2FA, then return here and press Enter.\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/login');

  console.log('Browser opened → log in to LinkedIn now.');
  console.log('(Complete any CAPTCHA or 2FA — take your time.)\n');

  await waitForEnter('Press Enter once you\'re on your LinkedIn feed: ');

  const currentUrl = page.url();
  if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl.includes('/authwall')) {
    console.error('\nSession does not appear valid (still on a login/auth page).');
    console.error('Please try again after completing the full login flow.');
    await browser.close();
    process.exit(1);
  }

  const cookies = await context.cookies();
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2), { mode: 0o600 });

  console.log(`\nSession saved → ${COOKIES_FILE}`);
  console.log('The agent can now use LinkedIn research.\n');
  console.log('To test: node executor/integrations/linkedin-research.js --company "Acme Corp"');

  await browser.close();
}

function waitForEnter(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

setup().catch(err => {
  console.error('Setup error:', err.message);
  process.exit(1);
});
