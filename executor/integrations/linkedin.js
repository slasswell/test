const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// LinkedIn has no reliable personal posting API.
// This integration copies the post to clipboard and opens the LinkedIn composer.
// Dashboard surfaces a "EXPORTED — MANUAL PUBLISH REQUIRED" notification.

async function exportPost(item) {
  const text = item.body;

  // Write to a staging file as backup
  const stagingDir = path.join(__dirname, '../../agent-state/linkedin-staging');
  fs.mkdirSync(stagingDir, { recursive: true });
  const filename = `${new Date().toISOString().slice(0,10)}_${Date.now()}.txt`;
  fs.writeFileSync(path.join(stagingDir, filename), text, 'utf8');
  console.log(`[linkedin] Post saved to linkedin-staging/${filename}`);

  // Copy to clipboard (macOS)
  await copyToClipboard(text);

  // Open LinkedIn post composer
  await openURL('https://www.linkedin.com/feed/?shareActive=true');

  console.log('[linkedin] Post copied to clipboard. LinkedIn composer opened — paste and publish manually.');
  item.metadata = {
    ...item.metadata,
    stagingFile: `agent-state/linkedin-staging/${filename}`,
    exportedAt: new Date().toISOString(),
    note: 'EXPORTED — MANUAL PUBLISH REQUIRED. Post is in clipboard and staging file.',
  };
}

function copyToClipboard(text) {
  return new Promise((resolve) => {
    const child = exec('pbcopy');
    child.stdin.write(text);
    child.stdin.end();
    child.on('close', resolve);
    child.on('error', () => {
      console.warn('[linkedin] pbcopy not available (not on macOS?) — skipping clipboard copy');
      resolve();
    });
  });
}

function openURL(url) {
  return new Promise((resolve) => {
    exec(`open "${url}"`, (err) => {
      if (err) console.warn('[linkedin] Could not open browser:', err.message);
      resolve();
    });
  });
}

module.exports = { exportPost };
