const express = require('express');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3333;
const STATE_DIR = path.join(__dirname, '../agent-state');
const PROJECT_DIR = path.join(__dirname, '..');

const QUEUE_FILES = [
  'content-queue.json',
  'outreach-queue.json',
  'website-queue.json',
  'intel-queue.json',
];

// ── Helpers ──────────────────────────────────────────────────────────

function readJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readAllQueueItems() {
  const all = [];
  for (const file of QUEUE_FILES) {
    const items = readJSON(path.join(STATE_DIR, file), []);
    if (Array.isArray(items)) all.push(...items);
  }
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findItem(id) {
  for (const file of QUEUE_FILES) {
    const filePath = path.join(STATE_DIR, file);
    const items = readJSON(filePath, []);
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) return { item: items[idx], filePath, items, idx };
  }
  return null;
}

function updateItem(id, updates) {
  const found = findItem(id);
  if (!found) return null;
  Object.assign(found.items[found.idx], updates);
  writeJSON(found.filePath, found.items);
  return found.items[found.idx];
}

// ── SSE ───────────────────────────────────────────────────────────────

const sseClients = new Set();

chokidar
  .watch(STATE_DIR, { ignoreInitial: true, depth: 2 })
  .on('change', (filePath) => {
    const event = JSON.stringify({ type: 'stateChange', file: path.relative(STATE_DIR, filePath) });
    for (const client of sseClients) {
      client.write(`data: ${event}\n\n`);
    }
  });

// ── Middleware ────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── SSE endpoint ──────────────────────────────────────────────────────

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write('data: {"type":"connected"}\n\n');

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// ── Queue routes ──────────────────────────────────────────────────────

app.get('/api/queue', (req, res) => {
  res.json(readAllQueueItems().filter(i => i.status === 'PENDING_APPROVAL'));
});

app.get('/api/queue/all', (req, res) => {
  res.json(readAllQueueItems());
});

app.get('/api/queue/:id', (req, res) => {
  const found = findItem(req.params.id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  res.json(found.item);
});

app.post('/api/queue/:id/approve', (req, res) => {
  const item = updateItem(req.params.id, {
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/queue/:id/reject', (req, res) => {
  const item = updateItem(req.params.id, {
    status: 'REJECTED',
    rejectedAt: new Date().toISOString(),
    rejectionReason: req.body?.reason || null,
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/queue/:id/revise', (req, res) => {
  if (!req.body?.note) return res.status(400).json({ error: 'note is required' });
  const item = updateItem(req.params.id, {
    status: 'NEEDS_REVISION',
    revisionNote: req.body.note,
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// ── State routes ──────────────────────────────────────────────────────

app.get('/api/run-log', (req, res) => {
  const log = readJSON(path.join(STATE_DIR, 'run-log.json'), []);
  res.json([...log].reverse().slice(0, 50));
});

app.get('/api/state/competitors', (req, res) => {
  res.json(readJSON(path.join(STATE_DIR, 'competitors.json'), { competitors: [] }));
});

app.get('/api/state/prospects', (req, res) => {
  res.json(readJSON(path.join(STATE_DIR, 'prospects.json'), { prospects: [] }));
});

app.get('/api/state/content-calendar', (req, res) => {
  res.json(readJSON(path.join(STATE_DIR, 'content-calendar.json'), { entries: [] }));
});

app.get('/api/state/intel-briefs', (req, res) => {
  const briefsDir = path.join(STATE_DIR, 'intel-briefs');
  if (!fs.existsSync(briefsDir)) return res.json([]);
  const files = fs.readdirSync(briefsDir)
    .filter(f => f.endsWith('.md') || f.endsWith('.json'))
    .sort()
    .reverse();
  const briefs = files.map(f => ({
    filename: f,
    date: f.split('_')[0],
    content: fs.readFileSync(path.join(briefsDir, f), 'utf8'),
  }));
  res.json(briefs);
});

// ── Agent run trigger ─────────────────────────────────────────────────

app.post('/api/run/:module', (req, res) => {
  const { module } = req.params;
  const valid = ['daily', 'weekly', 'monthly', 'all'];
  if (!valid.includes(module)) {
    return res.status(400).json({ error: `Invalid module. Must be one of: ${valid.join(', ')}` });
  }

  const scriptPath = path.join(PROJECT_DIR, 'run_agent.sh');
  const child = exec(`bash "${scriptPath}" --module ${module}`, { cwd: PROJECT_DIR });
  child.unref();

  res.json({ success: true, message: `Agent started for module: ${module}`, pid: child.pid });
});

// ── Fallback ──────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Bridgeworks Agent Dashboard → http://localhost:${PORT}`);
});
