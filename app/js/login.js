import { supabase } from './supabaseClient.js';
import { renderBracket, getViewedPlayer, goToOwnBracket } from './bracket.js';
import { renderStandings } from './standings.js';
import { renderTournament } from './tournament.js';
import { renderFullBracket } from './fullbracket.js';
import { renderProfile } from './profile.js';
import { goTab } from './nav.js';
import { openScores, openSeasonsAdmin, renderScores, commitStandings } from './commissioner.js';
import './keyboard-scroll.js';

const form = document.getElementById('login-form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');

const profileBtn = document.getElementById('profile-btn');
const profileOverlay = document.getElementById('profileOverlay');
const closeProfileBtn = document.getElementById('close-profile-btn');
const whoEl = document.getElementById('who');
const logoutBtn = document.getElementById('logout-btn');
const editNameBtn = document.getElementById('edit-name-btn');
const cancelNameBtn = document.getElementById('cancel-name-btn');
const nameForm = document.getElementById('name-form');
const displayNameInput = document.getElementById('display-name');
const commissionerLinks = document.getElementById('commissioner-links');
const commScoresBtn = document.getElementById('comm-scores-btn');
const commSeasonsBtn = document.getElementById('comm-seasons-btn');
const closeCommScoresBtn = document.getElementById('close-comm-scores-btn');
const closeCommSeasonsBtn = document.getElementById('close-comm-seasons-btn');
const commScoresSearch = document.getElementById('comm-scores-search');
const commScoresClear = document.getElementById('comm-scores-clear');
const feedbackText = document.getElementById('feedback-text');
const feedbackSendBtn = document.getElementById('feedback-send-btn');
const feedbackStatus = document.getElementById('feedback-status');

let currentSession = null;
let currentUserId = null;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const name = nameInput.value.trim();
  if (!email) return;

  submitBtn.disabled = true;
  statusEl.textContent = 'Sending link…';
  statusEl.className = 'status';

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      data: name ? { display_name: name } : undefined,
    },
  });

  submitBtn.disabled = false;

  if (error) {
    statusEl.textContent = error.message;
    statusEl.className = 'status error';
    return;
  }

  statusEl.textContent = `Check ${email} for a login link.`;
  statusEl.className = 'status success';
  form.reset();
});

profileBtn.addEventListener('click', () => {
  profileOverlay.classList.add('open');
  if (!currentSession) return;
  const viewed = getViewedPlayer();
  const isOwn = !viewed.id || viewed.id === currentSession.user.id;
  renderProfile(currentSession, isOwn ? undefined : { playerId: viewed.id, playerName: viewed.name });
});
closeProfileBtn.addEventListener('click', () => profileOverlay.classList.remove('open'));

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.reload();
});

feedbackSendBtn.addEventListener('click', async () => {
  const message = feedbackText.value.trim();
  if (!message || !currentUserId) return;

  feedbackSendBtn.disabled = true;
  feedbackStatus.textContent = '';

  const { error } = await supabase.from('feedback').insert({
    player_id: currentUserId,
    player_name: whoEl.textContent,
    message,
  });

  feedbackSendBtn.disabled = false;

  if (error) {
    feedbackStatus.textContent = error.message;
    feedbackStatus.className = 'status error';
    return;
  }

  feedbackText.value = '';
  feedbackStatus.textContent = 'Thanks — sent!';
  feedbackStatus.className = 'status success';
  setTimeout(() => { feedbackStatus.textContent = ''; }, 2500);
});

editNameBtn.addEventListener('click', () => {
  displayNameInput.value = whoEl.textContent;
  nameForm.style.display = 'block';
  editNameBtn.style.display = 'none';
  displayNameInput.focus();
});

cancelNameBtn.addEventListener('click', () => {
  nameForm.style.display = 'none';
  editNameBtn.style.display = 'block';
});

nameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newName = displayNameInput.value.trim();
  if (!newName || !currentUserId) return;

  const { error } = await supabase
    .from('players')
    .update({ display_name: newName })
    .eq('id', currentUserId);

  if (error) {
    alert(error.message);
    return;
  }

  whoEl.textContent = newName;
  document.getElementById('hName').textContent = newName;
  nameForm.style.display = 'none';
  editNameBtn.style.display = 'block';
});

commScoresBtn.addEventListener('click', () => { profileOverlay.classList.remove('open'); openScores(); });
commSeasonsBtn.addEventListener('click', () => { profileOverlay.classList.remove('open'); openSeasonsAdmin(); });
closeCommScoresBtn.addEventListener('click', () => document.getElementById('commissionerScoresOverlay').classList.remove('open'));
closeCommSeasonsBtn.addEventListener('click', () => document.getElementById('commissionerSeasonsOverlay').classList.remove('open'));
commScoresSearch.addEventListener('input', renderScores);
commScoresClear.addEventListener('click', () => { commScoresSearch.value = ''; commScoresSearch.focus(); renderScores(); });
document.getElementById('comm-commit-btn').addEventListener('click', commitStandings);

document.querySelectorAll('.nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.s;
    goTab(tab);
    if (tab === 'bracket') goToOwnBracket();
    if (tab === 'standings') renderStandings(currentSession);
    if (tab === 'tournament') renderTournament();
  });
});

const segRbr = document.getElementById('seg-rbr');
const segFull = document.getElementById('seg-full');
const tournamentRbr = document.getElementById('tournament-rbr');
const tournamentFull = document.getElementById('tournament-full');
const toRoundEl = document.getElementById('toRound');
let savedRoundLabel = toRoundEl.textContent;

segRbr.addEventListener('click', () => {
  segRbr.classList.add('on');
  segFull.classList.remove('on');
  tournamentRbr.style.display = 'block';
  tournamentFull.style.display = 'none';
  toRoundEl.textContent = savedRoundLabel;
});
segFull.addEventListener('click', () => {
  segFull.classList.add('on');
  segRbr.classList.remove('on');
  tournamentRbr.style.display = 'none';
  tournamentFull.style.display = 'block';
  savedRoundLabel = toRoundEl.textContent;
  toRoundEl.textContent = 'Full Bracket';
  renderFullBracket();
});

async function showSignedIn(session) {
  const { data: player } = await supabase
    .from('players')
    .select('display_name, is_commissioner')
    .eq('id', session.user.id)
    .single();

  currentSession = session;
  currentUserId = session.user.id;
  const displayName = player?.display_name ?? session.user.email;

  loginScreen.style.display = 'none';
  appShell.style.display = 'flex';
  whoEl.textContent = displayName;
  commissionerLinks.style.display = player?.is_commissioner ? 'block' : 'none';

  await renderBracket(session, displayName);
}

const {
  data: { session },
} = await supabase.auth.getSession();
if (session) showSignedIn(session);

supabase.auth.onAuthStateChange((event, newSession) => {
  if (event === 'SIGNED_IN' && newSession) showSignedIn(newSession);
});
