/* ============================================================
   EduVote — Student Election Portal  |  app.js
   Offline-first: localStorage + sync status
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────
//  STATE & CONSTANTS
// ─────────────────────────────────────────────
const STORAGE_KEYS = {
  candidates: 'eduvote_candidates',
  votes:      'eduvote_votes',
  voters:     'eduvote_voters',
  pending:    'eduvote_pending',
};

const ADMIN_PASSWORD = 'admin123';

// Default seed candidates
const DEFAULT_CANDIDATES = [
  { id: 'c1', position: 'President',         name: 'Arjun Mehta',    classYear: 'B.Tech 4th Year', slogan: 'Progress through Unity' },
  { id: 'c2', position: 'President',         name: 'Priya Sharma',   classYear: 'B.Tech 3rd Year', slogan: 'Voice for Every Student' },
  { id: 'c3', position: 'Vice President',    name: 'Rahul Verma',    classYear: 'M.Tech 2nd Year', slogan: 'Stronger Together' },
  { id: 'c4', position: 'Vice President',    name: 'Sneha Reddy',    classYear: 'B.Tech 4th Year', slogan: 'Lead with Integrity' },
  { id: 'c5', position: 'Secretary',         name: 'Karan Singh',    classYear: 'B.Tech 2nd Year', slogan: 'Transparency First' },
  { id: 'c6', position: 'Secretary',         name: 'Ananya Patel',   classYear: 'B.Tech 3rd Year', slogan: 'Your Ideas, My Action' },
  { id: 'c7', position: 'Treasurer',         name: 'Rohan Das',      classYear: 'B.Tech 4th Year', slogan: 'Smart Spending, Bright Future' },
  { id: 'c8', position: 'Treasurer',         name: 'Meera Iyer',     classYear: 'M.Tech 1st Year', slogan: 'Accountable & Transparent' },
  { id: 'c9', position: 'Cultural Secretary',name: 'Dev Nair',       classYear: 'B.Tech 3rd Year', slogan: 'Celebrate Our Diversity' },
  { id:'c10', position: 'Cultural Secretary',name: 'Tanvi Rao',      classYear: 'B.Tech 2nd Year', slogan: 'Art, Culture, Community' },
];

// App state (in-memory, synced to localStorage)
let state = {
  candidates: [],   // { id, position, name, classYear, slogan }
  votes:      {},   // { candidateId: count }
  voters:     [],   // [studentId, ...]  – who has voted
  pending:    [],   // votes queued while offline
};

let currentStudent = null;
let currentSelections = {};   // { position: candidateId }
let isOnline = navigator.onLine;
let adminLoggedIn = false;

// ─────────────────────────────────────────────
//  PERSISTENCE HELPERS
// ─────────────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEYS.candidates, JSON.stringify(state.candidates));
    localStorage.setItem(STORAGE_KEYS.votes,      JSON.stringify(state.votes));
    localStorage.setItem(STORAGE_KEYS.voters,     JSON.stringify(state.voters));
    localStorage.setItem(STORAGE_KEYS.pending,    JSON.stringify(state.pending));
  } catch(e) { console.warn('localStorage save failed', e); }
}

function loadState() {
  try {
    const cands = localStorage.getItem(STORAGE_KEYS.candidates);
    const votes = localStorage.getItem(STORAGE_KEYS.votes);
    const voters= localStorage.getItem(STORAGE_KEYS.voters);
    const pend  = localStorage.getItem(STORAGE_KEYS.pending);

    state.candidates = cands  ? JSON.parse(cands)  : [...DEFAULT_CANDIDATES];
    state.votes      = votes  ? JSON.parse(votes)  : {};
    state.voters     = voters ? JSON.parse(voters) : [];
    state.pending    = pend   ? JSON.parse(pend)   : [];

    // Ensure every candidate has a vote count
    state.candidates.forEach(c => {
      if (!(c.id in state.votes)) state.votes[c.id] = 0;
    });
  } catch(e) {
    console.warn('localStorage load failed, using defaults', e);
    state.candidates = [...DEFAULT_CANDIDATES];
    state.votes = {};
    state.voters = [];
    state.pending = [];
  }
}

// ─────────────────────────────────────────────
//  NETWORK STATUS
// ─────────────────────────────────────────────
function updateNetworkUI() {
  const bar   = document.getElementById('networkBar');
  const msg   = document.getElementById('networkMsg');
  const dot   = document.querySelector('.sync-dot');
  const label = document.getElementById('syncLabel');
  const footerNote = document.getElementById('footerOfflineNote');

  if (isOnline) {
    bar.classList.add('hidden');
    dot.className = 'sync-dot synced';
    label.textContent = 'Synced';
    footerNote.textContent = '';
  } else {
    bar.classList.remove('hidden');
    bar.className = 'network-bar offline-bar';
    msg.textContent = "You're offline — votes are saved locally and will sync when reconnected.";
    dot.className = 'sync-dot offline';
    label.textContent = 'Offline';
    footerNote.textContent = '⚡ Offline mode active';
  }
}

function syncPendingVotes() {
  if (!isOnline || state.pending.length === 0) return;
  // In a real app, POST to server here.
  // For this demo, pending votes are already merged into state.votes locally.
  state.pending = [];
  saveState();

  const dot   = document.querySelector('.sync-dot');
  const label = document.getElementById('syncLabel');
  dot.className = 'sync-dot pending';
  label.textContent = 'Syncing…';
  setTimeout(() => {
    dot.className = 'sync-dot synced';
    label.textContent = 'Synced';
  }, 1200);
}

window.addEventListener('online',  () => { isOnline = true;  updateNetworkUI(); syncPendingVotes(); });
window.addEventListener('offline', () => { isOnline = false; updateNetworkUI(); });

// ─────────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────────
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelector(`.nav-btn[data-page="${pageId}"]`).classList.add('active');
  if (pageId === 'results') renderResults();
  if (pageId === 'admin')   renderAdminCandidates();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.page));
});

// ─────────────────────────────────────────────
//  POSITION HELPERS
// ─────────────────────────────────────────────
function getPositions() {
  return [...new Set(state.candidates.map(c => c.position))];
}

function getCandidatesByPosition(pos) {
  return state.candidates.filter(c => c.position === pos);
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

// ─────────────────────────────────────────────
//  VOTER VERIFICATION
// ─────────────────────────────────────────────
document.getElementById('verifyBtn').addEventListener('click', verifyVoter);
document.getElementById('studentId').addEventListener('keydown', e => {
  if (e.key === 'Enter') verifyVoter();
});

function verifyVoter() {
  const raw = document.getElementById('studentId').value.trim().toUpperCase();
  const errEl = document.getElementById('authError');
  errEl.classList.add('hidden');

  if (!raw || raw.length < 4) {
    showAuthError('Please enter a valid Student ID (min 4 characters).');
    return;
  }
  if (state.voters.includes(raw)) {
    showAuthError(`Student ID "${raw}" has already voted in this election.`);
    return;
  }

  currentStudent = raw;
  currentSelections = {};
  document.getElementById('displayStudentId').textContent = raw;
  document.getElementById('voterAuth').classList.add('hidden');
  document.getElementById('ballotSection').classList.remove('hidden');
  renderBallot();
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

document.getElementById('changeVoterBtn').addEventListener('click', () => {
  currentStudent = null;
  currentSelections = {};
  document.getElementById('studentId').value = '';
  document.getElementById('authError').classList.add('hidden');
  document.getElementById('voterAuth').classList.remove('hidden');
  document.getElementById('ballotSection').classList.add('hidden');
});

// ─────────────────────────────────────────────
//  BALLOT RENDERING
// ─────────────────────────────────────────────
function renderBallot() {
  const grid = document.getElementById('positionsGrid');
  const positions = getPositions();
  grid.innerHTML = '';

  document.getElementById('totalPositions').textContent = positions.length;

  if (positions.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-3);grid-column:1/-1">No candidates have been added yet. Ask the admin to add candidates.</p>';
    return;
  }

  positions.forEach(pos => {
    const cands = getCandidatesByPosition(pos);
    const card = document.createElement('div');
    card.className = 'position-card';
    card.id = `pos-card-${pos.replace(/\s+/g,'_')}`;
    card.innerHTML = `
      <div class="pos-card-head">
        <div class="pos-title">${pos}</div>
        <div class="pos-count">${cands.length} candidate${cands.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="candidates-list" id="cand-list-${pos.replace(/\s+/g,'_')}">
        ${cands.map(c => candidateOptionHTML(c, pos)).join('')}
      </div>
    `;
    grid.appendChild(card);
  });

  // Bind click events
  document.querySelectorAll('.candidate-option').forEach(opt => {
    opt.addEventListener('click', () => selectCandidate(opt.dataset.position, opt.dataset.id));
  });

  updateSubmitButton();
}

function candidateOptionHTML(c, pos) {
  const posKey = pos.replace(/\s+/g,'_');
  return `
    <label class="candidate-option" data-position="${pos}" data-id="${c.id}" id="opt-${c.id}">
      <input type="radio" name="pos-${posKey}" value="${c.id}" />
      <div class="candidate-avatar">${getInitials(c.name)}</div>
      <div class="candidate-info">
        <div class="candidate-name">${c.name}</div>
        <div class="candidate-class">${c.classYear}</div>
        ${c.slogan ? `<div class="candidate-slogan">"${c.slogan}"</div>` : ''}
      </div>
      <div class="candidate-check">✓</div>
    </label>
  `;
}

function selectCandidate(position, candidateId) {
  // Deselect all in this position
  const posKey = position.replace(/\s+/g,'_');
  document.querySelectorAll(`[data-position="${position}"]`).forEach(el => {
    el.classList.remove('selected');
    el.querySelector('input[type="radio"]').checked = false;
  });

  // Select clicked
  const opt = document.getElementById('opt-' + candidateId);
  opt.classList.add('selected');
  opt.querySelector('input').checked = true;
  currentSelections[position] = candidateId;

  // Mark card
  const card = document.getElementById(`pos-card-${posKey}`);
  if (card) card.classList.add('has-selection');

  updateSubmitButton();
}

function updateSubmitButton() {
  const positions = getPositions();
  const selected  = Object.keys(currentSelections).length;
  document.getElementById('selectedCount').textContent = selected;
  document.getElementById('totalPositions').textContent = positions.length;
  const castBtn = document.getElementById('castVoteBtn');
  castBtn.disabled = selected < positions.length;
}

// ─────────────────────────────────────────────
//  VOTE SUBMISSION
// ─────────────────────────────────────────────
document.getElementById('castVoteBtn').addEventListener('click', openConfirmModal);

function openConfirmModal() {
  const list = document.getElementById('confirmList');
  list.innerHTML = '';
  Object.entries(currentSelections).forEach(([pos, candId]) => {
    const cand = state.candidates.find(c => c.id === candId);
    const item = document.createElement('div');
    item.className = 'confirm-item';
    item.innerHTML = `<span class="confirm-pos">${pos}</span><span class="confirm-name">${cand ? cand.name : candId}</span>`;
    list.appendChild(item);
  });
  document.getElementById('confirmModal').classList.remove('hidden');
}

document.getElementById('cancelVoteBtn').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.add('hidden');
});

document.getElementById('finalCastBtn').addEventListener('click', castVote);

function castVote() {
  document.getElementById('confirmModal').classList.add('hidden');

  const voteRecord = {
    voter: currentStudent,
    timestamp: new Date().toISOString(),
    selections: { ...currentSelections },
  };

  // Record votes
  Object.values(currentSelections).forEach(candId => {
    state.votes[candId] = (state.votes[candId] || 0) + 1;
  });

  // Mark voter
  state.voters.push(currentStudent);

  // Pending queue (for offline scenario)
  if (!isOnline) {
    state.pending.push(voteRecord);
  }

  saveState();

  // Show receipt
  const receipt = document.getElementById('receiptBox');
  const lines = [
    `Receipt ID : ${generateReceiptId()}`,
    `Voter ID   : ${currentStudent}`,
    `Timestamp  : ${new Date().toLocaleString()}`,
    `Mode       : ${isOnline ? 'Online' : 'Offline (queued)'}`,
    `─────────────────────────────`,
    ...Object.entries(currentSelections).map(([pos, id]) => {
      const c = state.candidates.find(c => c.id === id);
      return `${pos.padEnd(20)}: ${c ? c.name : id}`;
    }),
  ];
  receipt.innerHTML = lines.map(l => `<div>${l}</div>`).join('');

  const msgEl = document.getElementById('successMsg');
  msgEl.textContent = isOnline
    ? 'Your vote has been recorded and confirmed.'
    : 'You\'re offline. Your vote is saved locally and will be synced when you reconnect.';

  document.getElementById('successScreen').classList.remove('hidden');

  // Reset
  currentStudent = null;
  currentSelections = {};
}

function generateReceiptId() {
  return 'EV-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
}

document.getElementById('doneBtn').addEventListener('click', () => {
  document.getElementById('successScreen').classList.add('hidden');
  document.getElementById('voterAuth').classList.remove('hidden');
  document.getElementById('ballotSection').classList.add('hidden');
  document.getElementById('studentId').value = '';
  navigate('vote');
});

// ─────────────────────────────────────────────
//  RESULTS
// ─────────────────────────────────────────────
document.getElementById('refreshResults').addEventListener('click', renderResults);

function renderResults() {
  const grid = document.getElementById('resultsGrid');
  const positions = getPositions();
  grid.innerHTML = '';

  const totalVoters = state.voters.length;
  document.getElementById('totalVoters').textContent = `${totalVoters} vote${totalVoters !== 1 ? 's' : ''} cast`;

  if (positions.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-3);grid-column:1/-1;padding:24px">No candidates added yet.</p>';
    return;
  }

  positions.forEach(pos => {
    const cands = getCandidatesByPosition(pos);
    const totalVotes = cands.reduce((sum, c) => sum + (state.votes[c.id] || 0), 0);
    const maxVotes   = Math.max(...cands.map(c => state.votes[c.id] || 0));

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-card-head">
        <span class="result-pos-title">${pos}</span>
        <span class="result-total-votes">${totalVotes} vote${totalVotes !== 1 ? 's' : ''}</span>
      </div>
      <div class="result-candidates">
        ${totalVotes === 0
          ? `<div class="no-votes-msg">No votes cast yet</div>`
          : cands
              .sort((a,b) => (state.votes[b.id]||0) - (state.votes[a.id]||0))
              .map(c => {
                const v = state.votes[c.id] || 0;
                const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0;
                const isWinner = v === maxVotes && v > 0;
                return `
                  <div class="result-candidate">
                    <div class="result-cand-row">
                      <span class="result-cand-name ${isWinner ? 'winner' : ''}">
                        ${isWinner ? '<span class="result-winner-crown">👑</span>' : ''}${c.name}
                      </span>
                      <span class="result-cand-count">${v} vote${v !== 1 ? 's' : ''} (${pct}%)</span>
                    </div>
                    <div class="result-bar-bg">
                      <div class="result-bar-fill ${isWinner ? 'winner-bar' : ''}" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join('')
        }
      </div>
    `;
    grid.appendChild(card);
  });

  // Animate bars
  setTimeout(() => {
    document.querySelectorAll('.result-bar-fill').forEach(bar => {
      bar.style.transition = 'width 0.9s cubic-bezier(0.4,0,0.2,1)';
    });
  }, 50);
}

// ─────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────
document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);
document.getElementById('adminPass').addEventListener('keydown', e => {
  if (e.key === 'Enter') adminLogin();
});

function adminLogin() {
  const pass = document.getElementById('adminPass').value;
  const err  = document.getElementById('adminError');
  if (pass === ADMIN_PASSWORD) {
    adminLoggedIn = true;
    document.getElementById('adminLock').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    renderAdminCandidates();
    renderAdminStats();
  } else {
    err.textContent = 'Incorrect password. Try again.';
    err.classList.remove('hidden');
  }
}

document.getElementById('adminLogoutBtn').addEventListener('click', () => {
  adminLoggedIn = false;
  document.getElementById('adminPass').value = '';
  document.getElementById('adminError').classList.add('hidden');
  document.getElementById('adminLock').classList.remove('hidden');
  document.getElementById('adminPanel').classList.add('hidden');
});

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'export') { renderAdminStats(); renderVotedList(); }
  });
});

// Add Candidate
document.getElementById('addCandidateBtn').addEventListener('click', () => {
  const pos    = document.getElementById('candidatePosition').value;
  const name   = document.getElementById('candidateName').value.trim();
  const cls    = document.getElementById('candidateClass').value.trim();
  const slogan = document.getElementById('candidateSlogan').value.trim();

  if (!pos || !name || !cls) { alert('Please fill in Position, Name, and Class.'); return; }

  const newCand = {
    id: 'c' + Date.now(),
    position: pos, name, classYear: cls, slogan,
  };
  state.candidates.push(newCand);
  state.votes[newCand.id] = 0;
  saveState();

  // Clear form
  document.getElementById('candidatePosition').value = '';
  document.getElementById('candidateName').value = '';
  document.getElementById('candidateClass').value = '';
  document.getElementById('candidateSlogan').value = '';

  renderAdminCandidates();
});

function renderAdminCandidates() {
  const table = document.getElementById('candidatesTable');
  if (state.candidates.length === 0) {
    table.innerHTML = '<div class="empty-table">No candidates added yet.</div>';
    return;
  }
  const sorted = [...state.candidates].sort((a,b) => a.position.localeCompare(b.position));
  table.innerHTML = sorted.map(c => `
    <div class="cand-row">
      <span class="cand-row-pos">${c.position}</span>
      <span class="cand-row-name">${c.name}</span>
      <span class="cand-row-class">${c.classYear}</span>
      <button class="btn-remove" data-id="${c.id}" title="Remove candidate">×</button>
    </div>
  `).join('');

  table.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(`Remove "${state.candidates.find(c=>c.id===btn.dataset.id)?.name}"?`)) {
        removeCandidate(btn.dataset.id);
      }
    });
  });
}

function removeCandidate(id) {
  state.candidates = state.candidates.filter(c => c.id !== id);
  delete state.votes[id];
  saveState();
  renderAdminCandidates();
}

function renderAdminStats() {
  const stats = document.getElementById('adminStats');
  const totalVoters = state.voters.length;
  const totalCands  = state.candidates.length;
  const positions   = getPositions().length;
  const pending     = state.pending.length;

  stats.innerHTML = `
    <div class="stat-card"><div class="stat-num">${totalVoters}</div><div class="stat-label">Votes Cast</div></div>
    <div class="stat-card"><div class="stat-num">${totalCands}</div><div class="stat-label">Candidates</div></div>
    <div class="stat-card"><div class="stat-num">${positions}</div><div class="stat-label">Positions</div></div>
    <div class="stat-card"><div class="stat-num">${pending}</div><div class="stat-label">Pending Sync</div></div>
  `;
}

function renderVotedList() {
  const el = document.getElementById('votedList');
  if (state.voters.length === 0) {
    el.innerHTML = '<span style="color:var(--text-3);font-size:13px">No votes cast yet.</span>';
    return;
  }
  el.innerHTML = state.voters.map(v => `<span class="voter-chip">${v}</span>`).join('');
}

// Export
document.getElementById('exportBtn').addEventListener('click', () => {
  const data = {
    exportedAt: new Date().toISOString(),
    totalVoters: state.voters.length,
    results: getPositions().map(pos => ({
      position: pos,
      candidates: getCandidatesByPosition(pos).map(c => ({
        name: c.name, classYear: c.classYear, votes: state.votes[c.id] || 0
      })).sort((a,b) => b.votes - a.votes)
    })),
    voters: state.voters,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `eduvote-results-${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(url);
});

// Reset votes only
document.getElementById('resetVotesBtn').addEventListener('click', () => {
  if (!confirm('Reset ALL votes? This cannot be undone.')) return;
  state.voters = [];
  state.pending = [];
  state.votes = {};
  state.candidates.forEach(c => state.votes[c.id] = 0);
  saveState();
  renderAdminCandidates();
  renderAdminStats();
  renderVotedList();
  alert('All votes have been reset.');
});

// Reset everything
document.getElementById('resetAllBtn').addEventListener('click', () => {
  if (!confirm('RESET EVERYTHING including all candidates and votes? This is irreversible.')) return;
  state.candidates = [...DEFAULT_CANDIDATES];
  state.votes = {};
  state.voters = [];
  state.pending = [];
  state.candidates.forEach(c => state.votes[c.id] = 0);
  saveState();
  renderAdminCandidates();
  renderAdminStats();
  renderVotedList();
  alert('System reset to defaults.');
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
function init() {
  loadState();
  updateNetworkUI();
  navigate('vote');

  // Attempt to flush pending votes on load if online
  if (isOnline && state.pending.length > 0) {
    syncPendingVotes();
  }
}

init();
