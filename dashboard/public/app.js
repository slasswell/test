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
    case 'finance':   renderFinance(); break;
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

// ── Finance Models ────────────────────────────────────────────────

const CLAUDE_MODELS = {
  opus:   { label: 'Opus 4.7',   inputPer1M: 15.00, outputPer1M: 75.00 },
  sonnet: { label: 'Sonnet 4.6', inputPer1M:  3.00, outputPer1M: 15.00 },
  haiku:  { label: 'Haiku 4.5',  inputPer1M:  0.80, outputPer1M:  4.00 },
};

const FIN_DEFAULTS = {
  roi: {
    workflowHours: 40, teamSize: 2, avgHourlyRate: 55,
    forgeInvestment: 12000, automationPct: 65,
    apiModel: 'sonnet', monthlyInputMtok: 1.5, monthlyOutputMtok: 0.4,
  },
  biz: {
    t1PerYear: 2, t1Avg: 3500,
    t2PerYear: 3, t2Avg: 8000,
    t3PerYear: 0, t3Avg: 20000,
    retainerCount: 1, retainerAvg: 2500,
    closeRate: 25,
    opsCostAPI: 200, opsCostSoftware: 400, opsCostInsurance: 200,
    opsCostMarketing: 300, opsCostProfessional: 250, opsCostOther: 100,
  },
};

let finState = null;
let finTab = 'roi';
let _finSaveTimer = null;

function finLoad() {
  if (finState) return;
  try {
    const saved = JSON.parse(localStorage.getItem('forge_finance') || '{}');
    finState = {
      roi: { ...FIN_DEFAULTS.roi, ...(saved.roi || {}) },
      biz: { ...FIN_DEFAULTS.biz, ...(saved.biz || {}) },
    };
  } catch {
    finState = JSON.parse(JSON.stringify(FIN_DEFAULTS));
  }
}

function finSave() {
  clearTimeout(_finSaveTimer);
  _finSaveTimer = setTimeout(() => {
    try { localStorage.setItem('forge_finance', JSON.stringify(finState)); } catch { /* quota */ }
  }, 300);
}

function renderFinance() {
  finLoad();
  const el = document.getElementById('view-finance');
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Financial Models</h1><div class="meta">Client ROI analysis &amp; internal business planning</div></div>
      <button class="btn btn-ghost btn-sm" onclick="finReset()">Reset defaults</button>
    </div>
    <div class="fin-tabs">
      <button class="fin-tab ${finTab === 'roi' ? 'active' : ''}" onclick="switchFinTab('roi')">Client ROI Analysis</button>
      <button class="fin-tab ${finTab === 'biz' ? 'active' : ''}" onclick="switchFinTab('biz')">Business Model</button>
    </div>
    <div id="fin-roi-view" style="${finTab !== 'roi' ? 'display:none' : ''}">${buildROIView()}</div>
    <div id="fin-biz-view" style="${finTab !== 'biz' ? 'display:none' : ''}">${buildBizView()}</div>`;
  recalcROI();
  recalcBiz();
}

function switchFinTab(tab) {
  finTab = tab;
  document.querySelectorAll('.fin-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'roi') || (i === 1 && tab === 'biz'));
  });
  document.getElementById('fin-roi-view').style.display = tab === 'roi' ? '' : 'none';
  document.getElementById('fin-biz-view').style.display = tab === 'biz' ? '' : 'none';
}

function finReset() {
  finState = JSON.parse(JSON.stringify(FIN_DEFAULTS));
  finSave();
  renderFinance();
  toast('Reset to defaults.', 'info');
}

function finSet(section, key, rawVal) {
  const num = parseFloat(rawVal);
  finState[section][key] = isNaN(num) ? rawVal : num;
  finSave();
  if (section === 'roi') recalcROI();
  else recalcBiz();
}

function setFV(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (cls !== undefined) el.className = cls;
}

function fmtC(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}
function fmtPct(n) { return !isFinite(n) ? 'N/A' : (n >= 0 ? '+' : '') + n.toFixed(0) + '%'; }
function fmtMo(n)  { return (!isFinite(n) || n < 0) ? 'Never' : n.toFixed(1) + ' mo'; }

function fI(label, section, key, val, attrs = {}) {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<div class="fin-field">
    <label>${label}</label>
    <input type="number" value="${val}" ${a} oninput="finSet('${section}','${key}',this.value)">
  </div>`;
}

// ── ROI View ─────────────────────────────────────────────────────

function buildROIView() {
  const r = finState.roi;
  const modelOpts = Object.entries(CLAUDE_MODELS).map(([k, m]) =>
    `<option value="${k}" ${r.apiModel === k ? 'selected' : ''}>${m.label} — $${m.inputPer1M}/$${m.outputPer1M}/MTok</option>`
  ).join('');

  return `<div class="fin-grid">
    <div class="fin-inputs-col">
      <div class="fin-panel">
        <div class="fin-panel__title">Current Workflow Cost</div>
        ${fI('Hours/week on this process', 'roi', 'workflowHours', r.workflowHours, {min:1,max:160,step:1})}
        ${fI('People involved', 'roi', 'teamSize', r.teamSize, {min:1,max:50,step:1})}
        ${fI('Fully-loaded hourly cost ($)', 'roi', 'avgHourlyRate', r.avgHourlyRate, {min:10,max:500,step:5})}
      </div>
      <div class="fin-panel">
        <div class="fin-panel__title">Forge Engagement</div>
        ${fI('Engagement investment ($)', 'roi', 'forgeInvestment', r.forgeInvestment, {min:0,step:500})}
        ${fI('Automation coverage (%)', 'roi', 'automationPct', r.automationPct, {min:10,max:100,step:5})}
      </div>
      <div class="fin-panel">
        <div class="fin-panel__title">Claude API Usage</div>
        <div class="fin-field">
          <label>Model</label>
          <select onchange="finSet('roi','apiModel',this.value)">${modelOpts}</select>
        </div>
        ${fI('Input tokens/month (MTok)', 'roi', 'monthlyInputMtok', r.monthlyInputMtok, {min:0,step:0.1})}
        ${fI('Output tokens/month (MTok)', 'roi', 'monthlyOutputMtok', r.monthlyOutputMtok, {min:0,step:0.1})}
      </div>
    </div>
    <div class="fin-results-col">
      <div class="fin-metric-row">
        <div class="fin-metric"><div class="fin-metric__label">Monthly savings</div><div class="fin-metric__value" id="roi-m-savings">—</div></div>
        <div class="fin-metric"><div class="fin-metric__label">Monthly API cost</div><div class="fin-metric__value fin-v-cost" id="roi-m-api">—</div></div>
        <div class="fin-metric"><div class="fin-metric__label">Net monthly benefit</div><div class="fin-metric__value" id="roi-m-net">—</div></div>
        <div class="fin-metric"><div class="fin-metric__label">Break-even</div><div class="fin-metric__value" id="roi-breakeven">—</div></div>
      </div>
      <div class="fin-table-wrap">
        <div class="fin-section-title">ROI by Time Horizon</div>
        <table class="fin-table">
          <thead><tr><th>Horizon</th><th>Gross Savings</th><th>Total Cost</th><th>Net Value</th><th>ROI</th></tr></thead>
          <tbody id="roi-horizon-body"></tbody>
        </table>
      </div>
      <div class="fin-table-wrap">
        <div class="fin-section-title">12-Month Alternative Comparison</div>
        <table class="fin-table">
          <thead><tr><th>Option</th><th>Upfront</th><th>Monthly Ongoing</th><th>12-mo Savings</th><th>12-mo Net</th></tr></thead>
          <tbody id="roi-alt-body"></tbody>
        </table>
      </div>
      <div class="fin-table-wrap">
        <div class="fin-section-title">API Cost Detail</div>
        <table class="fin-table">
          <thead><tr><th>Component</th><th>Rate</th><th>Monthly Volume</th><th>Monthly Cost</th></tr></thead>
          <tbody id="roi-api-body"></tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function recalcROI() {
  const r = finState.roi;
  const model = CLAUDE_MODELS[r.apiModel] || CLAUDE_MODELS.sonnet;

  const monthlyHours = r.workflowHours * r.teamSize * 52 / 12;
  const monthlySavings = monthlyHours * r.avgHourlyRate * (r.automationPct / 100);
  const monthlyAPICost = (r.monthlyInputMtok * model.inputPer1M) + (r.monthlyOutputMtok * model.outputPer1M);
  const monthlyNet = monthlySavings - monthlyAPICost;
  const breakEvenMonths = monthlyNet > 0 ? r.forgeInvestment / monthlyNet : Infinity;

  function netAtMonth(m) {
    const savings = monthlySavings * m;
    const cost = r.forgeInvestment + monthlyAPICost * m;
    return { savings, cost, net: savings - cost, roi: (savings - cost) / Math.max(cost, 1) * 100 };
  }

  setFV('roi-m-savings', fmtC(monthlySavings));
  setFV('roi-m-api', fmtC(monthlyAPICost));
  setFV('roi-m-net', fmtC(monthlyNet), `fin-metric__value ${monthlyNet >= 0 ? 'fin-v-pos' : 'fin-v-neg'}`);
  setFV('roi-breakeven', fmtMo(breakEvenMonths),
    `fin-metric__value ${breakEvenMonths <= 12 ? 'fin-v-pos' : breakEvenMonths <= 24 ? 'fin-v-amber' : 'fin-v-neg'}`);

  const hBody = document.getElementById('roi-horizon-body');
  if (hBody) {
    hBody.innerHTML = [6, 12, 24, 36].map(m => {
      const { savings, cost, net, roi } = netAtMonth(m);
      return `<tr>
        <td>${m} months</td><td>${fmtC(savings)}</td><td>${fmtC(cost)}</td>
        <td class="${net >= 0 ? 'fin-pos' : 'fin-neg'}">${fmtC(net)}</td>
        <td class="${roi >= 0 ? 'fin-pos' : 'fin-neg'}">${fmtPct(roi)}</td>
      </tr>`;
    }).join('');
  }

  const monthlyLaborFull = monthlyHours * r.avgHourlyRate;
  const contractorMo = r.workflowHours * r.teamSize * 52 / 12 * 90;
  const alts = [
    { name: 'Forge Solutions',     upfront: r.forgeInvestment, monthly: monthlyAPICost,
      savings12: monthlySavings * 12, net12: netAtMonth(12).net, highlight: true },
    { name: 'Do Nothing',          upfront: 0, monthly: 0,
      savings12: 0, net12: -(monthlyLaborFull * 12), highlight: false },
    { name: 'New Hire (est.)',      upfront: 8000, monthly: 6500,
      savings12: monthlySavings * 12 * 0.55, net12: monthlySavings * 12 * 0.55 - 8000 - 6500 * 12, highlight: false },
    { name: 'Contractor ($90/hr)',  upfront: 0, monthly: contractorMo,
      savings12: monthlySavings * 12 * 0.4, net12: monthlySavings * 12 * 0.4 - contractorMo * 12, highlight: false },
  ];

  const altBody = document.getElementById('roi-alt-body');
  if (altBody) {
    altBody.innerHTML = alts.map(a => `<tr${a.highlight ? ' class="fin-highlight-row"' : ''}>
      <td style="font-weight:600">${esc(a.name)}</td>
      <td>${fmtC(a.upfront)}</td><td>${fmtC(a.monthly)}</td><td>${fmtC(a.savings12)}</td>
      <td class="${a.net12 >= 0 ? 'fin-pos' : 'fin-neg'}">${fmtC(a.net12)}</td>
    </tr>`).join('');
  }

  const apiBody = document.getElementById('roi-api-body');
  if (apiBody) {
    const inCost  = r.monthlyInputMtok  * model.inputPer1M;
    const outCost = r.monthlyOutputMtok * model.outputPer1M;
    apiBody.innerHTML = `
      <tr><td>Input tokens</td><td>$${model.inputPer1M}/MTok</td><td>${r.monthlyInputMtok} MTok</td><td>${fmtC(inCost)}</td></tr>
      <tr><td>Output tokens</td><td>$${model.outputPer1M}/MTok</td><td>${r.monthlyOutputMtok} MTok</td><td>${fmtC(outCost)}</td></tr>
      <tr class="fin-total-row"><td>Total</td><td colspan="2"></td><td>${fmtC(monthlyAPICost)}</td></tr>`;
  }
}

// ── Business Model View ───────────────────────────────────────────

function buildBizView() {
  const b = finState.biz;
  return `<div class="fin-grid">
    <div class="fin-inputs-col">
      <div class="fin-panel">
        <div class="fin-panel__title">Revenue — Engagements / Year</div>
        ${fI('Tier 1 engagements', 'biz', 't1PerYear', b.t1PerYear, {min:0,step:1})}
        ${fI('Tier 1 avg fee ($)', 'biz', 't1Avg', b.t1Avg, {min:0,step:500})}
        ${fI('Tier 2 engagements', 'biz', 't2PerYear', b.t2PerYear, {min:0,step:1})}
        ${fI('Tier 2 avg fee ($)', 'biz', 't2Avg', b.t2Avg, {min:0,step:500})}
        ${fI('Tier 3 engagements', 'biz', 't3PerYear', b.t3PerYear, {min:0,step:0.5})}
        ${fI('Tier 3 avg fee ($)', 'biz', 't3Avg', b.t3Avg, {min:0,step:1000})}
      </div>
      <div class="fin-panel">
        <div class="fin-panel__title">Revenue — Retainers</div>
        ${fI('Active retainer clients', 'biz', 'retainerCount', b.retainerCount, {min:0,step:1})}
        ${fI('Avg monthly rate ($)', 'biz', 'retainerAvg', b.retainerAvg, {min:0,step:100})}
      </div>
      <div class="fin-panel">
        <div class="fin-panel__title">Operating Costs / Month</div>
        ${fI('Claude API usage ($)', 'biz', 'opsCostAPI', b.opsCostAPI, {min:0,step:25})}
        ${fI('Software subscriptions ($)', 'biz', 'opsCostSoftware', b.opsCostSoftware, {min:0,step:25})}
        ${fI('Insurance ($)', 'biz', 'opsCostInsurance', b.opsCostInsurance, {min:0,step:25})}
        ${fI('Marketing / lead gen ($)', 'biz', 'opsCostMarketing', b.opsCostMarketing, {min:0,step:25})}
        ${fI('Legal / professional ($)', 'biz', 'opsCostProfessional', b.opsCostProfessional, {min:0,step:25})}
        ${fI('Other ($)', 'biz', 'opsCostOther', b.opsCostOther, {min:0,step:25})}
      </div>
      <div class="fin-panel">
        <div class="fin-panel__title">Pipeline</div>
        ${fI('Discovery call close rate (%)', 'biz', 'closeRate', b.closeRate, {min:1,max:100,step:5})}
      </div>
    </div>
    <div class="fin-results-col">
      <div class="fin-metric-row">
        <div class="fin-metric"><div class="fin-metric__label">Annual revenue</div><div class="fin-metric__value fin-v-pos" id="biz-annual-rev">—</div></div>
        <div class="fin-metric"><div class="fin-metric__label">Annual opex</div><div class="fin-metric__value fin-v-cost" id="biz-annual-ops">—</div></div>
        <div class="fin-metric"><div class="fin-metric__label">Annual net income</div><div class="fin-metric__value" id="biz-annual-net">—</div></div>
        <div class="fin-metric"><div class="fin-metric__label">Calls needed / month</div><div class="fin-metric__value" id="biz-calls-needed">—</div></div>
      </div>
      <div class="fin-table-wrap">
        <div class="fin-section-title">12-Month P&amp;L Projection</div>
        <table class="fin-table fin-table--compact">
          <thead><tr><th>Mo</th><th>Revenue</th><th>Opex</th><th>Gross Profit</th><th>Cumulative</th></tr></thead>
          <tbody id="biz-proj-body"></tbody>
          <tfoot><tr>
            <td><strong>Total</strong></td>
            <td id="biz-proj-rev-total"></td>
            <td id="biz-proj-ops-total"></td>
            <td id="biz-proj-net-total"></td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
      <div class="fin-table-wrap">
        <div class="fin-section-title">Revenue Mix</div>
        <table class="fin-table">
          <thead><tr><th>Tier</th><th>Range</th><th>Units/yr</th><th>Avg Fee</th><th>Annual Rev</th><th>Share</th></tr></thead>
          <tbody id="biz-mix-body"></tbody>
        </table>
      </div>
      <div class="fin-table-wrap">
        <div class="fin-section-title">Operating Cost Breakdown</div>
        <table class="fin-table">
          <thead><tr><th>Category</th><th>Monthly</th><th>Annual</th></tr></thead>
          <tbody id="biz-ops-body"></tbody>
          <tfoot><tr>
            <td><strong>Total</strong></td>
            <td id="biz-ops-mo-total"></td>
            <td id="biz-ops-yr-total"></td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  </div>`;
}

function recalcBiz() {
  const b = finState.biz;

  const annualProjectFee = b.t1PerYear * b.t1Avg + b.t2PerYear * b.t2Avg + b.t3PerYear * b.t3Avg;
  const annualRetainerRev = b.retainerCount * b.retainerAvg * 12;
  const annualRevenue = annualProjectFee + annualRetainerRev;

  const monthlyOps = b.opsCostAPI + b.opsCostSoftware + b.opsCostInsurance +
                     b.opsCostMarketing + b.opsCostProfessional + b.opsCostOther;
  const annualOps = monthlyOps * 12;
  const annualNet = annualRevenue - annualOps;

  const totalEngPerYear = b.t1PerYear + b.t2PerYear + b.t3PerYear;
  const callsPerMonth = totalEngPerYear / Math.max(b.closeRate / 100, 0.01) / 12;

  setFV('biz-annual-rev', fmtC(annualRevenue));
  setFV('biz-annual-ops', fmtC(annualOps));
  setFV('biz-annual-net', fmtC(annualNet), `fin-metric__value ${annualNet >= 0 ? 'fin-v-pos' : 'fin-v-neg'}`);
  setFV('biz-calls-needed', callsPerMonth.toFixed(1) + '/mo');

  const projBody = document.getElementById('biz-proj-body');
  if (projBody) {
    let cumul = 0, totalRev = 0, totalOps = 0, totalNet = 0;
    const rows = [];
    for (let mo = 1; mo <= 12; mo++) {
      const ramp = mo <= 2 ? 0.4 : 1.0;
      const rev  = (annualRevenue / 12) * ramp;
      const net  = rev - monthlyOps;
      const prevCumul = cumul;
      cumul += net;
      totalRev += rev; totalOps += monthlyOps; totalNet += net;
      const isBreakEven = cumul >= 0 && prevCumul < 0;
      rows.push(`<tr${isBreakEven ? ' class="fin-breakeven-row"' : ''}>
        <td>${mo}</td>
        <td>${fmtC(rev)}</td>
        <td class="fin-neg">(${fmtC(monthlyOps)})</td>
        <td class="${net >= 0 ? 'fin-pos' : 'fin-neg'}">${fmtC(net)}</td>
        <td class="${cumul >= 0 ? 'fin-pos' : 'fin-neg'}">${fmtC(cumul)}</td>
      </tr>`);
    }
    projBody.innerHTML = rows.join('');
    setFV('biz-proj-rev-total', fmtC(totalRev));
    setFV('biz-proj-ops-total', '(' + fmtC(totalOps) + ')');
    setFV('biz-proj-net-total', fmtC(totalNet));
  }

  const mixBody = document.getElementById('biz-mix-body');
  if (mixBody) {
    const tiers = [
      { name: 'Tier 1 — Assessment',      range: '$2,500–5K',    count: b.t1PerYear,      avg: b.t1Avg },
      { name: 'Tier 2 — Implementation',  range: '$5K–12K',      count: b.t2PerYear,      avg: b.t2Avg },
      { name: 'Tier 3 — Enterprise',       range: '$10K–40K+',    count: b.t3PerYear,      avg: b.t3Avg },
      { name: 'Retainers',                 range: '$1.5K–4K/mo',  count: b.retainerCount,  avg: b.retainerAvg * 12, unitLabel: b.retainerCount + ' clients' },
    ];
    const totalAnnual = tiers.reduce((s, t) => s + t.count * t.avg, 0);
    mixBody.innerHTML = tiers.map(t => {
      const rev = t.count * t.avg;
      const share = totalAnnual > 0 ? (rev / totalAnnual * 100).toFixed(0) : 0;
      return `<tr>
        <td style="font-weight:600">${esc(t.name)}</td>
        <td style="color:var(--text-muted);font-size:.75rem">${esc(t.range)}</td>
        <td>${t.unitLabel || t.count}</td>
        <td>${fmtC(t.avg)}</td>
        <td>${fmtC(rev)}</td>
        <td>${share}%</td>
      </tr>`;
    }).join('');
  }

  const opsBody = document.getElementById('biz-ops-body');
  if (opsBody) {
    const cats = [
      ['Claude API usage',       b.opsCostAPI],
      ['Software subscriptions', b.opsCostSoftware],
      ['Insurance',              b.opsCostInsurance],
      ['Marketing / lead gen',   b.opsCostMarketing],
      ['Legal / professional',   b.opsCostProfessional],
      ['Other',                  b.opsCostOther],
    ];
    opsBody.innerHTML = cats.map(([name, mo]) =>
      `<tr><td>${esc(name)}</td><td>${fmtC(mo)}</td><td>${fmtC(mo * 12)}</td></tr>`
    ).join('');
    setFV('biz-ops-mo-total', fmtC(monthlyOps));
    setFV('biz-ops-yr-total', fmtC(annualOps));
  }
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
