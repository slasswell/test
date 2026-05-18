const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

const STATE_DIR = path.join(__dirname, '../agent-state');

const QUEUE_FILES = [
  'content-queue.json',
  'outreach-queue.json',
  'website-queue.json',
  'intel-queue.json',
];

function readJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`[executor] Failed to read ${filePath}:`, e.message);
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function routeToIntegration(item) {
  console.log(`[executor] Routing: ${item.type} — "${item.title}"`);
  try {
    switch (item.type) {
      case 'EMAIL_OUTREACH':
        await require('./integrations/gmail').send(item);
        break;
      case 'LINKEDIN_POST':
        await require('./integrations/linkedin').exportPost(item);
        break;
      case 'BLOG_POST':
      case 'WEBSITE_EDIT':
        await require('./integrations/publisher').publish(item);
        break;
      case 'INTEL_BRIEF':
      case 'BD_PROSPECT':
        // These are informational — mark executed, no external action needed
        console.log(`[executor] ${item.type} marked executed (informational item)`);
        break;
      default:
        console.warn(`[executor] No handler for type: ${item.type} — marking NEEDS_MANUAL_ACTION`);
        item.executionError = `No executor registered for type: ${item.type}`;
        item.status = 'EXECUTION_FAILED';
        return item;
    }
    item.status = 'EXECUTED';
    item.executedAt = new Date().toISOString();
    item.executionError = null;
  } catch (err) {
    console.error(`[executor] Execution failed for ${item.id}:`, err.message);
    item.status = 'EXECUTION_FAILED';
    item.executionError = err.message;
    item.executedAt = new Date().toISOString();
  }
  return item;
}

async function processFile(filePath) {
  const items = readJSON(filePath, []);
  if (!Array.isArray(items)) return;

  let changed = false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.status === 'APPROVED' && !item.executedAt) {
      items[i] = await routeToIntegration(item);
      changed = true;
    }
  }

  if (changed) {
    writeJSON(filePath, items);
    console.log(`[executor] Updated ${path.basename(filePath)}`);
  }
}

async function scanAll() {
  for (const file of QUEUE_FILES) {
    await processFile(path.join(STATE_DIR, file));
  }
}

// Watch for file changes
chokidar
  .watch(
    QUEUE_FILES.map(f => path.join(STATE_DIR, f)),
    { ignoreInitial: false, awaitWriteFinish: { stabilityThreshold: 300 } }
  )
  .on('add',    processFile)
  .on('change', processFile);

console.log('[executor] Watching agent-state/ for approved items…');

// Scan on startup in case items were approved while executor was offline
scanAll().catch(console.error);
