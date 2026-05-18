#!/usr/bin/env node
'use strict';

/**
 * LinkedIn Contact Research
 * Searches LinkedIn People for contacts at a target company.
 *
 * Usage:
 *   node executor/integrations/linkedin-research.js \
 *     --company "Acme Corp" \
 *     [--title "COO OR Operations Manager"] \
 *     [--keywords "additional search terms"] \
 *     [--output /path/to/results.json]
 *
 * Requires: ~/.agent_linkedin_cookies.json (run linkedin-setup.js first)
 * Outputs:  agent-state/linkedin-search-results.json (or --output path)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const COOKIES_FILE = path.join(os.homedir(), '.agent_linkedin_cookies.json');
const DEFAULT_OUTPUT = path.join(__dirname, '../../agent-state/linkedin-search-results.json');

function getArg(name) {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function research() {
  const company    = getArg('company');
  const title      = getArg('title');
  const keywords   = getArg('keywords');
  const outputFile = getArg('output') || DEFAULT_OUTPUT;

  if (!company && !keywords) {
    console.error('Usage: node linkedin-research.js --company "Company Name" [--title "..."] [--keywords "..."]');
    process.exit(1);
  }

  if (!fs.existsSync(COOKIES_FILE)) {
    console.error(`No LinkedIn session found at ${COOKIES_FILE}`);
    console.error('Run first: node executor/integrations/linkedin-setup.js');
    process.exit(1);
  }

  let cookies;
  try {
    cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
  } catch (e) {
    console.error('Could not read LinkedIn cookies:', e.message);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // Build search URL — LinkedIn people search with company filter
    const params = new URLSearchParams({ origin: 'GLOBAL_SEARCH_HEADER' });

    const searchKeywords = [company, keywords].filter(Boolean).join(' ');
    params.set('keywords', searchKeywords);

    if (title) {
      params.set('title', title);
    }

    const searchUrl = `https://www.linkedin.com/search/results/people/?${params.toString()}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Detect session expiry
    const url = page.url();
    if (url.includes('/login') || url.includes('/checkpoint') || url.includes('/authwall')) {
      console.error('LinkedIn session expired — re-run linkedin-setup.js to refresh.');
      process.exit(1);
    }

    // Wait for results to load
    await page.waitForSelector(
      '.reusable-search__result-container, .search-results-container, [data-view-name]',
      { timeout: 15000 }
    ).catch(() => {});

    // Human-like delay before scraping
    await delay(1200 + Math.random() * 800);

    const results = await page.evaluate(() => {
      const items = [];

      // Try both selector patterns LinkedIn has used
      const cards = document.querySelectorAll(
        '[data-view-name="search-entity-result-universal-template"], .reusable-search__result-container'
      );

      cards.forEach(card => {
        // Name — LinkedIn uses aria-hidden spans inside the link
        const nameEl =
          card.querySelector('.entity-result__title-text a span[aria-hidden="true"]') ||
          card.querySelector('.entity-result__title-text a');

        // Profile URL
        const linkEl =
          card.querySelector('a.app-aware-link[href*="/in/"]') ||
          card.querySelector('a[href*="/in/"]');

        if (!nameEl || !linkEl) return;

        const rawHref = linkEl.getAttribute('href') || '';
        const cleanUrl = rawHref.split('?')[0];
        const profileUrl = cleanUrl.startsWith('http')
          ? cleanUrl
          : `https://www.linkedin.com${cleanUrl}`;

        const titleEl    = card.querySelector('.entity-result__primary-subtitle');
        const locationEl = card.querySelector('.entity-result__secondary-subtitle');

        items.push({
          name:        nameEl.textContent.trim(),
          title:       titleEl?.textContent.trim()    || '',
          location:    locationEl?.textContent.trim() || '',
          linkedinUrl: profileUrl,
        });
      });

      return items;
    });

    const output = {
      query:     { company, title, keywords },
      company,
      results:   results.slice(0, 10),
      count:     results.length,
      timestamp: new Date().toISOString(),
    };

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

    console.log(`Found ${results.length} result(s). Saved to: ${outputFile}`);
    console.log(JSON.stringify(output, null, 2));

  } finally {
    await browser.close();
  }
}

research().catch(err => {
  console.error('LinkedIn research error:', err.message);
  process.exit(1);
});
