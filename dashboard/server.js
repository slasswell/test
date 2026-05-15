const express = require('express');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const cors = require('cors');
const { exec } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

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

// ── Dialog ────────────────────────────────────────────────────────────

const DIALOG_HISTORY_FILE = path.join(STATE_DIR, 'dialog-history.json');

function readDialogData() {
  const raw = readJSON(DIALOG_HISTORY_FILE, {});
  // Migrate old single-session format
  if (Array.isArray(raw.history) && !raw.sessions) {
    return { sessions: { general: { history: raw.history, label: 'General', updatedAt: raw.updatedAt } } };
  }
  if (!raw.sessions) raw.sessions = {};
  return raw;
}

app.get('/api/dialog/history', (req, res) => {
  const sessionId = req.query.sessionId || 'general';
  const data = readDialogData();
  const session = data.sessions[sessionId] || {};
  res.json({ history: session.history || [], sessionId });
});

app.delete('/api/dialog/history', (req, res) => {
  const sessionId = req.query.sessionId || 'general';
  const data = readDialogData();
  if (data.sessions[sessionId]) {
    data.sessions[sessionId].history = [];
    data.sessions[sessionId].updatedAt = new Date().toISOString();
    writeJSON(DIALOG_HISTORY_FILE, data);
  }
  res.json({ ok: true });
});

app.post('/api/dialog', async (req, res) => {
  const { message, history = [], sessionId = 'general' } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set — add it to ~/.agent_env' });
  }

  const client = new Anthropic({ apiKey });
  const queueItems = readAllQueueItems();
  const pending = queueItems.filter(i => i.status === 'PENDING_APPROVAL');

  let system = `You are the Bridgeworks AI Agent — a strategic business assistant for Scott Lasswell at Bridgeworks Consulting, an AI consulting firm for SMBs based in Denver, CO.

Your role: help Scott make decisions about BD prospects, review outreach drafts, discuss strategy, and refine content. Be direct and specific — no filler.

Company context: Bridgeworks serves SMBs (5–200 employees) in professional services, healthcare admin, construction, real estate, retail, and logistics. ICP signal: operations-heavy businesses with manual workflow pain.`;

  // Prospect session — inject full prospect context
  let sessionLabel = 'General';
  if (sessionId.startsWith('prospect:')) {
    const prospectId = sessionId.replace('prospect:', '');
    const prospectsData = readJSON(path.join(STATE_DIR, 'prospects.json'), { prospects: [] });
    const prospect = (prospectsData.prospects || []).find(p => p.id === prospectId);

    if (prospect) {
      sessionLabel = prospect.company;
      const contacts = (prospect.contacts || []).map(c =>
        `  - ${c.name}, ${c.title}${c.linkedin ? ` (${c.linkedin})` : ''}${c.email ? ` <${c.email}>` : ''}`
      ).join('\n') || '  (none yet)';

      const signals = (prospect.signals || []).map(s => `  - ${s}`).join('\n') || '  (none)';

      system += `\n\n━━ PROSPECT IN FOCUS ━━
Company: ${prospect.company}
Industry: ${prospect.industry || '—'}
Size: ${prospect.size || '—'} employees
Location: ${prospect.location || '—'}
Fit Score: ${prospect.fitScore}/10
Pipeline Stage: ${prospect.status}
Added: ${prospect.addedAt?.slice(0, 10) || '—'}
Last Activity: ${prospect.lastActivity?.slice(0, 10) || '—'}

Buying Signals:
${signals}

Contacts:
${contacts}

Notes: ${prospect.notes || '(none)'}`;

      // Include any related queue items for this company
      const related = queueItems.filter(i =>
        i.status !== 'REJECTED' &&
        ((i.metadata?.company === prospect.company) ||
         (i.body || '').toLowerCase().includes(prospect.company.toLowerCase()))
      ).slice(0, 5);

      if (related.length > 0) {
        system += `\n\nRelated queue items:\n` + related.map(i =>
          `  - [${i.type}] "${i.title}" (${i.status})`
        ).join('\n');
      }
    }
  } else {
    // General session — summarise queue
    system += `\n\nQueue: ${pending.length} pending, ${queueItems.length} total.`;
    if (pending.length > 0) {
      system += '\nPending:\n' + pending.slice(0, 8).map(i =>
        `  - [${i.type}] "${i.title}"`
      ).join('\n');
    }
  }

  const messages = [...history, { role: 'user', content: message }];

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      system,
      messages,
    });

    const reply = response.content[0].text;
    const updated = [...messages, { role: 'assistant', content: reply }];

    const data = readDialogData();
    data.sessions[sessionId] = {
      history: updated.slice(-50),
      label: sessionLabel,
      updatedAt: new Date().toISOString(),
    };
    writeJSON(DIALOG_HISTORY_FILE, data);

    res.json({ reply, history: updated });
  } catch (err) {
    console.error('[dialog]', err.message);
    res.status(500).json({ error: err.message });
  }
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
