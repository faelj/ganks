// ===================================================
// PvPs da Guilda — lógica do placar (sincronizado via Firebase)
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================================
// COLE AQUI a configuração do SEU projeto Firebase.
// Você encontra esses valores em:
// Configurações do projeto > Geral > Seus apps > SDK do Firebase
// ==========================================================
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};
// ==========================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const stateDocRef = doc(db, "pvpsDaGuilda", "estado");

const PLAYERS = ['mega', 'gui', 'pedro'];
const PLAYER_NAMES = { mega: 'Mega', gui: 'Gui', pedro: 'Pedrinho' };

const MATCHUPS = [
  { id: 'mega_gui', p1: 'mega', p2: 'gui' },
  { id: 'mega_pedro', p1: 'mega', p2: 'pedro' },
  { id: 'gui_pedro', p1: 'gui', p2: 'pedro' },
];

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

// Estado inicial com os números da planilha original.
// Só é usado se ainda não existir nada salvo no Firebase.
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
let previousScores = {};
let previousChoro = {};

function setSyncStatus(text, kind) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.textContent = text;
  el.className = `sync-status${kind ? ' ' + kind : ''}`;
}

// Envia o novo estado pro Firebase. A tela de todo mundo conectado
// se atualiza sozinha através do onSnapshot lá embaixo.
function pushState(newState) {
  setDoc(stateDocRef, newState).catch((e) => {
    console.error('Erro ao salvar no Firebase:', e);
    setSyncStatus('Erro ao salvar — verifique sua internet.', 'error');
  });
}

function updateScore(matchupId, player, delta) {
  const next = state.matchups[matchupId][player] + delta;
  if (next < 0) return;
  const newState = structuredClone(state);
  newState.matchups[matchupId][player] = next;
  pushState(newState);
}

function updateChoro(player, delta) {
  const next = state.choro[player] + delta;
  if (next < 0) return;
  const newState = structuredClone(state);
  newState.choro[player] = next;
  pushState(newState);
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

    [[m.p1, p1Score], [m.p2, p2Score]].forEach(([player, score]) => {
      const key = `${m.id}-${player}`;
      const el = card.querySelector(`[data-score="${key}"]`);
      if (previousScores[key] !== undefined && previousScores[key] !== score) {
        el.classList.add('bump');
      }
      previousScores[key] = score;
    });
  });

  container.querySelectorAll('button[data-matchup]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { matchup, player, delta } = btn.dataset;
      updateScore(matchup, player, Number(delta));
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
    const score = state.choro[p];
    const item = document.createElement('div');
    item.className = 'choro-item';
    item.innerHTML = `
      <span class="fighter-name">${PLAYER_NAMES[p]}</span>
      <span class="score" data-choro-score="${p}">${score}</span>
      <div class="score-btns">
        <button type="button" data-choro="${p}" data-delta="-1" aria-label="Tirar um choro de ${PLAYER_NAMES[p]}">−</button>
        <button type="button" data-choro="${p}" data-delta="1" aria-label="Adicionar um choro de ${PLAYER_NAMES[p]}">+</button>
      </div>
    `;
    container.appendChild(item);

    const el = item.querySelector(`[data-choro-score="${p}"]`);
    if (previousChoro[p] !== undefined && previousChoro[p] !== score) {
      el.classList.add('bump');
    }
    previousChoro[p] = score;
  });

  container.querySelectorAll('button[data-choro]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateChoro(btn.dataset.choro, Number(btn.dataset.delta));
    });
  });
}

function resetAll() {
  const ok = confirm('Resetar todos os placares (confrontos, geral e choro) para zero, pra todo mundo que usa este site? Essa ação não pode ser desfeita.');
  if (!ok) return;
  pushState(zeroState());
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
      pushState(imported);
      alert('Dados importados e enviados pro Firebase com sucesso!');
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

// Escuta o documento no Firestore. Toda vez que alguém (você, seu amigo,
// ou você em outra aba) alterar o placar, essa função roda de novo aqui
// e atualiza a tela na hora.
onSnapshot(
  stateDocRef,
  (snapshot) => {
    if (snapshot.exists()) {
      state = snapshot.data();
    } else {
      // primeira vez: cria o documento no Firebase com os valores da planilha
      state = seedStateFromSheet();
      setDoc(stateDocRef, state);
    }
    renderAll();
    setSyncStatus('🟢 Sincronizado em tempo real', 'ok');
  },
  (error) => {
    console.error('Erro ao conectar no Firebase:', error);
    setSyncStatus('🔴 Sem conexão com o Firebase — confira a configuração no script.js', 'error');
    renderAll(); // ainda mostra os valores da planilha como fallback local
  }
);
