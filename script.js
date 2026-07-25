// ===================================================
// PvPs da Guilda — lógica do placar
// ===================================================

const PLAYERS = ['mega', 'gui', 'pedro'];
const PLAYER_NAMES = { mega: 'Mega', gui: 'Gui', pedro: 'Pedrinho' };

const MATCHUPS = [
  { id: 'mega_gui', p1: 'mega', p2: 'gui' },
  { id: 'mega_pedro', p1: 'mega', p2: 'pedro' },
  { id: 'gui_pedro', p1: 'gui', p2: 'pedro' },
];

const STORAGE_KEY = 'pvpsDaGuildaData';

// Estado zerado, usado pelo botão "Resetar tudo"
function zeroState() {
  return {
    matchups: {
      mega_gui: { mega: 0, gui: 0 },
      mega_pedro: { mega: 0, pedro: 0 },
      gui_pedro: { gui: 0, pedro: 0 },
    },
    choro: { mega: 0, gui: 0, pedro: 0 },
  };
}

// Estado inicial, com os números da planilha que você já tinha.
// Só é usado na primeira vez que o site abre, antes de existir
// qualquer coisa salva no localStorage.
function seedStateFromSheet() {
  return {
    matchups: {
      mega_gui: { mega: 6, gui: 1 },
      mega_pedro: { mega: 0, pedro: 5 },
      gui_pedro: { gui: 2, pedro: 2 },
    },
    choro: { mega: 5, gui: 2, pedro: 0 },
  };
}

let state = seedStateFromSheet();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      state = JSON.parse(saved);
    }
    // se não houver nada salvo ainda, mantém o seed da planilha
  } catch (e) {
    console.error('Não foi possível carregar os dados salvos:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Não foi possível salvar os dados:', e);
  }
}

function updateScore(matchupId, player, delta) {
  const next = state.matchups[matchupId][player] + delta;
  if (next < 0) return;
  state.matchups[matchupId][player] = next;
  saveState();
  renderMatchups();
  renderStandings();
}

function updateChoro(player, delta) {
  const next = state.choro[player] + delta;
  if (next < 0) return;
  state.choro[player] = next;
  saveState();
  renderChoro();
}

// Soma as vitórias/derrotas de cada jogador a partir dos 3 confrontos
function calculateTotals() {
  const totals = {};
  PLAYERS.forEach((p) => { totals[p] = { wins: 0, losses: 0 }; });

  MATCHUPS.forEach((m) => {
    const p1Wins = state.matchups[m.id][m.p1];
    const p2Wins = state.matchups[m.id][m.p2];
    totals[m.p1].wins += p1Wins;
    totals[m.p1].losses += p2Wins;
    totals[m.p2].wins += p2Wins;
    totals[m.p2].losses += p1Wins;
  });

  return totals;
}

function renderMatchups() {
  const container = document.getElementById('matchups-container');
  container.innerHTML = '';

  MATCHUPS.forEach((m) => {
    const p1Score = state.matchups[m.id][m.p1];
    const p2Score = state.matchups[m.id][m.p2];
    const p1Leads = p1Score > p2Score;
    const p2Leads = p2Score > p1Score;

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="fight-row">
        <div class="fighter ${m.p1}">
          ${p1Leads ? '<span class="crown">👑</span>' : ''}
          <span class="fighter-name">${PLAYER_NAMES[m.p1]}</span>
          <span class="score" data-score="${m.id}-${m.p1}">${p1Score}</span>
          <div class="score-btns">
            <button type="button" data-matchup="${m.id}" data-player="${m.p1}" data-delta="-1" aria-label="Tirar uma vitória de ${PLAYER_NAMES[m.p1]}">−</button>
            <button type="button" data-matchup="${m.id}" data-player="${m.p1}" data-delta="1" aria-label="Adicionar uma vitória de ${PLAYER_NAMES[m.p1]}">+</button>
          </div>
        </div>

        <div class="vs-burst" style="--a: var(--${m.p1}); --b: var(--${m.p2});"><span>VS</span></div>

        <div class="fighter ${m.p2}">
          ${p2Leads ? '<span class="crown">👑</span>' : ''}
          <span class="fighter-name">${PLAYER_NAMES[m.p2]}</span>
          <span class="score" data-score="${m.id}-${m.p2}">${p2Score}</span>
          <div class="score-btns">
            <button type="button" data-matchup="${m.id}" data-player="${m.p2}" data-delta="-1" aria-label="Tirar uma vitória de ${PLAYER_NAMES[m.p2]}">−</button>
            <button type="button" data-matchup="${m.id}" data-player="${m.p2}" data-delta="1" aria-label="Adicionar uma vitória de ${PLAYER_NAMES[m.p2]}">+</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('button[data-matchup]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { matchup, player, delta } = btn.dataset;
      updateScore(matchup, player, Number(delta));
      const scoreEl = container.querySelector(`[data-score="${matchup}-${player}"]`);
      if (scoreEl) {
        scoreEl.classList.remove('bump');
        // força reflow pra poder reiniciar a animação
        void scoreEl.offsetWidth;
        scoreEl.classList.add('bump');
      }
    });
  });
}

function renderStandings() {
  const totals = calculateTotals();
  const container = document.getElementById('standings-container');
  container.innerHTML = '';

  const sorted = [...PLAYERS].sort((a, b) => totals[b].wins - totals[a].wins);
  const topWins = totals[sorted[0]].wins;

  sorted.forEach((p, i) => {
    const { wins, losses } = totals[p];
    const total = wins + losses;
    const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const isLead = wins === topWins && wins > 0;

    const row = document.createElement('div');
    row.className = `rank-row${isLead ? ' lead' : ''}`;
    row.innerHTML = `
      <span class="rank-pos">${i + 1}º</span>
      <span class="rank-name"><span class="dot ${p}"></span>${PLAYER_NAMES[p]}</span>
      <span class="rank-stat win"><span class="n">${wins}</span><span class="l">Vitórias</span></span>
      <span class="rank-stat loss"><span class="n">${losses}</span><span class="l">Derrotas</span></span>
      <span class="rank-stat"><span class="n">${rate}%</span><span class="l">Aproveit.</span></span>
    `;
    container.appendChild(row);
  });
}

function renderChoro() {
  const container = document.getElementById('choro-container');
  container.innerHTML = '';

  PLAYERS.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'choro-item';
    item.innerHTML = `
      <span class="fighter-name">${PLAYER_NAMES[p]}</span>
      <span class="score">${state.choro[p]}</span>
      <div class="score-btns">
        <button type="button" data-choro="${p}" data-delta="-1" aria-label="Tirar um choro de ${PLAYER_NAMES[p]}">−</button>
        <button type="button" data-choro="${p}" data-delta="1" aria-label="Adicionar um choro de ${PLAYER_NAMES[p]}">+</button>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll('button[data-choro]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateChoro(btn.dataset.choro, Number(btn.dataset.delta));
    });
  });
}

function resetAll() {
  const ok = confirm('Resetar todos os placares (confrontos, geral e choro) para zero? Essa ação não pode ser desfeita.');
  if (!ok) return;
  state = zeroState();
  saveState();
  renderAll();
}

function exportData() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pvps-guilda-backup-${dateTag}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported || typeof imported !== 'object' || !imported.matchups || !imported.choro) {
        throw new Error('formato inesperado');
      }
      state = imported;
      saveState();
      renderAll();
      alert('Dados importados com sucesso!');
    } catch (err) {
      alert('Não foi possível importar esse arquivo. Verifique se é um backup .json exportado por este site.');
    }
  };
  reader.readAsText(file);
}

function renderAll() {
  renderMatchups();
  renderStandings();
  renderChoro();
}

document.getElementById('btn-reset').addEventListener('click', resetAll);
document.getElementById('btn-export').addEventListener('click', exportData);
document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importData(file);
  e.target.value = '';
});

loadState();
renderAll();
