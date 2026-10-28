/* Dictionaryx core: game rules, shared state and automatic progress.
   A platform file (Claude artifact or web with Supabase) provides storage, identity and presence. */
const { h, render } = window.preact;
const { useState, useEffect, useRef, useMemo } = window.preactHooks;
const html = window.htm.bind(h);

/* Word bank: [headword, feminine ending, phonetics, nature, register label, encoded definition]. */
const BANK = /*BANK*/[];
const BY_WORD = new Map(BANK.map((e, i) => [e[0], i]));

/*LOGIC-START*/
const RULES = { FIND: 2, FOOL: 1, LEAD: 3 };
const VOTE_TIME = { 60: 30, 90: 45, 120: 60 };

function enc(s) {
  const b = new TextEncoder().encode(String(s)); let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).split('').reverse().join('');
}
function dec(s) {
  try {
    const bin = atob(String(s || '').split('').reverse().join(''));
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(b);
  } catch (e) { return ''; }
}
function rid(n) {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(n || 6)); let s = '';
  for (let i = 0; i < r.length; i++) s += a[r[i] % a.length];
  return s;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function seatsOf(players) {
  return Object.keys(players || {}).filter(u => players[u]).sort((a, b) => ((players[a].at || 0) - (players[b].at || 0)) || (a < b ? -1 : a > b ? 1 : 0));
}
function drawIndex(len, used) {
  const u = new Set(used || []); const pool = [];
  for (let i = 0; i < len; i++) if (!u.has(i)) pool.push(i);
  const from = pool.length ? pool : Array.from({ length: len }, (_, i) => i);
  return from[Math.floor(Math.random() * from.length)];
}
function nextLead(order, prev, round) {
  if (!order.length) return null;
  const i = order.indexOf(prev);
  if (i >= 0) return order[(i + 1) % order.length];
  return order[(Math.max(1, round || 1) - 1) % order.length];
}
function liveSubs(subs, rk) {
  const out = {}; if (!rk) return out;
  for (const u of Object.keys(subs || {})) { const s = subs[u]; if (s && s.rk === rk) out[u] = s; }
  return out;
}
function hasDef(s) { return !!(s && String(s.def || '').trim()); }
function bankWord(i) { const e = BANK[i]; return e ? { i: i, w: e[0], fem: e[1], ipa: e[2], nat: e[3] } : null; }
function bankEntry(word) {
  if (!word || !word.w) return null;
  const i = BY_WORD.has(word.w) ? BY_WORD.get(word.w) : word.i;
  const e = BANK[i];
  return e && e[0] === word.w ? e : null;
}
function trueDefOf(S) { if (S.ans) return dec(S.ans); const e = bankEntry(S.word); return e ? dec(e[5]) : ''; }
function labelOf(S) { if (S.ans) return ''; const e = bankEntry(S.word); return e ? e[4] : ''; }
function deadlineFor(sec) { return sec ? Date.now() + sec * 1000 : null; }

function freshState(prev) {
  return {
    v: 1, phase: 'lobby',
    settings: Object.assign({ src: 'bank', target: 15, timer: 0 }, prev && prev.settings),
    g: rid(8), round: 0, rk: null, meneur: null, word: null, ans: null,
    used: (prev && prev.used) || [], figs: (prev && prev.figs) || {}, deadline: null, dur: 0,
    opts: null, key: null, reveal: null, scores: {}, hist: [], note: null
  };
}
function startRound(cur, order) {
  const round = (cur.round || 0) + 1;
  const base = Object.assign({}, cur, { round: round, rk: round + '-' + rid(4), opts: null, key: null, reveal: null, note: null, ans: null, word: null, deadline: null, dur: 0 });
  if (cur.settings.src === 'dict') return Object.assign(base, { phase: 'pick', meneur: nextLead(order, cur.meneur, round) });
  const i = drawIndex(BANK.length, cur.used);
  const t = cur.settings.timer || 0;
  return Object.assign(base, { phase: 'write', meneur: null, word: bankWord(i), used: (cur.used || []).concat(i).slice(-BANK.length), deadline: deadlineFor(t), dur: t });
}
function pickWord(cur, me, a) {
  if (!cur || cur.phase !== 'pick' || cur.meneur !== me || !a) return null;
  const w = String(a.w || '').trim().slice(0, 40); const def = String(a.def || '').trim().slice(0, 400);
  if (w.length < 2 || def.length < 4) return null;
  const t = cur.settings.timer || 0;
  return Object.assign({}, cur, { phase: 'write', word: { w: w, fem: '', ipa: '', nat: String(a.nat || '') }, ans: enc(def), note: null, deadline: deadlineFor(t), dur: t });
}
function knewWord(cur, me) {
  if (!cur || cur.phase !== 'write' || (cur.meneur && cur.meneur === me)) return null;
  const note = { t: 'knew', by: me, w: cur.word ? cur.word.w : '', at: Date.now() };
  const rk = cur.round + '-' + rid(4);
  if (cur.settings.src === 'dict' || cur.ans) return Object.assign({}, cur, { phase: 'pick', rk: rk, word: null, ans: null, deadline: null, dur: 0, note: note });
  const i = drawIndex(BANK.length, cur.used); const t = cur.settings.timer || 0;
  return Object.assign({}, cur, { rk: rk, word: bankWord(i), used: (cur.used || []).concat(i).slice(-BANK.length), deadline: deadlineFor(t), dur: t, note: note });
}
function skipLead(cur, order) {
  if (!cur || cur.phase !== 'pick' || order.length < 2) return null;
  return Object.assign({}, cur, { meneur: nextLead(order, cur.meneur, cur.round), rk: cur.round + '-' + rid(4), note: { t: 'skip', by: cur.meneur, at: Date.now() } });
}
function buildVote(cur, subs) {
  const live = liveSubs(subs, cur.rk); const items = [];
  for (const u of Object.keys(live)) {
    if (u === cur.meneur || !hasDef(live[u])) continue;
    items.push({ a: u, t: String(live[u].def).trim().slice(0, 400) });
  }
  const fakes = items.length;
  items.push({ a: '*', t: trueDefOf(cur) });
  const opts = [], key = {}, seen = new Set();
  for (const it of shuffle(items)) {
    let k; do { k = rid(5); } while (seen.has(k));
    seen.add(k); opts.push({ k: k, t: it.t }); key[k] = it.a;
  }
  return { opts: opts, key: key, fakes: fakes };
}
function tally(opts, key, subs, rk, lead) {
  const live = liveSubs(subs, rk); const pts = {}, by = {}; let found = 0, voted = 0;
  for (const u of Object.keys(live)) {
    const v = live[u].vote;
    if (u === lead || !v || !Object.prototype.hasOwnProperty.call(key, v)) continue;
    const a = key[v]; if (a === u) continue;
    voted++; (by[v] = by[v] || []).push(u);
    if (a === '*') { found++; pts[u] = (pts[u] || 0) + RULES.FIND; }
    else pts[a] = (pts[a] || 0) + RULES.FOOL;
  }
  if (lead && voted > 0 && found === 0) pts[lead] = (pts[lead] || 0) + RULES.LEAD;
  return { pts: pts, found: found, voted: voted, opts: opts.map(o => ({ k: o.k, t: o.t, a: key[o.k], by: by[o.k] || [] })) };
}
function addScores(scores, pts) { const s = Object.assign({}, scores); for (const u of Object.keys(pts)) s[u] = (s[u] || 0) + pts[u]; return s; }
function bestBluff(opts) { let b = null; for (const o of opts) if (o.a !== '*' && o.by.length && (!b || o.by.length > b.n)) b = { a: o.a, n: o.by.length }; return b; }
function toReveal(cur, subs) {
  if (!cur || cur.phase !== 'vote') return null;
  let key = {}; try { key = JSON.parse(dec(cur.key) || '{}'); } catch (e) { key = {}; }
  const r = tally(cur.opts || [], key, subs, cur.rk, cur.meneur);
  const def = trueDefOf(cur);
  const hist = (cur.hist || []).concat([{ n: cur.round, w: cur.word ? cur.word.w : '', d: def, b: bestBluff(r.opts), m: cur.meneur || null }]).slice(-60);
  return Object.assign({}, cur, { phase: 'reveal', reveal: { opts: r.opts, pts: r.pts, found: r.found, voted: r.voted, def: def, lab: labelOf(cur) }, scores: addScores(cur.scores, r.pts), hist: hist, deadline: null, dur: 0, note: null });
}
function toVote(cur, subs) {
  if (!cur || cur.phase !== 'write') return null;
  const v = buildVote(cur, subs);
  const next = Object.assign({}, cur, { phase: 'vote', opts: v.opts, key: enc(JSON.stringify(v.key)), note: null });
  if (!v.fakes) return toReveal(next, subs);
  const t = cur.settings.timer ? (VOTE_TIME[cur.settings.timer] || 45) : 0;
  return Object.assign(next, { deadline: deadlineFor(t), dur: t });
}
function reached(scores, target) { return !!target && Object.keys(scores || {}).some(u => scores[u] >= target); }
function ranking(scores, order) {
  const ids = new Set(order); Object.keys(scores || {}).forEach(u => ids.add(u));
  const pos = u => { const j = order.indexOf(u); return j < 0 ? 1e9 : j; };
  const rows = Array.from(ids).map(u => ({ u: u, s: (scores || {})[u] || 0 })).sort((a, b) => (b.s - a.s) || (pos(a.u) - pos(b.u)));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.s !== prev) { rank = i + 1; prev = r.s; } r.r = rank; });
  return rows;
}
/*LOGIC-END*/

/* ---------- shared state ---------- */
const rt = { me: null, tab: rid(6), readOnly: false, revoked: false, error: null, isOwner: false, canEdit: false };
const data = { state: null, players: {}, subs: {}, profiles: {}, names: {}, online: new Set(), typing: {}, loaded: { state: false, players: false } };
const listeners = new Set();
const tickers = new Set();
const toasts = [];
const DRAFTS = {};
const seenReveal = new Set();
let HOT = {};
let toastId = 0;

function emit() { listeners.forEach(f => f()); }
function useData() { const [, set] = useState(0); useEffect(() => { const f = () => set(x => x + 1); listeners.add(f); return () => listeners.delete(f); }, []); }
function useTick() { const [, set] = useState(0); useEffect(() => { const f = () => set(x => x + 1); tickers.add(f); return () => tickers.delete(f); }, []); }
function useRun() {
  const [busy, setBusy] = useState(false);
  const run = async fn => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return [busy, run];
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toast(t) {
  const id = ++toastId; toasts.push({ id: id, t: t }); emit();
  setTimeout(() => { const i = toasts.findIndex(x => x.id === id); if (i >= 0) { toasts.splice(i, 1); emit(); } }, 4000);
}
function lsGet(k) { try { return localStorage.getItem('dicox:' + k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v) localStorage.setItem('dicox:' + k, v); else localStorage.removeItem('dicox:' + k); } catch (e) { /* storage unavailable */ } }
function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
function buzz() { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* not allowed here */ } }
function hashStr(s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); }
function remaining(S) { return S && S.deadline ? Math.max(0, Math.ceil((S.deadline - Date.now()) / 1000)) : null; }
function fmt(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); }
function joined() { return !!(rt.me && data.players[rt.me]); }
function canPlay() { return joined() && !rt.readOnly && !rt.revoked; }

/* Names: a player's nickname, else what the platform knows about them */
function firstName(full) { return String(full || '').trim().split(/\s+/)[0] || ''; }
function nameOf(u) {
  if (!u) return 'Quelqu’un';
  const p = data.players[u]; if (p && p.nick) return p.nick;
  const n = platformName(u); if (n) return n;
  const i = seatsOf(data.players).indexOf(u);
  return i >= 0 ? 'Joueur ' + (i + 1) : 'Ancien joueur';
}
function listNames(ids) { const n = ids.map(nameOf); if (n.length <= 1) return n[0] || ''; return n.slice(0, -1).join(', ') + ' et ' + n[n.length - 1]; }
function initials(n) { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }

/* ---------- game moves ---------- */
const TRANS = {
  create: cur => cur ? null : freshState(null),
  settings: (cur, a) => { const base = cur || freshState(null); if (base.phase !== 'lobby' && base.phase !== 'end') return null; return Object.assign({}, base, { settings: Object.assign({}, base.settings, a) }); },
  start: cur => {
    const base = cur || freshState(null);
    if (base.phase !== 'lobby' && base.phase !== 'end') return null;
    const order = seatsOf(data.players);
    if (!order.length || (base.settings.src === 'dict' && order.length < 2)) return null;
    return startRound(Object.assign({}, base, { g: rid(8), round: 0, scores: {}, hist: [], meneur: null }), order);
  },
  next: cur => cur && cur.phase === 'reveal' ? startRound(cur, seatsOf(data.players)) : null,
  pick: (cur, a) => pickWord(cur, rt.me, a),
  knew: cur => knewWord(cur, rt.me),
  skip: cur => skipLead(cur, seatsOf(data.players)),
  vote: (cur, a, subs) => toVote(cur, subs),
  reveal: (cur, a, subs) => toReveal(cur, subs),
  end: cur => cur && ['pick', 'write', 'vote', 'reveal'].indexOf(cur.phase) >= 0 ? Object.assign({}, cur, { phase: 'end', deadline: null, dur: 0, note: null }) : null,
  lobby: cur => cur ? freshState(cur) : null,
  /* the figurine a player sits behind (the 3D table); any phase, one word of a few letters */
  fig: (cur, a) => cur && /^[a-z]{2,12}$/.test(String(a)) && (cur.figs || {})[rt.me] !== a ? Object.assign({}, cur, { figs: Object.assign({}, cur.figs, { [rt.me]: a }) }) : null
};
const NEEDS_SUBS = { vote: 1, reveal: 1 };

const inflight = new Set();
let chain = Promise.resolve();
async function runAct(name, opt) {
  const tries = opt.manual ? 6 : 1;
  for (let n = 0; n < tries; n++) {
    const res = await attempt(name, opt);
    if (res !== 'busy') return res;
    await sleep(650 + Math.random() * 500);
  }
  if (opt.manual) toast('Un autre joueur modifie la partie. Réessaie.');
  return 'busy';
}
/* Taps run one after another, so a quick second tap is never lost; automatic moves are skipped when one is already running. */
async function act(name, opt) {
  opt = opt || {};
  if (!rt.me || rt.readOnly || !platformReady()) return 'error';
  if (opt.manual) { const p = chain.then(() => runAct(name, opt)); chain = p.catch(() => {}); return p; }
  const tag = name + '|' + (opt.expect && opt.expect.rk || '');
  if (inflight.has(tag)) return 'busy';
  inflight.add(tag);
  try { return await runAct(name, opt); } finally { inflight.delete(tag); }
}

/* ---------- live typing indicator ---------- */
let typingRk = null, typingT = null;
function setTyping(rk) { if (typingRk === rk) return; typingRk = rk; pushPresence({ ty: rk || null }); }
function typingPing(rk) { setTyping(rk); clearTimeout(typingT); typingT = setTimeout(() => setTyping(null), 2500); }

/* ---------- screen stays awake during a game ---------- */
let wake = null;
async function keepAwake() {
  try {
    if (wake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    wake = await navigator.wakeLock.request('screen');
    wake.addEventListener('release', () => { wake = null; });
  } catch (e) { wake = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && joined()) keepAwake(); });

/* ---------- automatic progress: everyone has written, everyone has voted, or time is up ---------- */
let autoT = null, lastAuto = 0;
const lastDue = {};
function autoAdvance() {
  clearTimeout(autoT);
  const S = data.state; if (!S || !canPlay()) return;
  const need = seatsOf(data.players).filter(u => u !== S.meneur); if (!need.length) return;
  const live = liveSubs(data.subs, S.rk);
  if (S.phase === 'write' && need.every(u => hasDef(live[u]))) autoT = setTimeout(() => act('vote', { expect: { phase: 'write', rk: S.rk } }), 900);
  else if (S.phase === 'vote' && need.every(u => live[u] && live[u].vote)) autoT = setTimeout(() => act('reveal', { expect: { phase: 'vote', rk: S.rk } }), 700);
}
setInterval(() => {
  tickers.forEach(f => f());
  const S = data.state; if (!S || !canPlay()) return;
  if (S.deadline && Date.now() > S.deadline + 700 && (S.phase === 'write' || S.phase === 'vote')) {
    const k = S.rk + S.phase;
    if (Date.now() - (lastDue[k] || 0) > 3500) { lastDue[k] = Date.now(); act(S.phase === 'write' ? 'vote' : 'reveal', { expect: { phase: S.phase, rk: S.rk } }); }
  }
  if (Date.now() - lastAuto > 3000) { lastAuto = Date.now(); autoAdvance(); }
}, 1000);

let lastKey = null;
function onState() {
  const S = data.state; const k = S ? S.phase + ':' + (S.rk || '') : 'none';
  if (lastKey !== null && k !== lastKey && S) {
    buzz();
    const a = document.activeElement;
    if (!(a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT'))) { try { window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ } }
  }
  lastKey = k;
  wantProfiles(); emit(); autoAdvance();
}
