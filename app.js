/* ============================================================
   VoteHub — Student Voting PWA  |  app.js
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
const DB_KEY = 'votehub_db';

function defaultState() {
  return {
    elections: [
      {
        id: 'e1',
        title: 'Student Union President 2025',
        description: 'Choose the student representative who will lead the union for 2025–26.',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        candidates: [
          { id: 'c1', name: 'Arjun Mehta', manifesto: 'CS Dept — Innovation & Digital Infrastructure', color: '#5b6bff' },
          { id: 'c2', name: 'Priya Sharma', manifesto: 'ECE Dept — Inclusive Campus & Mental Health', color: '#22c55e' },
          { id: 'c3', name: 'Rohit Nair', manifesto: 'Mech Dept — Sports & Cultural Fest Revival', color: '#f0b429' },
        ],
        votes: {}
      },
      {
        id: 'e2',
        title: 'Cultural Secretary',
        description: 'Vote for the student who will organise fests, events, and cultural activities.',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        candidates: [
          { id: 'c4', name: 'Sneha Rao', manifesto: 'Arts Dept — Bigger Fests & Student Showcases', color: '#ec4899' },
          { id: 'c5', name: 'Vikram Singh', manifesto: 'MBA — Industry Connect & Cultural Exchange', color: '#8b5cf6' },
        ],
        votes: {}
      },
      {
        id: 'e3',
        title: 'Sports Captain',
        description: 'Elect the student to lead all sports teams and inter-college competitions.',
        deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'closed',
        candidates: [
          { id: 'c6', name: 'Akash Verma', manifesto: 'PE Dept — Fitness Infrastructure Upgrade', color: '#f97316' },
          { id: 'c7', name: 'Divya Pillai', manifesto: 'Science Dept — Women in Sports Initiative', color: '#06b6d4' },
        ],
        votes: { 'DEMO001': 'c6', 'DEMO002': 'c7', 'DEMO003': 'c6', 'DEMO004': 'c6', 'DEMO005': 'c7' }
      }
    ],
    pendingVotes: [],   // offline queue
    users: {}           // roll -> { name, dept, votedIn: [] }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw);
  } catch {
    return defaultState();
  }
}

function saveState(s) {
  localStorage.setItem(DB_KEY, JSON.stringify(s));
}

let state = loadState();
let currentUser = null;
let selectedCandidate = null;
let currentElectionId = null;
let deferredInstallPrompt = null;

// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('[VoteHub] SW registered:', reg.scope);
    }).catch(err => {
      console.warn('[VoteHub] SW registration failed:', err);
    });
  });
}

// ============================================================
// INSTALL PROMPT
// ============================================================
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('install-banner').classList.remove('hidden');
});

document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') hideBanner();
  deferredInstallPrompt = null;
});

document.getElementById('install-dismiss').addEventListener('click', hideBanner);
function hideBanner() {
  document.getElementById('install-banner').classList.add('hidden');
}

window.addEventListener('appinstalled', () => {
  hideBanner();
  showToast('online', '🎉 VoteHub installed! Find it on your home screen.');
});

// ============================================================
// ONLINE / OFFLINE
// ============================================================
window.addEventListener('online', () => {
  showToast('online', '✅ Back online — syncing pending votes…');
  syncPendingVotes();
  updateNetworkUI(true);
});

window.addEventListener('offline', () => {
  showToast('offline', '📡 You\'re offline — votes will sync when reconnected.');
  updateNetworkUI(false);
});

function updateNetworkUI(online) {
  const badge = document.getElementById('sync-badge');
  const dot = document.getElementById('mobile-status-dot');
  if (badge) {
    badge.textContent = online ? '● Live' : '○ Offline';
    badge.classList.toggle('offline-badge', !online);
  }
  if (dot) dot.classList.toggle('offline', !online);
}

updateNetworkUI(navigator.onLine);

function syncPendingVotes() {
  if (!state.pendingVotes.length) return;
  state.pendingVotes.forEach(v => applyVote(v.electionId, v.rollNumber, v.candidateId, false));
  state.pendingVotes = [];
  saveState(state);
  renderAll();
}

// ============================================================
// NAVIGATION
// ============================================================
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page;
    if (page === 'admin' && (!currentUser || currentUser.roll !== 'ADMIN001')) {
      showToast('offline', '🔒 Admin access requires roll ADMIN001');
      return;
    }
    navigateTo(page);
  });
});

function navigateTo(page) {
  // Require login
  if (page !== 'login' && !currentUser) { navigateTo('login'); return; }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');

  closeSidebar();

  if (page === 'elections') renderElections();
  if (page === 'results') renderResults();
  if (page === 'history') renderHistory();
  if (page === 'admin') renderAdmin();
}

// ============================================================
// SIDEBAR MOBILE
// ============================================================
const sidebar = document.getElementById('sidebar');
let overlay = null;

document.getElementById('hamburger').addEventListener('click', () => {
  sidebar.classList.add('open');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeSidebar);
  }
  overlay.classList.add('show');
});

function closeSidebar() {
  sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

// ============================================================
// LOGIN
// ============================================================
document.getElementById('login-btn').addEventListener('click', doLogin);
['login-roll', 'login-name', 'login-dept'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

function doLogin() {
  const roll = document.getElementById('login-roll').value.trim().toUpperCase();
  const name = document.getElementById('login-name').value.trim();
  const dept = document.getElementById('login-dept').value;

  if (!roll || !name || !dept) {
    shake(document.getElementById('login-btn'));
    return;
  }

  // Save user
  if (!state.users[roll]) state.users[roll] = { name, dept, votedIn: [] };
  else { state.users[roll].name = name; state.users[roll].dept = dept; }
  saveState(state);

  currentUser = { roll, name, dept };

  // Update UI
  document.getElementById('user-name-display').textContent = name;
  document.getElementById('user-roll').textContent = roll;
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
  document.getElementById('logout-btn').style.display = 'block';

  navigateTo('elections');
}

document.getElementById('logout-btn').addEventListener('click', () => {
  currentUser = null;
  document.getElementById('user-name-display').textContent = 'Not logged in';
  document.getElementById('user-roll').textContent = '—';
  document.getElementById('user-avatar').textContent = '?';
  document.getElementById('logout-btn').style.display = 'none';
  navigateTo('login');
  document.getElementById('login-roll').value = '';
  document.getElementById('login-name').value = '';
  document.getElementById('login-dept').value = '';
});

// ============================================================
// ELECTIONS RENDER
// ============================================================
function renderElections() {
  const grid = document.getElementById('elections-grid');
  const now = new Date();

  if (!state.elections.length) {
    grid.innerHTML = `<div class="empty-state"><div class="emoji">🗳️</div><h4>No Elections Yet</h4><p>Ask an admin to create one.</p></div>`;
    return;
  }

  grid.innerHTML = state.elections.map(el => {
    const hasVoted = hasUserVoted(el.id);
    const isExpired = new Date(el.deadline) < now;
    const status = isExpired ? 'closed' : el.status;
    const totalVotes = Object.keys(el.votes).length;

    let tagHtml, ctaHtml;
    if (hasVoted) {
      tagHtml = `<span class="election-tag election-tag--voted">✓ Voted</span>`;
      ctaHtml = `<span class="voted-check">✓ Vote Cast</span>`;
    } else if (status === 'closed') {
      tagHtml = `<span class="election-tag election-tag--closed">Closed</span>`;
      ctaHtml = `<span class="vote-cta">Results →</span>`;
    } else {
      tagHtml = `<span class="election-tag election-tag--active">Active</span>`;
      ctaHtml = `<span class="vote-cta">Vote Now →</span>`;
    }

    const deadlineStr = new Date(el.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    return `
      <div class="election-card ${hasVoted ? 'voted' : ''} ${status === 'closed' ? 'closed' : ''}"
           data-id="${el.id}" data-status="${status}">
        <div class="election-card__meta">
          ${tagHtml}
          <span class="election-deadline">${status === 'closed' ? 'Closed' : 'Ends'} ${deadlineStr}</span>
        </div>
        <h3>${el.title}</h3>
        <p>${el.description}</p>
        <div class="election-card__footer">
          <span class="candidates-count">${el.candidates.length} candidates · ${totalVotes} votes</span>
          ${ctaHtml}
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.election-card').forEach(card => {
    card.addEventListener('click', () => {
      const el = state.elections.find(e => e.id === card.dataset.id);
      const status = card.dataset.status;
      if (status === 'closed') {
        navigateTo('results');
      } else if (!hasUserVoted(el.id)) {
        openVoteModal(el);
      }
    });
  });
}

function hasUserVoted(electionId) {
  if (!currentUser) return false;
  return !!state.elections.find(e => e.id === electionId)?.votes[currentUser.roll];
}

// ============================================================
// VOTE MODAL
// ============================================================
function openVoteModal(election) {
  currentElectionId = election.id;
  selectedCandidate = null;

  document.getElementById('modal-election-title').textContent = election.title;
  document.getElementById('modal-election-desc').textContent = election.description;

  const colors = ['#5b6bff', '#22c55e', '#f0b429', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4'];

  document.getElementById('modal-candidates').innerHTML = election.candidates.map((c, i) => {
    const col = c.color || colors[i % colors.length];
    return `
      <div class="candidate-option" data-id="${c.id}">
        <div class="candidate-avatar" style="background:${col}22;color:${col}">${c.name[0]}</div>
        <div class="candidate-info">
          <strong>${c.name}</strong>
          <span>${c.manifesto}</span>
        </div>
        <div class="candidate-radio"></div>
      </div>`;
  }).join('');

  document.querySelectorAll('.candidate-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.candidate-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedCandidate = opt.dataset.id;
      document.getElementById('submit-vote-btn').disabled = false;
    });
  });

  document.getElementById('submit-vote-btn').disabled = true;
  document.getElementById('vote-modal').classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('vote-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('vote-modal')) closeModal();
});

function closeModal() {
  document.getElementById('vote-modal').classList.add('hidden');
  selectedCandidate = null;
  currentElectionId = null;
}

document.getElementById('submit-vote-btn').addEventListener('click', () => {
  if (!selectedCandidate || !currentElectionId || !currentUser) return;

  if (navigator.onLine) {
    applyVote(currentElectionId, currentUser.roll, selectedCandidate, true);
  } else {
    // Queue for offline sync
    state.pendingVotes.push({
      electionId: currentElectionId,
      rollNumber: currentUser.roll,
      candidateId: selectedCandidate,
      timestamp: new Date().toISOString()
    });
    // Optimistically update UI
    applyVote(currentElectionId, currentUser.roll, selectedCandidate, false);
    showToast('offline', '📦 Vote saved — will sync when online.');
  }

  closeModal();
  launchConfetti();
  renderElections();
});

function applyVote(electionId, rollNumber, candidateId, persist = true) {
  const el = state.elections.find(e => e.id === electionId);
  if (!el) return;
  el.votes[rollNumber] = candidateId;
  if (persist) saveState(state);
}

// ============================================================
// RESULTS
// ============================================================
function renderResults() {
  const container = document.getElementById('results-container');

  if (!state.elections.length) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">📊</div><h4>No Data Yet</h4><p>Results will appear here once elections start.</p></div>`;
    return;
  }

  container.innerHTML = state.elections.map(el => {
    const totalVotes = Object.values(el.votes).length;
    const tally = {};
    el.candidates.forEach(c => tally[c.id] = 0);
    Object.values(el.votes).forEach(cid => { if (tally[cid] !== undefined) tally[cid]++; });
    const maxVotes = Math.max(...Object.values(tally), 1);
    const winnerId = Object.keys(tally).reduce((a, b) => tally[a] >= tally[b] ? a : b, '');

    const isExpired = new Date(el.deadline) < new Date();

    const rows = el.candidates.map(c => {
      const pct = totalVotes ? Math.round((tally[c.id] / totalVotes) * 100) : 0;
      const isWinner = c.id === winnerId && totalVotes > 0;
      const fillW = totalVotes ? (tally[c.id] / maxVotes) * 100 : 0;
      return `
        <div class="result-row">
          <div class="result-row__header">
            <span class="result-name">
              ${isWinner && isExpired ? '<span class="winner-crown">👑</span>' : ''}
              ${c.name}
            </span>
            <span class="result-count">${tally[c.id]} votes (${pct}%)</span>
          </div>
          <div class="result-bar-track">
            <div class="result-bar-fill ${isWinner ? 'winner' : ''}" style="width:${fillW}%"></div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="result-card">
        <div class="result-card__title">${el.title}</div>
        <div class="result-card__total">${totalVotes} total votes cast</div>
        ${rows}
      </div>`;
  }).join('');

  // Animate bars
  setTimeout(() => {
    document.querySelectorAll('.result-bar-fill').forEach(bar => {
      bar.style.width = bar.style.width; // trigger reflow trick handled by CSS transition
    });
  }, 50);
}

// ============================================================
// HISTORY
// ============================================================
function renderHistory() {
  const container = document.getElementById('history-container');
  if (!currentUser) return;

  const myVotes = [];
  state.elections.forEach(el => {
    const cid = el.votes[currentUser.roll];
    if (cid) {
      const candidate = el.candidates.find(c => c.id === cid);
      myVotes.push({ election: el.title, candidate: candidate?.name || 'Unknown', id: el.id });
    }
  });

  // Pending offline
  state.pendingVotes.filter(v => v.rollNumber === currentUser.roll).forEach(v => {
    const el = state.elections.find(e => e.id === v.electionId);
    const candidate = el?.candidates.find(c => c.id === v.candidateId);
    myVotes.push({ election: el?.title || 'Unknown', candidate: candidate?.name || 'Unknown', pending: true });
  });

  if (!myVotes.length) {
    container.innerHTML = `<div class="history-empty"><div class="emoji">📜</div><p>You haven't voted in any election yet.<br>Head to Elections to cast your first vote!</p></div>`;
    return;
  }

  container.innerHTML = `<div class="history-list">` +
    myVotes.map(v => `
      <div class="history-item">
        <div class="history-icon">🗳️</div>
        <div class="history-info">
          <strong>${v.election}</strong>
          <span>Voted for <strong>${v.candidate}</strong>${v.pending ? ' <em>(pending sync)</em>' : ''}</span>
        </div>
        <span class="history-time">${v.pending ? '⏳' : '✓'}</span>
      </div>`).join('') +
    `</div>`;
}

// ============================================================
// ADMIN
// ============================================================
function renderAdmin() {
  renderAdminDropdown();
  renderAdminStats();
}

function renderAdminDropdown() {
  const sel = document.getElementById('candidate-election-select');
  sel.innerHTML = `<option value="">Choose election…</option>` +
    state.elections.map(el => `<option value="${el.id}">${el.title}</option>`).join('');
}

function renderAdminStats() {
  const container = document.getElementById('admin-stats');
  const totalVotes = state.elections.reduce((sum, el) => sum + Object.keys(el.votes).length, 0);
  const totalCandidates = state.elections.reduce((sum, el) => sum + el.candidates.length, 0);
  const activeCount = state.elections.filter(el => el.status === 'active' && new Date(el.deadline) > new Date()).length;

  container.innerHTML = [
    { n: state.elections.length, l: 'Total Elections' },
    { n: activeCount, l: 'Active Elections' },
    { n: totalCandidates, l: 'Total Candidates' },
    { n: totalVotes, l: 'Votes Cast' },
    { n: state.pendingVotes.length, l: 'Pending Sync' },
  ].map(s => `
    <div class="stat-block">
      <div class="stat-block__number">${s.n}</div>
      <div class="stat-block__label">${s.l}</div>
    </div>`).join('');
}

document.getElementById('create-election-btn').addEventListener('click', () => {
  const title = document.getElementById('new-election-title').value.trim();
  const desc = document.getElementById('new-election-desc').value.trim();
  const deadline = document.getElementById('new-election-deadline').value;

  if (!title || !deadline) {
    shake(document.getElementById('create-election-btn'));
    return;
  }

  const newEl = {
    id: 'e' + Date.now(),
    title,
    description: desc || 'Cast your vote for the best candidate.',
    deadline: new Date(deadline).toISOString(),
    status: 'active',
    candidates: [],
    votes: {}
  };

  state.elections.push(newEl);
  saveState(state);

  document.getElementById('new-election-title').value = '';
  document.getElementById('new-election-desc').value = '';
  document.getElementById('new-election-deadline').value = '';

  renderAdmin();
  showToast('online', '✅ Election created!');
});

document.getElementById('add-candidate-btn').addEventListener('click', () => {
  const eid = document.getElementById('candidate-election-select').value;
  const name = document.getElementById('candidate-name').value.trim();
  const manifesto = document.getElementById('candidate-manifesto').value.trim();

  if (!eid || !name) {
    shake(document.getElementById('add-candidate-btn'));
    return;
  }

  const el = state.elections.find(e => e.id === eid);
  if (!el) return;

  const colors = ['#5b6bff', '#22c55e', '#f0b429', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4', '#10b981'];
  el.candidates.push({
    id: 'c' + Date.now(),
    name,
    manifesto: manifesto || 'No manifesto provided.',
    color: colors[el.candidates.length % colors.length]
  });

  saveState(state);
  document.getElementById('candidate-name').value = '';
  document.getElementById('candidate-manifesto').value = '';

  renderAdmin();
  showToast('online', `✅ ${name} added as candidate!`);
});

document.getElementById('reset-all-btn').addEventListener('click', () => {
  if (!confirm('⚠ This will delete ALL elections, candidates, and votes. Are you absolutely sure?')) return;
  state = defaultState();
  saveState(state);
  renderAll();
  showToast('offline', '🗑 All data has been reset.');
});

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  if (document.getElementById('page-elections').classList.contains('active')) renderElections();
  if (document.getElementById('page-results').classList.contains('active')) renderResults();
  if (document.getElementById('page-history').classList.contains('active')) renderHistory();
  if (document.getElementById('page-admin').classList.contains('active')) renderAdmin();
}

// ============================================================
// CONFETTI
// ============================================================
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#5b6bff', '#f0b429', '#22c55e', '#ec4899', '#f97316', '#ffffff', '#8b5cf6'];

  for (let i = 0; i < 120; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 200,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 8,
      opacity: 1
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      if (frame > 80) p.opacity -= 0.015;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    frame++;
    if (frame < 140) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

// ============================================================
// TOAST
// ============================================================
function showToast(type, msg) {
  const id = type === 'online' ? 'online-toast' : 'offline-toast';
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ============================================================
// SHAKE ANIMATION (validation feedback)
// ============================================================
function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => el.style.animation = '', 400);
}

// Add shake keyframes
const style = document.createElement('style');
style.textContent = `
@keyframes shake {
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-6px)}
  40%{transform:translateX(6px)}
  60%{transform:translateX(-4px)}
  80%{transform:translateX(4px)}
}`;
document.head.appendChild(style);

// ============================================================
// INIT
// ============================================================
function init() {
  // Show login page initially
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-login').classList.add('active');

  // Hide sidebar nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
}

init();
