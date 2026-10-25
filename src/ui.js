/* Dictionaryx interface, shared by the Claude artifact and the web version. */
const TIPS = [
  'Les vraies définitions sont sèches et précises. Imite ce ton.',
  'Un détail technique rend un bluff crédible.',
  'Une mention comme «¤vieilli¤» ou «¤marine¤» fait très dictionnaire.',
  'Évite la blague trop visible¤: on vote pour ce qui sonne vrai.'
];
function tipFor(S) {
  const e = bankEntry(S.word); const nat = String((e ? e[3] : S.word && S.word.nat) || '');
  const h2 = hashStr(S.rk || '');
  if (h2 % 2 === 0) {
    if (/^v/.test(nat)) return 'Un verbe se définit par un verbe¤: «¤Faire…¤», «¤Rendre…¤», «¤Se mettre à…¤».';
    if (/^adj/.test(nat)) return 'Un adjectif se définit souvent par «¤Qui…¤» ou «¤Se dit de…¤».';
    if (/^n/.test(nat)) return 'Un nom se définit par un nom¤: «¤Petit…¤», «¤Sorte de…¤», «¤Action de…¤».';
  }
  return TIPS[h2 % TIPS.length];
}
const NATS = ['n. m.', 'n. f.', 'adj.', 'v.', 'adv.', 'loc.'];

const Arrow = () => html`<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11.5M11.2 5.5 15.7 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const Check = () => html`<svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.4 5.6 10.4 11.5 3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const Dots = () => html`<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="4.5" cy="10" r="1.5" fill="currentColor"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/><circle cx="15.5" cy="10" r="1.5" fill="currentColor"/></svg>`;
const Cross = () => html`<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4 4 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

function Btn(props) {
  const kind = props.kind || 'primary';
  return html`<button type=${props.type || 'button'} class=${'btn ' + kind} disabled=${!!(props.disabled || props.busy)} onClick=${props.onClick}>
    <span>${props.busy ? 'Un instant…' : props.children}</span>${kind === 'ghost' ? null : html`<${Arrow}/>`}
  </button>`;
}

function Logo() {
  return html`<span class="logo" role="img" aria-label="Dictionaryx"><span aria-hidden="true">dictionary</span><span class="lx" aria-hidden="true">x</span></span>`;
}

function Avatar({ u, size }) {
  const a = avatarOf(u); const nm = nameOf(u);
  const cls = 'av' + (size ? ' av-' + size : '') + (data.online.has(u) ? ' is-on' : '');
  return html`<span class=${cls} style=${a.color ? '--c:' + a.color : ''} aria-hidden="true">
    ${a.src ? html`<img src=${a.src} alt=""/>` : html`<span>${initials(nm)}</span>`}
  </span>`;
}

function Masthead() {
  return html`<header class="entry masthead">
    <h1 class="hw hw-brand"><span class="mark">dictionary<span class="lx">x</span></span></h1>
    <p class="hw-meta"><span class="ipa">[diksjɔnaʀiks]</span><span class="nat">n. m.</span></p>
    <ol class="senses">
      <li><span>Jeu de bluff où l’on invente la définition de mots que personne ne connaît, puis où chacun tente de démasquer la vraie.</span></li>
      <li><span><em>Par ext.</em> Art de mentir avec l’aplomb d’un académicien.</span></li>
    </ol>
    <p class="xref">→ Voir aussi <span class="sc">bluff</span>, <span class="sc">culot</span>, <span class="sc">mauvaise foi</span>.</p>
  </header>`;
}

function Headword({ S }) {
  const w = S.word || {}; const e = bankEntry(w);
  const word = w.w || '';
  const fem = e ? e[1] : (w.fem || ''); const ipa = e ? e[2] : (w.ipa || ''); const nat = e ? e[3] : (w.nat || '');
  return html`<div class="entry">
    <h1 class="hw" style=${'--len:' + Math.max(7, word.length)}><span class="mark" key=${word}>${word}</span>${fem ? html`<span class="fem">, ${fem}</span>` : null}</h1>
    ${ipa || nat ? html`<p class="hw-meta">${ipa ? html`<span class="ipa">[${ipa}]</span>` : null}${nat ? html`<span class="nat">${nat}</span>` : null}</p>` : null}
  </div>`;
}

function statusOf(u, S) {
  if (!S) return null;
  const live = liveSubs(data.subs, S.rk);
  if (S.phase === 'pick') return u === S.meneur ? { t: 'meneur', c: 'is-lead' } : null;
  if (S.phase === 'write') {
    if (u === S.meneur) return { t: 'meneur', c: 'is-lead' };
    if (hasDef(live[u])) return { t: 'prêt', c: 'is-done', ok: 1 };
    if (data.typing[u] && data.typing[u] === S.rk) return { t: 'écrit…', c: 'is-typing' };
    return { t: 'réfléchit', c: '' };
  }
  if (S.phase === 'vote') {
    if (u === S.meneur) return { t: 'meneur', c: 'is-lead' };
    if (live[u] && live[u].vote) return { t: 'a voté', c: 'is-done', ok: 1 };
    return { t: 'hésite', c: '' };
  }
  if (S.phase === 'reveal') { const p = (S.reveal && S.reveal.pts[u]) || 0; return { t: '+' + p, c: p ? 'is-gain' : '' }; }
  return null;
}

function Strip({ S }) {
  const order = seatsOf(data.players); if (!order.length) return null;
  return html`<div class="strip" role="list" aria-label="Joueurs">${order.map(u => {
    const st = statusOf(u, S);
    return html`<div class=${'chip ' + (st ? st.c : '')} role="listitem" key=${u}>
      <${Avatar} u=${u}/>
      <span>${nameOf(u)}${u === rt.me ? html`<span class="me"> (toi)</span>` : null}</span>
      ${st ? html`<span class="st">${st.ok ? html`<${Check}/>` : null}${st.t}</span>` : null}
      <span class="sc-n">${(S.scores || {})[u] || 0}</span>
    </div>`;
  })}</div>`;
}

function Side({ S }) {
  const order = seatsOf(data.players);
  const inGame = S && S.phase !== 'lobby';
  const ids = inGame ? ranking(S.scores, order).map(r => r.u).filter(u => order.indexOf(u) >= 0) : order;
  return html`<div class="side-in">
    <p class="kicker">Joueurs <span class="count">${order.length}</span></p>
    ${order.length ? html`<ul class="roster">${ids.map(u => {
      const st = statusOf(u, S);
      return html`<li key=${u}><${Avatar} u=${u}/><span class="nm">${nameOf(u)}</span>${u === rt.me ? html`<span class="you">toi</span>` : null}<span class="meta">${st ? st.t : (data.online.has(u) ? 'en ligne' : '')}</span>${inGame ? html`<b class="tot">${(S.scores || {})[u] || 0}</b>` : null}</li>`;
    })}</ul>` : html`<p class="help">Personne pour l’instant.</p>`}
  </div>`;
}

function Top({ S, onMenu }) {
  useTick();
  const inGame = !!(S && S.phase !== 'lobby');
  const live = S && S.word && S.word.w && ['write', 'vote', 'reveal'].indexOf(S.phase) >= 0 ? S.word.w : 'x';
  const letter = live === 'x' ? 'x' : (live.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0) || 'x').toUpperCase();
  const rem = remaining(S); const dur = S && S.dur;
  const frac = rem !== null && dur ? Math.max(0, Math.min(1, rem / dur)) : null;
  return html`<header class=${'top' + (inGame ? ' in-game' : '')}>
    <div class="wrap">
      <span class="thumb" aria-hidden="true">${letter}</span>
      <span class="brand"><${Logo}/></span>
      ${inGame && S.round ? html`<span class="round">Manche ${S.round}</span>` : null}
      <span class="spacer"></span>
      ${rem !== null ? html`<span class=${'clock' + (rem <= 10 ? ' is-low' : '')} role="timer" aria-label=${'Temps restant ' + fmt(rem)}>${fmt(rem)}</span>` : null}
      <button class="icon-btn" type="button" aria-label="Menu" onClick=${onMenu}><${Dots}/></button>
    </div>
    ${frac !== null ? html`<div class=${'tbar' + (rem <= 10 ? ' is-low' : '')} aria-hidden="true"><i style=${'transform:scaleX(' + frac.toFixed(3) + ')'}></i></div>` : null}
  </header>`;
}

function Seg({ label, value, options, onPick }) {
  const id = 'l-' + label.replace(/\W+/g, '');
  return html`<div class="seg"><span class="seg-l" id=${id}>${label}</span>
    <div class="seg-o" role="radiogroup" aria-labelledby=${id}>${options.map(([v, t]) => html`<button type="button" role="radio" key=${String(v)} aria-checked=${value === v ? 'true' : 'false'} class=${value === v ? 'on' : ''} onClick=${() => { if (value !== v) onPick(v); }}>${t}</button>`)}</div>
  </div>`;
}

function Settings({ s: saved }) {
  const [pending, setPending] = useState({});
  const s = Object.assign({}, saved, pending);
  useEffect(() => {
    const left = {}; Object.keys(pending).forEach(k => { if (saved[k] !== pending[k]) left[k] = pending[k]; });
    if (Object.keys(left).length !== Object.keys(pending).length) setPending(left);
  }, [saved.src, saved.target, saved.timer]);
  const set = patch => {
    setPending(p => Object.assign({}, p, patch));
    act('settings', { args: patch, manual: true }).then(r => { if (r !== 'ok') setPending({}); });
  };
  return html`<div class="block">
    <h2 class="kicker">Réglages de la partie</h2>
    <${Seg} label="Les mots" value=${s.src} options=${[['bank', 'Banque du jeu'], ['dict', 'Vrai dictionnaire']]} onPick=${v => set({ src: v })}/>
    <p class="help">${s.src === 'dict'
      ? 'À tour de rôle, un meneur choisit un mot dans un vrai dictionnaire (papier ou en ligne) et recopie sa définition. Il faut au moins deux joueurs.'
      : BANK.length + ' mots rares tirés au hasard. Tout le monde bluffe et vote à chaque manche.'}</p>
    <${Seg} label="Objectif" value=${s.target} options=${[[10, '10 points'], [15, '15 points'], [20, '20 points'], [0, 'Sans limite']]} onPick=${v => set({ target: v })}/>
    <${Seg} label="Temps pour écrire" value=${s.timer} options=${[[0, 'Libre'], [60, '1 min'], [90, '1 min 30'], [120, '2 min']]} onPick=${v => set({ timer: v })}/>
  </div>`;
}

function Lobby({ S, openRules }) {
  const order = seatsOf(data.players);
  const s = (S && S.settings) || { src: 'bank', target: 15, timer: 0 };
  const [busy, run] = useRun();
  const enough = s.src === 'dict' ? order.length >= 2 : order.length >= 1;
  const me = joined();
  return html`<section class="view">
    <${Masthead}/>
    <div class="block">
      <h2 class="kicker">Joueurs <span class="count">${order.length}</span></h2>
      ${order.length
        ? html`<ul class="roster">${order.map(u => html`<li key=${u}><${Avatar} u=${u}/><span class="nm">${nameOf(u)}</span>${u === rt.me ? html`<span class="you">toi</span>` : null}<span class="meta">${data.online.has(u) ? 'en ligne' : ''}</span></li>`)}</ul>`
        : html`<p class="help">Personne n’a encore rejoint la partie. Le premier inscrit lance le jeu.</p>`}
      ${!me ? html`<${JoinForm}/>` : null}
    </div>
    ${me && !rt.readOnly ? html`<${Invite}/>` : null}
    ${me && !rt.readOnly ? html`<${Settings} s=${s}/>` : null}
    ${me && !rt.readOnly ? html`<div class="block">
      <${Btn} busy=${busy} disabled=${!enough} onClick=${() => run(() => act('start', { manual: true }))}>Lancer la partie<//>
      ${!enough ? html`<p class="help">En mode vrai dictionnaire, il faut au moins deux joueurs.</p>`
        : order.length === 1 ? html`<p class="help">Tu es seul pour l’instant¤: parfait pour essayer. Les autres pourront rejoindre en cours de partie.</p>` : null}
      <button class="link" type="button" onClick=${openRules}>Lire les règles</button>
    </div>` : html`<button class="link" type="button" onClick=${openRules}>Lire les règles</button>`}
  </section>`;
}

function Progress({ n, total, label, missing }) {
  const pct = total ? Math.round(100 * n / total) : 0;
  const few = missing && missing.length && missing.length <= 3 && n > 0;
  return html`<div class="progress">
    <div class="prow"><span>${label}¤:</span><b>${n} sur ${total}</b>${few ? html`<span class="wait">On attend ${listNames(missing)}.</span>` : null}</div>
    <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax=${total} aria-valuenow=${n}><i style=${'width:' + pct + '%'}></i></div>
  </div>`;
}

function Force({ label, ask, go }) {
  const [open, setOpen] = useState(false); const [busy, run] = useRun();
  if (!open) return html`<button class="link" type="button" onClick=${() => setOpen(true)}>${label}</button>`;
  return html`<div class="confirm"><p class="help">${ask}</p><div class="row">
    <${Btn} kind="ghost" onClick=${() => setOpen(false)}>Attendre<//>
    <${Btn} busy=${busy} onClick=${() => run(go)}>${label}<//>
  </div></div>`;
}

function JoinBanner() {
  if (rt.readOnly) return html`<${ReadOnlyNote}/>`;
  return html`<div class="banner"><p class="help"><strong>Une partie est en cours.</strong> Rejoins-la¤: tu joues dès maintenant.</p><${JoinForm}/></div>`;
}

function Pick({ S }) {
  const me = rt.me && S.meneur === rt.me;
  if (me && canPlay()) return html`<${PickForm} S=${S}/>`;
  return html`<section class="view">
    <p class="kicker">Manche ${S.round} · vrai dictionnaire</p>
    ${S.note && S.note.t === 'knew' ? html`<p class="notice">${nameOf(S.note.by)} connaissait «¤${S.note.w}¤». Le meneur cherche un autre mot.</p>` : null}
    <div class="waiting"><${Avatar} u=${S.meneur} size="lg"/><p><strong>${nameOf(S.meneur)}</strong> feuillette le dictionnaire à la recherche d’un mot impossible<span class="caret" aria-hidden="true"></span></p></div>
    <p class="help">Prépare ton plus beau bluff¤: dès que le mot tombe, invente une définition crédible.</p>
    ${canPlay() ? html`<${Force} label="Passer à quelqu’un d’autre" ask=${'Confier la main au joueur suivant¦? ' + nameOf(S.meneur) + ' ne sera plus meneur pour cette manche.'} go=${() => act('skip', { expect: { phase: 'pick', rk: S.rk }, manual: true })}/>` : null}
  </section>`;
}

function PickForm({ S }) {
  const [w, setW] = useState(''); const [nat, setNat] = useState('n. m.'); const [def, setDef] = useState('');
  const [busy, run] = useRun();
  const ok = w.trim().length >= 2 && def.trim().length >= 4;
  const submit = e => { e.preventDefault(); if (ok) run(() => act('pick', { expect: { phase: 'pick', rk: S.rk }, args: { w: w.trim(), nat: nat, def: def.trim() }, manual: true })); };
  return html`<form class="view pickform" onSubmit=${submit}>
    <p class="kicker">Manche ${S.round} · tu es le meneur</p>
    <h2 class="title">Trouve un mot que personne ne connaît</h2>
    ${S.note && S.note.t === 'knew' ? html`<p class="notice">${nameOf(S.note.by)} connaissait «¤${S.note.w}¤». Choisis-en un autre.</p>` : null}
    <p class="help">Ouvre un vrai dictionnaire, choisis un mot bien obscur et recopie sa définition telle quelle. Les autres ne la verront qu’au vote, cachée parmi leurs bluffs.</p>
    <label class="field"><span>Le mot</span><input id="pick-word" type="text" maxlength="40" value=${w} autocomplete="off" autocapitalize="none" spellcheck="false" onInput=${e => setW(e.target.value)}/></label>
    <div class="field"><span id="l-nat">Nature</span><div class="seg-o" role="radiogroup" aria-labelledby="l-nat">${NATS.map(n => html`<button type="button" role="radio" key=${n} aria-checked=${nat === n ? 'true' : 'false'} class=${nat === n ? 'on' : ''} onClick=${() => setNat(n)}>${n}</button>`)}</div></div>
    <label class="field"><span>La vraie définition</span><textarea id="pick-def" rows="4" maxlength="400" value=${def} onInput=${e => setDef(e.target.value)}></textarea></label>
    <${Btn} type="submit" busy=${busy} disabled=${!ok}>Proposer ce mot<//>
  </form>`;
}

function DefForm({ S }) {
  const live = liveSubs(data.subs, S.rk); const mine = live[rt.me];
  const sent = hasDef(mine) ? String(mine.def).trim() : '';
  const [txt, setTxt] = useState(() => sent || lsGet('d:' + S.rk) || (HOT.drafts && HOT.drafts[S.rk]) || '');
  const [edit, setEdit] = useState(!sent);
  const [knew, setKnew] = useState(false);
  const [busy, run] = useRun();
  useEffect(() => { DRAFTS[S.rk] = txt; }, [txt]);
  const tip = tipFor(S);
  const len = txt.trim().length;
  const dict = S.settings.src === 'dict';
  const submit = e => {
    e.preventDefault(); if (len < 3) return;
    run(async () => { if (await saveDef(txt)) { setEdit(false); lsSet('d:' + S.rk, ''); setTyping(null); } });
  };
  if (sent && !edit) return html`<div class="defform">
    <p class="kicker">Ton bluff</p>
    <div class="fiche own"><span class="num">·</span><span class="def">${sent}</span></div>
    <p class="help">Envoyé. Tu peux le retoucher jusqu’au vote.</p>
    <button class="link" type="button" onClick=${() => { setTxt(sent); setEdit(true); }}>Modifier mon bluff</button>
  </div>`;
  return html`<form class="defform" onSubmit=${submit}>
    <label class="field"><span>Ton bluff</span>
      <textarea id="def-input" rows="4" maxlength="400" value=${txt} placeholder="Invente une définition qui sent bon le dictionnaire…" onInput=${e => { setTxt(e.target.value); lsSet('d:' + S.rk, e.target.value); typingPing(S.rk); }}></textarea>
    </label>
    <p class="help">${tip}</p>
    <${Btn} type="submit" busy=${busy} disabled=${len < 3}>${sent ? 'Mettre à jour mon bluff' : 'Envoyer mon bluff'}<//>
    ${knew
      ? html`<div class="confirm"><p class="help">${dict ? 'Le meneur devra choisir un autre mot.' : 'Un autre mot sera tiré pour tout le monde.'}</p><div class="row">
          <${Btn} kind="ghost" onClick=${() => setKnew(false)}>Annuler<//>
          <${Btn} onClick=${() => act('knew', { expect: { phase: 'write', rk: S.rk }, manual: true })}>Je le connais<//>
        </div></div>`
      : html`<button class="link" type="button" onClick=${() => setKnew(true)}>Je connais ce mot</button>`}
  </form>`;
}

function Write({ S }) {
  const need = seatsOf(data.players).filter(u => u !== S.meneur);
  const live = liveSubs(data.subs, S.rk);
  const done = need.filter(u => hasDef(live[u])); const missing = need.filter(u => !hasDef(live[u]));
  const lead = rt.me && S.meneur === rt.me;
  return html`<section class="view">
    <${Headword} S=${S}/>
    ${S.note && S.note.t === 'knew' ? html`<p class="notice">${nameOf(S.note.by)} connaissait «¤${S.note.w}¤»¤: on en tire un autre.</p>` : null}
    ${lead ? html`<div class="banner">
        <p class="kicker">Tu es le meneur</p>
        <p class="help">Les autres préparent leurs bluffs. Voici la vraie, celle que tu as recopiée¤:</p>
        <div class="fiche truth"><span class="num">·</span><span class="def">${dec(S.ans)}</span></div>
      </div>`
      : canPlay() ? html`<${DefForm} S=${S} key=${S.rk}/>`
      : html`<p class="help">Les joueurs préparent leurs bluffs.</p>`}
    <${Progress} label="Bluffs reçus" n=${done.length} total=${need.length} missing=${missing}/>
    ${canPlay() && done.length > 0 && missing.length > 0 ? html`<${Force} label="Passer au vote" ask=${'Passer au vote sans attendre ' + listNames(missing) + '¦?'} go=${() => act('vote', { expect: { phase: 'write', rk: S.rk }, manual: true })}/>` : null}
  </section>`;
}

function Vote({ S }) {
  const key = useMemo(() => { try { return JSON.parse(dec(S.key) || '{}'); } catch (e) { return {}; } }, [S.key]);
  const live = liveSubs(data.subs, S.rk); const mine = live[rt.me];
  const lead = rt.me && S.meneur === rt.me;
  const voter = canPlay() && !lead;
  const need = seatsOf(data.players).filter(u => u !== S.meneur);
  const done = need.filter(u => live[u] && live[u].vote); const missing = need.filter(u => !(live[u] && live[u].vote));
  return html`<section class="view">
    <${Headword} S=${S}/>
    <h2 class="q">${lead ? 'Les autres cherchent la vraie définition' : 'Laquelle est la vraie¦?'}</h2>
    <ol class="fiches">${(S.opts || []).map((o, i) => {
      const own = key[o.k] === rt.me; const truth = lead && key[o.k] === '*'; const on = !!(mine && mine.vote === o.k);
      const cls = 'fiche' + (own ? ' own' : '') + (on ? ' on' : '') + (truth ? ' truth' : '');
      return html`<li key=${o.k}><button type="button" class=${cls} style=${'--i:' + i} disabled=${!voter || own} aria-pressed=${on ? 'true' : 'false'} onClick=${() => castVote(o.k)}>
        <span class="num">${i + 1}.</span><span class="def">${o.t}</span>
        ${own ? html`<span class="tag">Ton bluff</span>` : on ? html`<span class="tag">Ton vote</span>` : truth ? html`<span class="tag">La vraie</span>` : null}
      </button></li>`;
    })}</ol>
    ${voter ? html`<p class="help">${mine && mine.vote ? 'Tu peux changer d’avis jusqu’à la révélation.' : 'Démasque les bluffeurs¤: touche la définition que tu crois vraie.'}</p>` : null}
    <${Progress} label="Votes" n=${done.length} total=${need.length} missing=${missing}/>
    ${canPlay() && done.length > 0 && missing.length > 0 ? html`<${Force} label="Révéler maintenant" ask=${'Révéler sans attendre le vote de ' + listNames(missing) + '¦?'} go=${() => act('reveal', { expect: { phase: 'vote', rk: S.rk }, manual: true })}/>` : null}
  </section>`;
}

function RevealCard({ o, i, shown, R }) {
  const truth = o.a === '*';
  const n = o.by.length;
  return html`<div class=${'fiche' + (shown ? (truth ? ' is-true' : ' is-fake') : '')} style=${'--i:' + i}>
    <span class="num">${i + 1}.</span><span class="def">${o.t}</span>
    ${shown ? html`<div class="attr">
      ${truth
        ? html`<span class="stamp is-true">Vrai</span>${R.lab ? html`<span class="lbl">${R.lab}</span>` : null}`
        : html`<span class="stamp is-bluff">Bluff</span><${Avatar} u=${o.a} size="sm"/><span class="lbl">${nameOf(o.a)}</span>`}
      <span class="voters">${n
        ? html`${o.by.map(u => html`<${Avatar} key=${u} u=${u} size="xs"/>`)}<span class="vt">${truth ? (n > 1 ? 'ont trouvé' : 'a trouvé') : (n > 1 ? 'ont mordu' : 'a mordu')}</span>`
        : html`<span>${truth ? 'Personne ne l’a trouvée' : 'Personne n’a mordu'}</span>`}</span>
      ${!truth && n ? html`<span class="pts">+${n * RULES.FOOL}</span>` : truth && n ? html`<span class="pts">+${RULES.FIND} chacun</span>` : null}
    </div>` : null}
  </div>`;
}

function Scores({ rows, pts }) {
  return html`<ol class="scores">${rows.map(r => html`<li key=${r.u} class=${r.r === 1 && r.s > 0 ? 'lead' : ''}>
    <span class="rk">${r.r}</span><${Avatar} u=${r.u}/>
    <span class="nm">${nameOf(r.u)}${r.u === rt.me ? html`<span class="me"> (toi)</span>` : null}</span>
    ${pts && pts[r.u] ? html`<span class="pts">+${pts[r.u]}</span>` : html`<span></span>`}
    <b class="tot">${r.s}</b>
  </li>`)}</ol>`;
}

function verdict(S, R) {
  const finders = R.opts.filter(o => o.a === '*').reduce((a, o) => a.concat(o.by), []);
  const best = bestBluff(R.opts); const out = [];
  if (!R.voted) out.push('Personne n’a voté cette fois.');
  else if (!finders.length) out.push(S.meneur ? 'Personne n’a trouvé¤: ' + nameOf(S.meneur) + ' empoche ' + RULES.LEAD + ' points.' : 'Personne n’a trouvé la vraie définition. Joli travail d’équipe.');
  else out.push(listNames(finders) + (finders.length > 1 ? ' ont flairé' : ' a flairé') + ' la vraie définition.');
  if (best) out.push('Meilleur bluff¤: ' + nameOf(best.a) + ', ' + best.n + ' vote' + (best.n > 1 ? 's' : '') + '.');
  return out.join(' ');
}

function Reveal({ S }) {
  const R = S.reveal || { opts: [], pts: {} };
  const seq = useMemo(() => R.opts.filter(o => o.a !== '*').map(o => o.k).concat(R.opts.filter(o => o.a === '*').map(o => o.k)), [S.rk]);
  const [step, setStep] = useState(() => (reducedMotion() || seenReveal.has(S.rk)) ? seq.length : 0);
  useEffect(() => {
    if (step >= seq.length) { seenReveal.add(S.rk); return undefined; }
    const t = setTimeout(() => setStep(step + 1), step === 0 ? 600 : 1000);
    return () => clearTimeout(t);
  }, [step]);
  const shown = new Set(seq.slice(0, step)); const all = step >= seq.length;
  const rows = ranking(S.scores, seatsOf(data.players));
  const done = reached(S.scores, S.settings.target);
  const [busy, run] = useRun();
  return html`<section class="view">
    <${Headword} S=${S}/>
    <ol class="fiches">${R.opts.map((o, i) => html`<li key=${o.k}><${RevealCard} o=${o} i=${i} shown=${shown.has(o.k)} R=${R}/></li>`)}</ol>
    ${all ? html`<div class="block">
        <p class="verdict">${verdict(S, R)}</p>
        <h2 class="kicker">Classement${S.settings.target ? ' · objectif ' + S.settings.target + ' points' : ''}</h2>
        <${Scores} rows=${rows} pts=${R.pts}/>
        ${canPlay() ? html`<${Btn} busy=${busy} onClick=${() => run(() => act(done ? 'end' : 'next', { expect: { phase: 'reveal', rk: S.rk }, manual: true }))}>${done ? 'Voir le podium' : 'Manche suivante'}<//>` : null}
      </div>`
      : html`<button class="link" type="button" onClick=${() => setStep(seq.length)}>Tout révéler</button>`}
  </section>`;
}

function End({ S }) {
  const rows = ranking(S.scores, seatsOf(data.players));
  const top = rows.filter(r => r.r === 1 && r.s > 0);
  const hist = S.hist || [];
  const [busy, run] = useRun(); const [busy2, run2] = useRun();
  return html`<section class="view">
    <p class="kicker">Fin de partie · ${hist.length} mot${hist.length > 1 ? 's' : ''}</p>
    <h1 class="winner">${top.length ? html`<span class="hl">${listNames(top.map(r => r.u))}</span> ${top.length > 1 ? 'gagnent' : 'gagne'}¦!` : 'Partie terminée'}</h1>
    ${top.length ? html`<p class="sub">avec ${top[0].s} point${top[0].s > 1 ? 's' : ''} de culot</p>` : null}
    ${rows.length ? html`<${Scores} rows=${rows}/>` : null}
    ${hist.length ? html`<div class="block"><h2 class="kicker">Les mots de la partie</h2>
      <dl class="recap">${hist.map(x => html`<div class="rc" key=${x.n + '-' + x.w}><dt>${x.w}</dt><dd>${x.d}${x.b ? html`<span class="best">Meilleur bluff¤: ${nameOf(x.b.a)}, ${x.b.n} vote${x.b.n > 1 ? 's' : ''}</span>` : null}</dd></div>`)}</dl>
    </div>` : null}
    ${canPlay() ? html`<div class="block">
      <${Btn} busy=${busy} onClick=${() => run(() => act('start', { manual: true }))}>Rejouer avec les mêmes joueurs<//>
      <${Btn} kind="ghost" busy=${busy2} onClick=${() => run2(() => act('lobby', { manual: true }))}>Retour au salon<//>
    </div>` : null}
  </section>`;
}

function Rules() {
  return html`<div class="defform">
    <ol class="senses">
      <li><span>Un mot rare tombe sur tous les écrans.</span></li>
      <li><span>Chacun invente en douce une fausse définition, la plus crédible possible.</span></li>
      <li><span>Le jeu mélange vos bluffs avec la vraie. Chacun vote pour celle qu’il croit vraie.</span></li>
      <li><span><strong>+${RULES.FIND}</strong> si tu trouves la vraie, <strong>+${RULES.FOOL}</strong> pour chaque joueur qui mord à ton bluff.</span></li>
      <li><span>Mode vrai dictionnaire¤: à tour de rôle, un meneur choisit un mot dans un dictionnaire et recopie sa définition. Il ne vote pas et empoche <strong>+${RULES.LEAD}</strong> si personne ne trouve.</span></li>
    </ol>
    <p class="help">Tu connais déjà le mot¦? Dis-le avec «¤Je connais ce mot¤»¤: on en tire un autre.</p>
  </div>`;
}

function NickForm({ done }) {
  const cur = (data.players[rt.me] || {}).nick || '';
  const [v, setV] = useState(cur); const [busy, run] = useRun();
  return html`<form class="defform" onSubmit=${e => { e.preventDefault(); run(async () => { if (await saveNick(v)) done(); }); }}>
    <label class="field"><span>Ton pseudo</span><input id="nick-input" type="text" maxlength="24" value=${v} placeholder="Ton pseudo" onInput=${e => setV(e.target.value)}/></label>
    <${Btn} type="submit" busy=${busy}>Enregistrer<//>
  </form>`;
}

function KickList({ done }) {
  const others = seatsOf(data.players).filter(u => u !== rt.me);
  return html`<div class="defform">
    <p class="help">Retire un joueur qui est parti, pour que la partie ne l’attende plus. Ses points restent au classement.</p>
    <ul class="menu">${others.map(u => html`<li key=${u}><button type="button" onClick=${async () => { await removePlayer(u); done(); }}><span>${nameOf(u)}</span><${Cross}/></button></li>`)}</ul>
  </div>`;
}

function Menu({ S, setSheet }) {
  const [ask, setAsk] = useState(null); const [busy, run] = useRun();
  const inGame = S && ['pick', 'write', 'vote', 'reveal'].indexOf(S.phase) >= 0;
  const can = canPlay();
  if (ask === 'end') return html`<div class="confirm"><p class="help">Terminer la partie maintenant¦? Le classement actuel devient le résultat final.</p><div class="row">
    <${Btn} kind="ghost" onClick=${() => setAsk(null)}>Annuler<//><${Btn} busy=${busy} onClick=${() => run(async () => { await act('end', { manual: true }); setSheet(null); })}>Terminer<//></div></div>`;
  if (ask === 'leave') return html`<div class="confirm"><p class="help">Quitter la partie¦? Tes points restent au classement et tu pourras revenir.</p><div class="row">
    <${Btn} kind="ghost" onClick=${() => setAsk(null)}>Annuler<//><${Btn} busy=${busy} onClick=${() => run(async () => { await leaveGame(); setSheet(null); })}>Quitter<//></div></div>`;
  const items = [
    ['Règles du jeu', () => setSheet('rules')],
    can ? ['Changer de pseudo', () => setSheet('nick')] : null,
    can && inGame ? ['Terminer la partie', () => setAsk('end')] : null,
    can && PLATFORM.kick() && seatsOf(data.players).length > 1 ? ['Retirer un joueur', () => setSheet('kick')] : null,
    can ? ['Quitter la partie', () => setAsk('leave'), 'danger'] : null
  ].concat(PLATFORM.menuExtra(() => setSheet(null))).filter(Boolean);
  return html`<ul class="menu">${items.map(it => html`<li key=${it[0]}><button type="button" class=${it[2] || ''} onClick=${it[1]}><span>${it[0]}</span><${Arrow}/></button></li>`)}</ul>`;
}

const SHEET_TITLES = { rules: 'Règles du jeu', nick: 'Pseudo', kick: 'Retirer un joueur', menu: 'Menu' };
function Sheet({ kind, S, setSheet }) {
  const ref = useRef(null);
  const close = () => setSheet(null);
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { const el = ref.current && ref.current.querySelector('input, textarea'); if (el) el.focus(); }, [kind]);
  let body;
  if (kind === 'rules') body = html`<${Rules}/>`;
  else if (kind === 'nick') body = html`<${NickForm} done=${close}/>`;
  else if (kind === 'kick') body = html`<${KickList} done=${close}/>`;
  else body = html`<${Menu} S=${S} setSheet=${setSheet}/>`;
  return html`<div class="veil" onClick=${close}></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${SHEET_TITLES[kind]} ref=${ref}>
      <div class="sheet-h">${kind === 'menu' ? html`<${Logo}/>` : html`<p class="kicker">${SHEET_TITLES[kind]}</p>`}<button class="icon-btn" type="button" aria-label="Fermer" onClick=${close}><${Cross}/></button></div>
      ${body}
    </div>`;
}

function Notice({ title, children }) {
  return html`<section class="view"><${Masthead}/><div class="banner"><p class="help"><strong>${title}</strong> ${children}</p></div></section>`;
}

function App() {
  useData();
  const [sheet, setSheet] = useState(null);
  const S = data.state; const me = joined();
  const gate = gateView();
  let body;
  if (gate) body = gate;
  else if (!data.loaded.state || !data.loaded.players) body = html`<section class="view"><${Masthead}/><p class="help">Connexion à la partie…</p></section>`;
  else if (!S || S.phase === 'lobby') body = html`<${Lobby} S=${S} openRules=${() => setSheet('rules')}/>`;
  else if (S.phase === 'pick') body = html`<${Pick} S=${S}/>`;
  else if (S.phase === 'write') body = html`<${Write} S=${S}/>`;
  else if (S.phase === 'vote') body = html`<${Vote} S=${S}/>`;
  else if (S.phase === 'reveal') body = html`<${Reveal} S=${S}/>`;
  else body = html`<${End} S=${S}/>`;
  const inGame = !gate && S && S.phase !== 'lobby';
  const vkey = gate ? 'gate' : S ? S.phase + ':' + (S.rk || '') : 'none';
  return html`<div class="shell">
    <${Top} S=${gate ? null : S} onMenu=${() => setSheet('menu')}/>
    <div class="wrap">
      ${inGame ? html`<${Strip} S=${S}/>` : null}
      <div class="layout">
        <main class="stage" key=${vkey}>
          ${!gate && !me && inGame && data.loaded.players ? html`<div class="view" style="margin-bottom:22px"><${JoinBanner}/></div>` : null}
          ${body}
        </main>
        <aside class="side" aria-label="Joueurs">${gate ? null : html`<${Side} S=${S}/>`}</aside>
      </div>
    </div>
    ${sheet ? html`<${Sheet} kind=${sheet} S=${gate ? null : S} setSheet=${setSheet}/>` : null}
    <div class="toasts" aria-live="polite">${toasts.map(t => html`<div class="toast" key=${t.id}>${t.t}</div>`)}</div>
  </div>`;
}
