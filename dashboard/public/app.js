/* Forge Solutions Agent Dashboard — Frontend */

// ── State ─────────────────────────────────────────────────────────
const S = {
  view: 'queue',
  queue: [],
  log: [],
  prospects: { prospects: [] },
  contentCalendar: { entries: [] },
  intel: { briefs: [], queue: [] },
  dialog: { sessionId: 'general', history: [], cache: {}, loading: false },
};

// ── Utilities ─────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function preview(text, len = 160) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '…' : text;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ── Navigation ────────────────────────────────────────────────────

function navigate(view) {
  S.view = view;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle('active', el.id === `view-${view}`);
  });
  document.querySelector('.main').classList.toggle('main--chat', view === 'chat');
  renderView(view);
}

async function renderView(view) {
  switch (view) {
    case 'queue':    await renderQueue(); break;
    case 'content':  await renderContent(); break;
    case 'bd':       await renderBD(); break;
    case 'chat':     await renderChat(); break;
    case 'intel':    await renderIntel(); break;
    case 'log':       await renderLog(); break;
    case 'playbooks': await renderPlaybooks(); break;
    case 'settings':  renderSettings(); break;
  }
}

// ── Approval Queue ────────────────────────────────────────────────

async function renderQueue() {
  const el = document.getElementById('view-queue');
  el.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const all = await api('GET', '/api/queue/all');
    S.queue = all;

    const pending  = all.filter(i => i.status === 'PENDING_APPROVAL');
    const approved = all.filter(i => i.status === 'APPROVED');
    const needsRev = all.filter(i => i.status === 'NEEDS_REVISION');
    const executed = all.filter(i => i.status === 'EXECUTED' || i.status === 'EXECUTION_FAILED');
    const rejected = all.filter(i => i.status === 'REJECTED');

    // Update badge
    const badge = document.getElementById('badge-queue');
    badge.textContent = pending.length;
    badge.style.display = pending.length > 0 ? '' : 'none';

    let html = `
      <div class="page-header">
        <div>
          <h1>Approval Queue</h1>
          <div class="meta">${pending.length} pending · ${all.length} total</div>
        </div>
      </div>`;

    if (pending.length === 0 && all.length === 0) {
      html += `<div class="empty-state">
        <div class="empty-state__icon">◈</div>
        <p>No items in the queue yet.<br>Run the agent to generate content and outreach drafts.</p>
      </div>`;
    }

    if (pending.length > 0) {
      html += `<div class="section-label">Pending Review (${pending.length})</div>`;
      html += pending.map(item => queueCard(item)).join('');
    }

    if (needsRev.length > 0) {
      html += `<div class="section-label">Needs Revision (${needsRev.length})</div>`;
      html += needsRev.map(item => queueCard(item)).join('');
    }

    if (approved.length > 0) {
      html += `<div class="section-label">Approved — Pending Execution (${approved.length})</div>`;
      html += approved.map(item => queueCard(item, true)).join('');
    }

    if (executed.length > 0) {
      html += `<div class="section-label">Executed (${executed.length})</div>`;
      html += executed.map(item => queueCard(item, true)).join('');
    }

    if (rejected.length > 0) {
      html += `<div class="section-label">Rejected (${rejected.length})</div>`;
      html += rejected.map(item => queueCard(item, true)).join('');
    }

    el.innerHTML = html;
    attachQueueHandlers();
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Error loading queue: ${esc(err.message)}</p></div>`;
  }
}

function queueCard(item, readonly = false) {
  const statusClass = {
    APPROVED: 'card--approved',
    REJECTED: 'card--rejected',
    NEEDS_REVISION: 'card--revision',
    EXECUTED: 'card--executed',
    EXECUTION_FAILED: 'card--rejected',
  }[item.status] || '';

  const actions = readonly ? '' : `
    <button class="btn btn-expand btn-sm" data-id="${item.id}" data-action="expand">Expand</button>
    <button class="btn btn-approve btn-sm" data-id="${item.id}" data-action="approve">✓ Approve</button>
    <button class="btn btn-reject  btn-sm" data-id="${item.id}" data-action="reject">✕ Reject</button>
    <button class="btn btn-revise  btn-sm" data-id="${item.id}" data-action="revise">↺ Revise</button>
  `;

  const expandBtn = readonly ? `<button class="btn btn-expand btn-sm" data-id="${item.id}" data-action="expand">Expand</button>` : '';

  const revisionNote = item.revisionNote ? `
    <div class="revision-note"><strong>Revision note:</strong>${esc(item.revisionNote)}</div>` : '';

  return `
    <div class="card ${statusClass}" id="card-${item.id}">
      <div class="q-item__header">
        <span class="type-badge type-${item.type}">${item.type.replace(/_/g, ' ')}</span>
        <span class="q-item__title">${esc(item.title)}</span>
        <span class="q-item__date">${fmtDateTime(item.createdAt)}</span>
        ${readonly ? expandBtn : ''}
      </div>
      <div class="q-item__preview" id="preview-${item.id}">${esc(preview(item.body))}</div>
      ${revisionNote}
      <div class="q-item__actions">${actions}</div>
      <div class="revise-form" id="revise-form-${item.id}">
        <textarea placeholder="What needs to change?"></textarea>
        <div style="display:flex;gap:8px">
          <button class="btn btn-revise btn-sm" data-id="${item.id}" data-action="revise-submit">Save Note</button>
          <button class="btn btn-ghost btn-sm" data-id="${item.id}" data-action="revise-cancel">Cancel</button>
        </div>
      </div>
    </div>`;
}

function attachQueueHandlers() {
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleQueueAction);
  });
}

async function handleQueueAction(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'expand') {
    const preview = document.getElementById(`preview-${id}`);
    const item = S.queue.find(i => i.id === id);
    if (!item) return;
    if (preview.classList.contains('expanded')) {
      preview.classList.remove('expanded');
      preview.textContent = item.body.slice(0, 160) + (item.body.length > 160 ? '…' : '');
      btn.textContent = 'Expand';
    } else {
      preview.classList.add('expanded');
      preview.textContent = item.body;
      btn.textContent = 'Collapse';
    }
    return;
  }

  if (action === 'approve') {
    btn.disabled = true;
    try {
      await api('POST', `/api/queue/${id}/approve`);
      toast('Item approved — executor will pick it up.', 'success');
      renderQueue();
    } catch (err) {
      toast(`Error: ${err.message}`, 'error');
      btn.disabled = false;
    }
    return;
  }

  if (action === 'reject') {
    btn.disabled = true;
    try {
      await api('POST', `/api/queue/${id}/reject`);
      toast('Item rejected.', 'info');
      renderQueue();
    } catch (err) {
      toast(`Error: ${err.message}`, 'error');
      btn.disabled = false;
    }
    return;
  }

  if (action === 'revise') {
    const form = document.getElementById(`revise-form-${id}`);
    form.classList.toggle('open');
    return;
  }

  if (action === 'revise-submit') {
    const form = document.getElementById(`revise-form-${id}`);
    const note = form.querySelector('textarea').value.trim();
    if (!note) { toast('Add a note before saving.', 'error'); return; }
    btn.disabled = true;
    try {
      await api('POST', `/api/queue/${id}/revise`, { note });
      toast('Revision note saved.', 'info');
      renderQueue();
    } catch (err) {
      toast(`Error: ${err.message}`, 'error');
      btn.disabled = false;
    }
    return;
  }

  if (action === 'revise-cancel') {
    document.getElementById(`revise-form-${id}`).classList.remove('open');
    return;
  }
}

// ── Content Queue ─────────────────────────────────────────────────

async function renderContent() {
  const el = document.getElementById('view-content');
  el.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const [allItems, calendar] = await Promise.all([
      api('GET', '/api/queue/all'),
      api('GET', '/api/state/content-calendar'),
    ]);

    const content = allItems.filter(i =>
      ['LINKEDIN_POST', 'BLOG_POST', 'EMAIL_OUTREACH'].includes(i.type)
    );

    const byStatus = {
      PENDING_APPROVAL: content.filter(i => i.status === 'PENDING_APPROVAL'),
      APPROVED:         content.filter(i => i.status === 'APPROVED'),
      NEEDS_REVISION:   content.filter(i => i.status === 'NEEDS_REVISION'),
      EXECUTED:         content.filter(i => ['EXECUTED','EXECUTION_FAILED'].includes(i.status)),
    };

    let html = `
      <div class="page-header"><div><h1>Content Queue</h1><div class="meta">${content.length} total items</div></div></div>
      <div class="content-lanes">`;

    const laneLabels = { PENDING_APPROVAL: 'Draft', APPROVED: 'Approved', NEEDS_REVISION: 'Needs Revision', EXECUTED: 'Published' };

    for (const [status, items] of Object.entries(byStatus)) {
      html += `<div>
        <div class="content-lane__header">${laneLabels[status]} (${items.length})</div>`;
      if (items.length === 0) {
        html += `<div style="font-size:.75rem;color:var(--text-muted);padding:8px 0">Empty</div>`;
      }
      items.forEach(item => {
        html += `<div class="content-card">
          <div class="content-card__type">${item.type.replace(/_/g,' ')}</div>
          <div class="content-card__title">${esc(item.title)}</div>
          <div class="content-card__date">${fmtDate(item.createdAt)}</div>
        </div>`;
      });
      html += '</div>';
    }

    html += `</div>`;

    // Calendar planned items
    const planned = (calendar.entries || []).filter(e => e.status === 'planned');
    if (planned.length > 0) {
      html += `<div class="section-label" style="margin-top:28px">Content Calendar — Planned</div>`;
      planned.forEach(e => {
        html += `<div class="card">
          <div class="q-item__header">
            <span class="type-badge type-${e.type.replace(/ /g,'_')}">${e.type.replace(/_/g,' ')}</span>
            <span class="q-item__title">${esc(e.title)}</span>
            <span class="q-item__date">${fmtDate(e.date)}</span>
          </div>
          ${e.angle ? `<div class="q-item__preview">${esc(e.angle)}</div>` : ''}
        </div>`;
      });
    }

    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Error: ${esc(err.message)}</p></div>`;
  }
}

// ── BD Pipeline ───────────────────────────────────────────────────

const BD_STAGES = ['Identified', 'Outreach Drafted', 'Pending Approval', 'Sent', 'Responded', 'Qualified', 'Closed'];

async function renderBD() {
  const el = document.getElementById('view-bd');
  el.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const data = await api('GET', '/api/state/prospects');
    const prospects = data.prospects || [];

    const byStage = {};
    BD_STAGES.forEach(s => { byStage[s] = []; });
    prospects.forEach(p => {
      const stage = p.status || 'Identified';
      if (!byStage[stage]) byStage[stage] = [];
      byStage[stage].push(p);
    });

    let html = `<div class="page-header"><div><h1>BD Pipeline</h1><div class="meta">${prospects.length} prospects tracked</div></div></div>`;

    if (prospects.length === 0) {
      html += `<div class="empty-state"><div class="empty-state__icon">⬡</div><p>No prospects yet.<br>The daily agent run will identify and add companies.</p></div>`;
      el.innerHTML = html;
      return;
    }

    html += `<div class="kanban">`;
    BD_STAGES.forEach(stage => {
      const cards = byStage[stage] || [];
      html += `<div class="kanban-col">
        <div class="kanban-col__header">
          <span>${stage}</span>
          <span class="kanban-col__count">${cards.length}</span>
        </div>
        <div class="kanban-col__cards">`;
      cards.forEach(p => {
        const score = p.fitScore || 0;
        const scoreClass = score >= 8 ? 'score-high' : score >= 5 ? 'score-med' : 'score-low';
        html += `<div class="prospect-card" title="${esc(p.signals?.join(', ') || '')}">
          <div class="prospect-card__company">${esc(p.company)}</div>
          <div class="prospect-card__industry">${esc(p.industry)} · ${esc(p.location || '')}</div>
          <span class="prospect-card__score ${scoreClass}">Fit: ${score}/10</span>
        </div>`;
      });
      html += `</div></div>`;
    });
    html += '</div>';

    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Error: ${esc(err.message)}</p></div>`;
  }
}

// ── Intel ─────────────────────────────────────────────────────────

async function renderIntel() {
  const el = document.getElementById('view-intel');
  el.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const [briefs, queueItems, competitors] = await Promise.all([
      api('GET', '/api/state/intel-briefs'),
      api('GET', '/api/queue/all'),
      api('GET', '/api/state/competitors'),
    ]);

    const intelQueue = queueItems.filter(i => i.type === 'INTEL_BRIEF' && i.status === 'PENDING_APPROVAL');
    const comps = competitors.competitors || [];

    let html = `<div class="page-header"><div><h1>Competitive Intel</h1><div class="meta">${briefs.length} briefs · ${comps.length} tracked competitors</div></div></div>`;

    if (intelQueue.length > 0) {
      html += `<div class="section-label">Pending Review (${intelQueue.length})</div>`;
      html += intelQueue.map(i => queueCard(i)).join('');
      setTimeout(attachQueueHandlers, 0);
    }

    if (briefs.length > 0) {
      html += `<div class="section-label">Published Briefs (${briefs.length})</div>`;
      briefs.forEach(b => {
        html += `<div class="intel-brief">
          <div class="intel-brief__header" onclick="toggleBrief('${esc(b.filename)}')">
            <span class="intel-brief__title">${esc(b.filename.replace(/_/g,' ').replace('.md',''))}</span>
            <span class="intel-brief__date">${esc(b.date)}</span>
          </div>
          <div class="intel-brief__body" id="brief-${esc(b.filename)}">${esc(b.content)}</div>
        </div>`;
      });
    }

    if (comps.length > 0) {
      html += `<div class="section-label">Tracked Competitors (${comps.length})</div>`;
      comps.forEach(c => {
        html += `<div class="card">
          <div class="q-item__header">
            <span class="q-item__title">${esc(c.name)}</span>
            <span class="q-item__date">${esc(c.segment || '')}</span>
          </div>
          ${c.notes ? `<div class="q-item__preview">${esc(c.notes)}</div>` : ''}
        </div>`;
      });
    }

    if (briefs.length === 0 && comps.length === 0 && intelQueue.length === 0) {
      html += `<div class="empty-state"><div class="empty-state__icon">◎</div><p>No intel yet.<br>The weekly agent run generates competitive intelligence briefs.</p></div>`;
    }

    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Error: ${esc(err.message)}</p></div>`;
  }
}

function toggleBrief(filename) {
  const body = document.getElementById(`brief-${filename}`);
  if (body) body.classList.toggle('open');
}

// ── Agent Dialog / Chat ───────────────────────────────────────────

async function renderChat() {
  const el = document.getElementById('view-chat');

  // Load history for current session if not cached
  if (!S.dialog.cache[S.dialog.sessionId]) {
    try {
      const data = await api('GET', `/api/dialog/history?sessionId=${encodeURIComponent(S.dialog.sessionId)}`);
      S.dialog.history = data.history || [];
      S.dialog.cache[S.dialog.sessionId] = S.dialog.history;
    } catch { S.dialog.history = []; }
  } else {
    S.dialog.history = S.dialog.cache[S.dialog.sessionId];
  }

  // Fetch prospects for session selector
  let prospects = [];
  try {
    const data = await api('GET', '/api/state/prospects');
    prospects = (data.prospects || []).sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
  } catch { /* skip */ }

  const sessionOpts = buildSessionOptions(prospects);
  const sessionLabel = getSessionLabel(prospects);

  el.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-topbar">
        <div>
          <h1 class="chat-session-title">${esc(sessionLabel)}</h1>
          <div class="meta">${S.dialog.sessionId === 'general' ? 'General conversation with your agent' : 'Prospect session — full context loaded'}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <select class="chat-context-select" id="chat-session-select" onchange="switchDialogSession(this.value)">
            ${sessionOpts}
          </select>
          <button class="btn btn-ghost btn-sm" onclick="clearDialogHistory()">Clear</button>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages">
        ${buildChatMessagesHTML()}
      </div>
      <div class="chat-inputbar">
        <textarea id="chat-input" placeholder="Ask about this lead, review outreach copy, or discuss strategy… (Enter to send, Shift+Enter for newline)" rows="1"></textarea>
        <button class="btn btn-primary chat-send-btn" id="chat-send" onclick="sendDialogMessage()">Send</button>
      </div>
    </div>`;

  scrollChatToBottom();

  const input = document.getElementById('chat-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDialogMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  });
  input.focus();
}

function buildSessionOptions(prospects) {
  const sid = S.dialog.sessionId;
  const stageOrder = ['Identified', 'Outreach Drafted', 'Pending Approval', 'Sent', 'Responded', 'Qualified'];

  let opts = `<option value="general"${sid === 'general' ? ' selected' : ''}>General conversation</option>`;

  if (prospects.length > 0) {
    opts += `<option disabled>── Prospects ──</option>`;
    prospects.forEach(p => {
      const val = `prospect:${p.id}`;
      const label = `${p.company} · ${p.status} · ${p.fitScore}/10`;
      opts += `<option value="${esc(val)}"${sid === val ? ' selected' : ''}>${esc(label)}</option>`;
    });
  }

  return opts;
}

function getSessionLabel(prospects) {
  if (S.dialog.sessionId === 'general') return 'Agent Dialog';
  if (S.dialog.sessionId.startsWith('prospect:')) {
    const id = S.dialog.sessionId.replace('prospect:', '');
    const p = prospects.find(p => p.id === id);
    return p ? p.company : 'Prospect';
  }
  return 'Agent Dialog';
}

function buildChatMessagesHTML() {
  if (S.dialog.history.length === 0) {
    const hint = S.dialog.sessionId.startsWith('prospect:')
      ? 'This prospect\'s full record is loaded as context.<br>Ask about their signals, review outreach copy, or plan next steps.'
      : 'Ask about pending items, request revisions, or think through strategy.';
    return `<div class="empty-state" style="padding:48px 20px">
      <div class="empty-state__icon" style="font-size:1.4rem">◌</div>
      <p>${hint}</p>
    </div>`;
  }
  return S.dialog.history.map(msg => {
    const isUser = msg.role === 'user';
    return `<div class="chat-msg ${isUser ? 'chat-msg--user' : 'chat-msg--agent'}">
      ${!isUser ? '<div class="chat-msg__avatar">FS</div>' : ''}
      <div class="chat-msg__bubble">${esc(msg.content)}</div>
    </div>`;
  }).join('');
}

async function switchDialogSession(sessionId) {
  if (sessionId === S.dialog.sessionId) return;

  // Cache current session
  S.dialog.cache[S.dialog.sessionId] = S.dialog.history;
  S.dialog.sessionId = sessionId;

  // Load new session (from cache or server)
  if (S.dialog.cache[sessionId]) {
    S.dialog.history = S.dialog.cache[sessionId];
  } else {
    try {
      const data = await api('GET', `/api/dialog/history?sessionId=${encodeURIComponent(sessionId)}`);
      S.dialog.history = data.history || [];
      S.dialog.cache[sessionId] = S.dialog.history;
    } catch { S.dialog.history = []; }
  }

  // Update messages area and header without full re-render
  const container = document.getElementById('chat-messages');
  if (container) container.innerHTML = buildChatMessagesHTML();
  scrollChatToBottom();

  const title = document.querySelector('.chat-session-title');
  // Fetch prospects for label update
  try {
    const data = await api('GET', '/api/state/prospects');
    const prospects = data.prospects || [];
    if (title) title.textContent = getSessionLabel(prospects);
    const meta = document.querySelector('.chat-topbar .meta');
    if (meta) meta.textContent = sessionId === 'general'
      ? 'General conversation with your agent'
      : 'Prospect session — full context loaded';
  } catch { /* skip */ }

  document.getElementById('chat-input')?.focus();
}

function scrollChatToBottom() {
  const el = document.getElementById('chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

async function sendDialogMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const message = input.value.trim();
  if (!message || S.dialog.loading) return;

  input.value = '';
  input.style.height = 'auto';
  S.dialog.loading = true;

  const container = document.getElementById('chat-messages');
  container?.querySelector('.empty-state')?.remove();

  if (container) {
    container.insertAdjacentHTML('beforeend', `
      <div class="chat-msg chat-msg--user">
        <div class="chat-msg__bubble">${esc(message)}</div>
      </div>
      <div class="chat-msg chat-msg--agent chat-msg--typing" id="chat-typing">
        <div class="chat-msg__avatar">FS</div>
        <div class="chat-msg__bubble">Thinking…</div>
      </div>`);
    scrollChatToBottom();
  }

  const sendBtn = document.getElementById('chat-send');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const data = await api('POST', '/api/dialog', {
      message,
      history: S.dialog.history,
      sessionId: S.dialog.sessionId,
    });

    S.dialog.history = data.history;
    S.dialog.cache[S.dialog.sessionId] = data.history;
    S.dialog.loading = false;

    const typing = document.getElementById('chat-typing');
    if (typing) {
      typing.classList.remove('chat-msg--typing');
      typing.removeAttribute('id');
      typing.querySelector('.chat-msg__bubble').textContent = data.reply;
    }
    scrollChatToBottom();
  } catch (err) {
    S.dialog.loading = false;
    document.getElementById('chat-typing')?.remove();
    toast(`Dialog error: ${err.message}`, 'error');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    document.getElementById('chat-input')?.focus();
  }
}

async function clearDialogHistory() {
  try {
    await api('DELETE', `/api/dialog/history?sessionId=${encodeURIComponent(S.dialog.sessionId)}`);
    S.dialog.history = [];
    S.dialog.cache[S.dialog.sessionId] = [];
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = buildChatMessagesHTML();
    toast('Conversation cleared.', 'info');
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

// ── Run Log ───────────────────────────────────────────────────────

async function renderLog() {
  const el = document.getElementById('view-log');
  el.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const log = await api('GET', '/api/run-log');

    let html = `<div class="page-header"><div><h1>Run Log</h1><div class="meta">Last ${log.length} runs</div></div></div>`;

    if (log.length === 0) {
      html += `<div class="empty-state"><div class="empty-state__icon">≡</div><p>No runs recorded yet.<br>Run the agent manually or wait for the scheduled trigger.</p></div>`;
      el.innerHTML = html;
      return;
    }

    html += '<div class="log-timeline">';
    log.forEach(entry => {
      const errors = entry.errors?.length > 0
        ? `<div style="color:var(--red);font-size:.75rem;margin-top:4px">⚠ ${esc(entry.errors.join(', '))}</div>` : '';
      html += `<div class="log-entry ${entry.status}">
        <div class="log-entry__meta">
          <span class="log-entry__time">${fmtDateTime(entry.timestamp)}</span>
          <span class="log-entry__module module-${entry.module}">${entry.module}</span>
          <span style="font-size:.72rem;padding:2px 7px;border-radius:4px;background:${
            entry.status==='success' ? 'var(--green-glow)' : entry.status==='error' ? 'var(--red-glow)' : 'var(--amber-glow)'
          };color:${
            entry.status==='success' ? 'var(--green)' : entry.status==='error' ? 'var(--red)' : 'var(--amber)'
          }">${entry.status}</span>
        </div>
        <div class="log-entry__summary">${esc(entry.summary || '—')}</div>
        <div class="log-entry__stats">
          <span>${entry.itemsProduced || 0} produced</span>
          <span>${entry.itemsQueued || 0} queued</span>
          ${entry.duration_seconds ? `<span>${entry.duration_seconds}s</span>` : ''}
        </div>
        ${errors}
      </div>`;
    });
    html += '</div>';

    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Error: ${esc(err.message)}</p></div>`;
  }
}

// ── Playbooks ─────────────────────────────────────────────────────

const playbookCache = {};
let activePlaybook = 'discovery-call';

async function renderPlaybooks() {
  const el = document.getElementById('view-playbooks');
  el.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const list = await api('GET', '/api/playbooks');

    const tabs = list.map(p => `
      <button class="playbook-tab ${p.id === activePlaybook ? 'active' : ''}"
              onclick="switchPlaybook('${esc(p.id)}')">${esc(p.title)}</button>
    `).join('');

    el.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Playbooks</h1>
          <div class="meta">Internal process guides — living documents, iterate freely</div>
        </div>
      </div>
      <div class="playbook-tabs">${tabs}</div>
      <div class="playbook-body" id="playbook-body">
        <div class="loading">Loading…</div>
      </div>`;

    await loadPlaybook(activePlaybook);
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Error: ${esc(err.message)}</p></div>`;
  }
}

async function loadPlaybook(id) {
  const body = document.getElementById('playbook-body');
  if (!body) return;

  if (playbookCache[id]) {
    body.innerHTML = `<div class="playbook-content">${playbookCache[id]}</div>`;
    return;
  }

  body.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const data = await api('GET', `/api/playbooks/${encodeURIComponent(id)}`);
    playbookCache[id] = data.html;
    body.innerHTML = `<div class="playbook-content">${data.html}</div>`;
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><p>Could not load playbook: ${esc(err.message)}</p></div>`;
  }
}

async function switchPlaybook(id) {
  activePlaybook = id;
  document.querySelectorAll('.playbook-tab').forEach(t => {
    t.classList.toggle('active', t.textContent.trim() === id ||
      t.getAttribute('onclick').includes(`'${id}'`));
  });
  await loadPlaybook(id);
}

// ── Settings ──────────────────────────────────────────────────────

function renderSettings() {
  const el = document.getElementById('view-settings');
  el.innerHTML = `
    <div class="page-header"><div><h1>Settings</h1></div></div>

    <div class="settings-group">
      <h3>Manual Agent Triggers</h3>
      <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:14px">
        Trigger an agent run immediately. Outputs appear in the queue within a few minutes.
      </p>
      <div class="run-grid">
        <button class="btn btn-primary btn-sm" onclick="triggerRun('daily')">▶ Daily</button>
        <button class="btn btn-ghost  btn-sm" onclick="triggerRun('weekly')">▶ Weekly</button>
        <button class="btn btn-ghost  btn-sm" onclick="triggerRun('monthly')">▶ Monthly</button>
        <button class="btn btn-ghost  btn-sm" onclick="triggerRun('all')">▶ All</button>
      </div>
    </div>

    <div class="settings-group">
      <h3>State Files</h3>
      <div class="settings-row"><label>Queue (content)</label><span class="value">agent-state/content-queue.json</span></div>
      <div class="settings-row"><label>Queue (outreach)</label><span class="value">agent-state/outreach-queue.json</span></div>
      <div class="settings-row"><label>Queue (website)</label><span class="value">agent-state/website-queue.json</span></div>
      <div class="settings-row"><label>Queue (intel)</label><span class="value">agent-state/intel-queue.json</span></div>
      <div class="settings-row"><label>Run log</label><span class="value">agent-state/run-log.json</span></div>
      <div class="settings-row"><label>Intel briefs</label><span class="value">agent-state/intel-briefs/</span></div>
    </div>

    <div class="settings-group">
      <h3>Schedule (launchd)</h3>
      <div class="settings-row"><label>Daily</label><span class="value">Weekdays 7:00 AM</span></div>
      <div class="settings-row"><label>Weekly</label><span class="value">Mondays 7:30 AM</span></div>
      <div class="settings-row"><label>Monthly</label><span class="value">1st of month 8:00 AM</span></div>
    </div>

    <div class="settings-group">
      <h3>Dashboard</h3>
      <div class="settings-row"><label>Port</label><span class="value">${window.location.port || 3333}</span></div>
      <div class="settings-row"><label>Host</label><span class="value">localhost only (not exposed externally)</span></div>
    </div>`;
}

// ── Trigger run ───────────────────────────────────────────────────

async function triggerRun(module) {
  const btn = document.getElementById('run-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Running…'; }
  try {
    await api('POST', `/api/run/${module}`);
    toast(`Agent started — module: ${module}`, 'success');
  } catch (err) {
    toast(`Failed to start agent: ${err.message}`, 'error');
  } finally {
    if (btn) {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '▶ Run Daily Now';
      }, 3000);
    }
  }
}

// ── SSE live updates ──────────────────────────────────────────────

function initSSE() {
  const dot = document.getElementById('live-indicator');
  const es = new EventSource('/api/events');

  es.onopen = () => dot.classList.add('connected');
  es.onerror = () => dot.classList.remove('connected');

  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'stateChange') {
        // Refresh current view if the changed file is relevant
        const relevantViews = {
          'content-queue.json':  ['queue', 'content'],
          'outreach-queue.json': ['queue'],
          'website-queue.json':  ['queue'],
          'intel-queue.json':    ['queue', 'intel'],
          'run-log.json':        ['log'],
          'prospects.json':      ['bd'],
          'content-calendar.json': ['content'],
        };
        const views = relevantViews[msg.file] || [];
        if (views.includes(S.view)) {
          renderView(S.view);
        }
        // Always refresh badge
        refreshBadge();
      }
    } catch { /* ignore parse errors */ }
  };
}

async function refreshBadge() {
  try {
    const pending = await api('GET', '/api/queue');
    const badge = document.getElementById('badge-queue');
    badge.textContent = pending.length;
    badge.style.display = pending.length > 0 ? '' : 'none';
  } catch { /* silent */ }
}

// ── Init ──────────────────────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.view));
});

(async function init() {
  initSSE();
  await renderView(S.view);
  await refreshBadge();
})();
