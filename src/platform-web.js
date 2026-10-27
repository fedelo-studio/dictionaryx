/* Web platform: Supabase keeps the room, the players and their bluffs; Realtime keeps every phone in sync.
   No accounts: each phone gets a random id, each player picks a nickname, each game has a short code. */
const CFG = window.DICTIONARYX_CONFIG || {};
const CODE_RE = /^[A-Z]{4,6}$/;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
// Muted tints that sit on the dark page and keep the initials legible (fg on each is above 7:1).
const AV_COLORS = ['#3B3F5C', '#5A3A47', '#2F5049', '#5C4632', '#47395E', '#2F4B5E', '#535033', '#38503A'];
const web = { sb: null, chan: null, room: roomFromUrl(), notFound: false, ver: 0, presence: { uid: null, ty: null } };
const PLATFORM = { kind: 'web', kick: () => true, menuExtra: close => [['Nouvelle partie', () => { close(); goHome(); }]] };

function platformReady() { return !!(web.sb && web.room); }
function platformName(u) { return data.names[u] || ''; }
function avatarOf(u) { return { color: AV_COLORS[hashStr(String(u)) % AV_COLORS.length], src: '' }; }
function wantProfiles() { /* names come from nicknames */ }
function gateView() {
  if (rt.error === 'config') return html`<${Notice} title="Configuration manquante.">Renseigne SUPABASE_URL et SUPABASE_ANON_KEY puis relance la compilation. Le README explique comment.<//>`;
  if (!web.room) return html`<${Landing}/>`;
  if (web.notFound) return html`<${NotFound}/>`;
  return null;
}

function writeFailed(e) {
  console.warn('Dictionaryx', e);
  toast('Connexion difficile. Réessaie dans un instant.');
  emit();
}
async function ask(p) { const r = await p; if (r.error) throw r.error; return r.data; }

/* ---------- identity ---------- */
function newUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const x = Array.from(b, v => v.toString(16).padStart(2, '0')).join('');
  return x.slice(0, 8) + '-' + x.slice(8, 12) + '-' + x.slice(12, 16) + '-' + x.slice(16, 20) + '-' + x.slice(20);
}
function localId() { let u = lsGet('uid'); if (!u || !/^[0-9a-f-]{36}$/.test(u)) { u = newUuid(); lsSet('uid', u); } return u; }

/* ---------- routing: dictionaryx.app/ABCD ---------- */
function roomFromUrl() {
  const seg = location.pathname.replace(/^\/+|\/+$/g, '').toUpperCase();
  if (CODE_RE.test(seg)) return seg;
  const hs = location.hash.replace(/^#/, '').toUpperCase();
  return CODE_RE.test(hs) ? hs : null;
}
function roomLink(code) { return location.origin + '/' + code; }
function goRoom(code) { try { history.pushState(null, '', '/' + code); } catch (e) { /* ignore */ } openRoom(code); }
function goHome() {
  closeChannel();
  try { history.pushState(null, '', '/'); } catch (e) { /* ignore */ }
  web.room = null; web.notFound = false; data.state = null; data.players = {}; data.subs = {}; data.online = new Set(); data.typing = {};
  emit();
}
window.addEventListener('popstate', () => { const r = roomFromUrl(); if (r === web.room) return; if (r) openRoom(r); else goHome(); });

/* ---------- reads ---------- */
const fetchRoom = code => ask(web.sb.from('rooms').select('code,state,version').eq('code', code).maybeSingle());
const fetchPlayers = code => ask(web.sb.from('players').select('uid,nick,at,gone').eq('room', code));
const fetchSubs = code => ask(web.sb.from('subs').select('uid,rk,def,vote,at').eq('room', code));
function subsMap(rows) { const s = {}; (rows || []).forEach(r => { s[r.uid] = { rk: r.rk, def: r.def, vote: r.vote, at: Number(r.at) }; }); return s; }
function applyPlayers(rows) {
  const p = {}, names = Object.assign({}, data.names);
  (rows || []).forEach(r => { names[r.uid] = r.nick; if (!r.gone) p[r.uid] = { at: Number(r.at), nick: r.nick }; });
  data.players = p; data.names = names; data.loaded.players = true;
}
function applyRoom(row) {
  if (!row || row.code !== web.room || row.version < web.ver) return;
  web.ver = row.version; data.state = row.state; data.loaded.state = true; onState();
}
function applyRow(table, r) {
  if (!r || r.room !== web.room) return;
  if (table === 'players') {
    const p = Object.assign({}, data.players);
    if (r.gone) delete p[r.uid]; else p[r.uid] = { at: Number(r.at), nick: r.nick };
    data.players = p; data.names = Object.assign({}, data.names, { [r.uid]: r.nick });
  } else {
    data.subs = Object.assign({}, data.subs, { [r.uid]: { rk: r.rk, def: r.def, vote: r.vote, at: Number(r.at) } });
  }
  emit(); autoAdvance();
}
async function refresh(code) {
  const [room, players, subs] = await Promise.all([fetchRoom(code), fetchPlayers(code), fetchSubs(code)]);
  if (web.room !== code) return;
  applyPlayers(players); data.subs = subsMap(subs);
  if (room) applyRoom(room); else { emit(); autoAdvance(); }
}

/* ---------- live sync ---------- */
function closeChannel() { if (web.chan) { try { web.sb.removeChannel(web.chan); } catch (e) { /* ignore */ } web.chan = null; } }
function listen(code) {
  closeChannel();
  const ch = web.sb.channel('room:' + code, { config: { presence: { key: rt.me } } });
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: 'code=eq.' + code }, ev => applyRoom(ev.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: 'room=eq.' + code }, ev => applyRow('players', ev.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subs', filter: 'room=eq.' + code }, ev => applyRow('subs', ev.new))
    .on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState(); const on = new Set(), ty = {};
      Object.keys(st).forEach(k => (st[k] || []).forEach(m => { const u = m.uid || k; on.add(u); if (typeof m.ty === 'string') ty[u] = m.ty; }));
      data.online = on; data.typing = ty; emit();
    })
    .subscribe(status => {
      if (status !== 'SUBSCRIBED') return;
      ch.track(web.presence).catch(() => {});
      refresh(code).catch(() => {});
    });
  web.chan = ch;
}
function pushPresence(patch) {
  Object.keys(patch).forEach(k => { if (patch[k] === null) delete web.presence[k]; else web.presence[k] = patch[k]; });
  if (web.chan) web.chan.track(web.presence).catch(() => {});
}
async function openRoom(code) {
  closeChannel();
  web.room = code; web.notFound = false; web.ver = 0;
  data.state = null; data.players = {}; data.subs = {}; data.loaded = { state: false, players: false }; emit();
  try {
    const row = await fetchRoom(code);
    if (web.room !== code) return;
    if (!row) { web.notFound = true; emit(); return; }
    listen(code);
    await refresh(code);
  } catch (e) { writeFailed(e); }
}
async function createRoom() {
  for (let i = 0; i < 8; i++) {
    const r = crypto.getRandomValues(new Uint8Array(4)); let code = '';
    for (let j = 0; j < r.length; j++) code += CODE_ABC[r[j] % CODE_ABC.length];
    const { error } = await web.sb.from('rooms').insert({ code: code, state: freshState(null), version: 1 });
    if (!error) return code;
    if (error.code !== '23505') throw error;
  }
  throw new Error('no free room code');
}

/* Compare and swap on the room's version: the first phone to move the game wins, the others re-read and stand down. */
async function cas(code, mutate) {
  for (let i = 0; i < 5; i++) {
    const row = await fetchRoom(code);
    if (!row) return 'stale';
    const next = mutate(JSON.parse(JSON.stringify(row.state)));
    if (!next) return 'stale';
    const done = await ask(web.sb.from('rooms').update({ state: next, version: row.version + 1, updated_at: new Date().toISOString() }).eq('code', code).eq('version', row.version).select('code,state,version'));
    if (done && done.length) { applyRoom(done[0]); return 'ok'; }
    await sleep(120 + Math.random() * 280);
  }
  return 'busy';
}
async function attempt(name, opt) {
  const code = web.room; if (!code) return 'error';
  try {
    const subs = NEEDS_SUBS[name] ? subsMap(await fetchSubs(code)) : data.subs;
    return await cas(code, cur => {
      if (opt.expect) { for (const f of Object.keys(opt.expect)) if (cur[f] !== opt.expect[f]) return null; }
      const next = TRANS[name](cur, opt.args, subs);
      if (next) next.at = Date.now();
      return next;
    });
  } catch (e) { writeFailed(e); return 'error'; }
}

/* ---------- writes ---------- */
async function upsertPlayer(row) {
  const full = Object.assign({ room: web.room }, row);
  await ask(web.sb.from('players').upsert(full, { onConflict: 'room,uid' }));
  applyRow('players', full);
}
async function joinGame(nick) {
  const n = String(nick || '').trim().slice(0, 24);
  if (!n || !web.room) return false;
  try { await upsertPlayer({ uid: rt.me, nick: n, at: Date.now(), gone: false }); lsSet('nick', n); keepAwake(); return true; }
  catch (e) { writeFailed(e); return false; }
}
async function setGone(u) {
  const p = data.players[u]; if (!p) return;
  await upsertPlayer({ uid: u, nick: p.nick || data.names[u] || 'Joueur', at: p.at || Date.now(), gone: true });
}
async function leaveGame() { try { await setGone(rt.me); toast('Tu as quitté la partie.'); } catch (e) { writeFailed(e); } }
async function removePlayer(u) { const n = nameOf(u); try { await setGone(u); toast(n + ' ne fait plus partie de la partie.'); } catch (e) { writeFailed(e); } }
async function saveNick(v) {
  const n = String(v || '').trim().slice(0, 24); const p = data.players[rt.me];
  if (!n || !p) return false;
  try { await upsertPlayer({ uid: rt.me, nick: n, at: p.at, gone: false }); lsSet('nick', n); return true; } catch (e) { writeFailed(e); return false; }
}
async function saveSub(row) {
  const full = Object.assign({ room: web.room, uid: rt.me }, row);
  await ask(web.sb.from('subs').upsert(full, { onConflict: 'room,uid' }));
  applyRow('subs', full);
}
async function saveDef(text) {
  const S = data.state; if (!S) return false;
  try { await saveSub({ rk: S.rk, def: String(text).trim().slice(0, 400), vote: null, at: Date.now() }); return true; }
  catch (e) { writeFailed(e); return false; }
}
async function castVote(k) {
  const S = data.state; if (!S) return;
  const mine = data.subs[rt.me]; const same = mine && mine.rk === S.rk;
  try { await saveSub({ rk: S.rk, def: same ? mine.def : '', vote: k, at: same ? mine.at : Date.now() }); } catch (e) { writeFailed(e); }
}

async function boot() {
  if (!window.supabase || !CFG.supabaseUrl || !CFG.supabaseAnonKey) { rt.error = 'config'; emit(); return; }
  web.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } });
  rt.me = localId(); web.presence.uid = rt.me;
  const r = roomFromUrl();
  if (r) openRoom(r); else emit();
  setInterval(() => { if (web.room && !web.notFound && document.visibilityState === 'visible') refresh(web.room).catch(() => {}); }, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && web.room && !web.notFound) refresh(web.room).catch(() => {}); });
}

/* ---------- screens before a game ---------- */
function Landing() {
  const [code, setCode] = useState(''); const [busy, run] = useRun();
  const ok = CODE_RE.test(code);
  const create = () => run(async () => { try { goRoom(await createRoom()); } catch (e) { writeFailed(e); } });
  return html`<section class="view">
    <${Masthead}/>
    <div class="block">
      <h2 class="kicker">Nouvelle partie</h2>
      <p class="help">Crée une partie, puis envoie le lien à tes amis. Pas de compte, juste un pseudo, et chacun joue sur son téléphone.</p>
      <${Btn} busy=${busy} onClick=${create}>Créer une partie<//>
    </div>
    <form class="block" onSubmit=${e => { e.preventDefault(); if (ok) goRoom(code); }}>
      <h2 class="kicker">Rejoindre une partie</h2>
      <label class="field"><span>Code de la partie</span>
        <input id="room-code" class="code-input" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="6" placeholder="ABCD" value=${code} onInput=${e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}/>
      </label>
      <${Btn} kind="ghost" type="submit" disabled=${!ok}>Rejoindre<//>
    </form>
  </section>`;
}
function NotFound() {
  return html`<section class="view"><${Masthead}/><div class="banner">
    <p class="help"><strong>Aucune partie ${web.room}.</strong> Vérifie le code, ou crée une nouvelle partie depuis l’accueil.</p>
    <${Btn} onClick=${goHome}>Retour à l’accueil<//>
  </div></section>`;
}
function ReadOnlyNote() { return null; }
function JoinForm() {
  const [nick, setNick] = useState(() => lsGet('nick') || '');
  const [busy, run] = useRun();
  const ok = nick.trim().length > 0;
  return html`<form class="join" onSubmit=${e => { e.preventDefault(); if (ok) run(() => joinGame(nick)); }}>
    <label class="field"><span>Ton pseudo</span>
      <input id="join-nick" type="text" maxlength="24" value=${nick} placeholder="Comment on t’appelle¦?" autocomplete="nickname" onInput=${e => setNick(e.target.value)}/>
    </label>
    <${Btn} type="submit" busy=${busy} disabled=${!ok}>Rejoindre la partie<//>
  </form>`;
}
function Invite() {
  const link = roomLink(web.room);
  const [copied, setCopied] = useState(false);
  const select = () => { try { const el = document.getElementById('room-link'); const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* ignore */ } };
  const copy = () => {
    try { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }, select); }
    catch (e) { select(); }
  };
  const share = () => { try { navigator.share({ title: 'Dictionaryx', text: 'On joue à Dictionaryx¦? Code ' + web.room, url: link }).catch(() => {}); } catch (e) { /* ignore */ } };
  return html`<div class="block">
    <h2 class="kicker">Invite tes amis</h2>
    <div class="code-big" role="img" aria-label=${'Code de la partie ' + web.room}>${web.room.split('').map((c, i) => html`<span key=${i}>${c}</span>`)}</div>
    <p class="help">Ils ouvrent le lien sur leur téléphone, ou tapent ce code sur l’accueil.</p>
    <p class="link-line" id="room-link">${link}</p>
    <div class="row">
      ${navigator.share ? html`<${Btn} onClick=${share}>Partager<//>` : null}
      <${Btn} kind="ghost" onClick=${copy}>${copied ? 'Lien copié' : 'Copier le lien'}<//>
    </div>
  </div>`;
}
