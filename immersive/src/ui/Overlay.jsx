// What sits over the 3D table: the top bar, and one panel per phase for what needs typing or choosing.
import { useEffect, useState } from 'react'
import { E, fr, statusOf, tipFor, useRun, useTick, wordOf } from '../engine.js'

const NATS = ['n. m.', 'n. f.', 'adj.', 'v.', 'adv.', 'loc.']

/* ---------- small parts ---------- */
const Mark = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 136 136" aria-hidden="true">
    <path
      d="M21.27 136c2.27 0 4.1-1.85 4.31-4.11 1.94-20.2 17.99-36.26 38.19-38.19 2.26-.22 4.11-2.04 4.11-4.31V72.11c0-2.27-1.85-4.13-4.12-4C29.46 70.17 2.05 97.58.01 131.87-.13 134.14 1.73 136 4 136h17.27ZM134.1 0c.98 0 1.78.8 1.78 1.78 0 13.1-10.62 23.72-23.72 23.72H42.38c-8 0-14.68 5.5-16.5 12.92-.54 2.2-2.34 4.08-4.61 4.08H4c-2.27 0-4.14-1.85-3.92-4.11C2.14 16.83 20.28 0 42.38 0h91.72Z"
      fill="currentColor"
    />
    <circle cx="118.89" cy="119" r="17" fill="#FF4A1C" />
  </svg>
)
const Arrow = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 10h11.5M11.2 5.5 15.7 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function Btn({ kind = 'primary', busy, disabled, onClick, type = 'button', children }) {
  return (
    <button type={type} className={'btn ' + kind} disabled={!!(disabled || busy)} onClick={onClick}>
      <span>{busy ? 'Un instant…' : children}</span>
      {kind === 'primary' ? <Arrow /> : null}
    </button>
  )
}

function Seg({ label, value, options, onPick }) {
  return (
    <div className="seg">
      <span className="label">{label}</span>
      <div className="seg-o" role="radiogroup" aria-label={label}>
        {options.map(([v, t]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => value !== v && onPick(v)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

function Progress({ n, total, label, missing }) {
  const few = missing && missing.length && missing.length <= 3 && n > 0
  return (
    <div className="progress">
      <div className="prow">
        <span>{fr(label + ' :')}</span>
        <b>{n} sur {total}</b>
        {few ? <span className="wait">On attend {E.listNames(missing)}.</span> : null}
      </div>
      <div className="meter"><i style={{ width: (total ? Math.round((100 * n) / total) : 0) + '%' }} /></div>
    </div>
  )
}

function Force({ label, ask, go }) {
  const [open, setOpen] = useState(false)
  const [busy, run] = useRun()
  if (!open) return <button className="link" type="button" onClick={() => setOpen(true)}>{label}</button>
  return (
    <div className="confirm">
      <p className="help">{fr(ask)}</p>
      <div className="row">
        <Btn kind="ghost" onClick={() => setOpen(false)}>Attendre</Btn>
        <Btn busy={busy} onClick={() => run(go)}>{label}</Btn>
      </div>
    </div>
  )
}

/* ---------- top bar ---------- */
function Top({ S, onMenu }) {
  useTick()
  const inGame = !!(S && S.phase !== 'lobby')
  const rem = E.remaining(S)
  const frac = rem !== null && S && S.dur ? Math.max(0, Math.min(1, rem / S.dur)) : null
  return (
    <header className={'top' + (inGame ? ' in-game' : '')}>
      <a className="logo" href="/" onClick={e => { e.preventDefault(); E.goHome() }} aria-label="Dictionaryx, un jeu fedelo.studio">
        <Mark />
        <span className="logo-word">dictionary<span className="lx">x</span></span>
      </a>
      {inGame && S.round ? <span className="round">Manche {S.round}</span> : null}
      <span className="spacer" />
      {rem !== null ? <span className={'clock' + (rem <= 10 ? ' is-low' : '')} role="timer">{E.fmt(rem)}</span> : null}
      <button className="icon-btn" type="button" aria-label="Menu" onClick={onMenu}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="4.5" cy="10" r="1.5" fill="currentColor" /><circle cx="10" cy="10" r="1.5" fill="currentColor" /><circle cx="15.5" cy="10" r="1.5" fill="currentColor" /></svg>
      </button>
      {frac !== null ? <div className={'tbar' + (rem <= 10 ? ' is-low' : '')}><i style={{ transform: `scaleX(${frac.toFixed(3)})` }} /></div> : null}
    </header>
  )
}

/* ---------- before a game ---------- */
function Landing() {
  const [code, setCode] = useState('')
  const [busy, run] = useRun()
  const ok = E.CODE_RE.test(code)
  return (
    <>
      <p className="lede">{fr('Invente la définition de mots que personne ne connaît, puis démasque la vraie. Chacun sur son téléphone, autour de la même table.')}</p>
      <Btn busy={busy} onClick={() => run(async () => { try { E.goRoom(await E.createRoom()) } catch (e) { E.writeFailed(e) } })}>Créer une partie</Btn>
      <form className="join-code" onSubmit={e => { e.preventDefault(); if (ok) E.goRoom(code) }}>
        <label className="field">
          <span>Ou rejoins avec un code</span>
          <input className="code-input" value={code} maxLength={6} placeholder="ABCD" autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
        </label>
        <Btn kind="ghost" type="submit" disabled={!ok}>Rejoindre</Btn>
      </form>
    </>
  )
}

function JoinForm() {
  const [nick, setNick] = useState(() => E.lsGet('nick') || '')
  const [busy, run] = useRun()
  const ok = nick.trim().length > 0
  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (ok) run(() => E.joinGame(nick)) }}>
      <label className="field">
        <span>Ton pseudo</span>
        <input value={nick} maxLength={24} placeholder={fr('Comment on t’appelle ?')} autoComplete="nickname" onChange={e => setNick(e.target.value)} />
      </label>
      <Btn type="submit" busy={busy} disabled={!ok}>Prendre place à la table</Btn>
    </form>
  )
}

function Invite() {
  const link = E.roomLink(E.web.room)
  const [copied, setCopied] = useState(false)
  const copy = () => {
    try { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }) } catch { /* ignore */ }
  }
  const share = () => { try { navigator.share({ title: 'Dictionaryx', text: fr('On joue à Dictionaryx ? Code ') + E.web.room, url: link }).catch(() => {}) } catch { /* ignore */ } }
  return (
    <div className="stack">
      <span className="kicker">Invite tes amis</span>
      <div className="code-big" aria-label={'Code ' + E.web.room}>{E.web.room.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
      <p className="link-line">{link}</p>
      <div className="row">
        {navigator.share ? <Btn onClick={share}>Partager</Btn> : null}
        <Btn kind="ghost" onClick={copy}>{copied ? 'Lien copié' : 'Copier le lien'}</Btn>
      </div>
    </div>
  )
}

function Lobby({ S }) {
  const order = E.seatsOf(E.data.players)
  const s = (S && S.settings) || { src: 'bank', target: 15, timer: 0 }
  const [pending, setPending] = useState({})
  const cur = { ...s, ...pending }
  const [busy, run] = useRun()
  const enough = cur.src === 'dict' ? order.length >= 2 : order.length >= 1
  const set = patch => {
    setPending(p => ({ ...p, ...patch }))
    E.act('settings', { args: patch, manual: true }).then(() => setPending({}))
  }
  if (!E.joined()) return <JoinForm />
  return (
    <>
      <Invite />
      <div className="stack">
        <span className="kicker">Réglages</span>
        <Seg label="Les mots" value={cur.src} options={[['bank', 'Banque du jeu'], ['dict', 'Vrai dictionnaire']]} onPick={v => set({ src: v })} />
        <Seg label="Objectif" value={cur.target} options={[[10, '10 pts'], [15, '15 pts'], [20, '20 pts'], [0, 'Sans limite']]} onPick={v => set({ target: v })} />
        <Seg label="Temps pour écrire" value={cur.timer} options={[[0, 'Libre'], [60, '1 min'], [90, '1 min 30'], [120, '2 min']]} onPick={v => set({ timer: v })} />
      </div>
      <Btn busy={busy} disabled={!enough} onClick={() => run(() => E.act('start', { manual: true }))}>Lancer la partie</Btn>
      {!enough ? <p className="help">En mode vrai dictionnaire, il faut au moins deux joueurs.</p> : order.length === 1 ? <p className="help">{fr('Tu es seul pour l’instant : parfait pour essayer.')}</p> : null}
    </>
  )
}

/* ---------- a round ---------- */
function PickForm({ S }) {
  const [w, setW] = useState('')
  const [nat, setNat] = useState('n. m.')
  const [def, setDef] = useState('')
  const [busy, run] = useRun()
  const ok = w.trim().length >= 2 && def.trim().length >= 4
  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (ok) run(() => E.act('pick', { expect: { phase: 'pick', rk: S.rk }, args: { w: w.trim(), nat, def: def.trim() }, manual: true })) }}>
      <span className="kicker">Tu es le meneur</span>
      <p className="help">Choisis un mot obscur dans un vrai dictionnaire et recopie sa définition.</p>
      <label className="field"><span>Le mot</span><input value={w} maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={e => setW(e.target.value)} /></label>
      <Seg label="Nature" value={nat} options={NATS.map(n => [n, n])} onPick={setNat} />
      <label className="field"><span>La vraie définition</span><textarea rows={3} maxLength={400} value={def} onChange={e => setDef(e.target.value)} /></label>
      <Btn type="submit" busy={busy} disabled={!ok}>Proposer ce mot</Btn>
    </form>
  )
}

function Pick({ S }) {
  if (E.rt.me && S.meneur === E.rt.me && E.canPlay()) return <PickForm S={S} />
  return (
    <>
      <p className="lede"><strong>{E.nameOf(S.meneur)}</strong> feuillette le dictionnaire à la recherche d’un mot impossible<span className="caret" /></p>
      {E.canPlay() ? <Force label="Passer à quelqu’un d’autre" ask={'Confier la main au joueur suivant ?'} go={() => E.act('skip', { expect: { phase: 'pick', rk: S.rk }, manual: true })} /> : null}
    </>
  )
}

function DefForm({ S }) {
  const live = E.liveSubs(E.data.subs, S.rk)
  const mine = live[E.rt.me]
  const sent = E.hasDef(mine) ? String(mine.def).trim() : ''
  const [txt, setTxt] = useState(() => sent || E.lsGet('d:' + S.rk) || '')
  const [edit, setEdit] = useState(!sent)
  const [knew, setKnew] = useState(false)
  const [busy, run] = useRun()
  const len = txt.trim().length
  if (sent && !edit) {
    return (
      <div className="stack">
        <span className="kicker">Ton bluff est sur la table</span>
        <p className="quote">{sent}</p>
        <button className="link" type="button" onClick={() => { setTxt(sent); setEdit(true) }}>Le retoucher</button>
      </div>
    )
  }
  return (
    <form className="stack" onSubmit={e => {
      e.preventDefault()
      if (len < 3) return
      run(async () => { if (await E.saveDef(txt)) { setEdit(false); E.lsSet('d:' + S.rk, ''); E.setTyping(null) } })
    }}>
      <label className="field">
        <span>Ton bluff</span>
        <textarea rows={3} maxLength={400} value={txt} placeholder="Invente une définition qui sent bon le dictionnaire…" onChange={e => { setTxt(e.target.value); E.lsSet('d:' + S.rk, e.target.value); E.typingPing(S.rk) }} />
      </label>
      <p className="help">{tipFor(S)}</p>
      <Btn type="submit" busy={busy} disabled={len < 3}>{sent ? 'Mettre à jour' : 'Poser mon bluff sur la table'}</Btn>
      {knew ? (
        <div className="confirm">
          <p className="help">{S.settings.src === 'dict' ? 'Le meneur devra choisir un autre mot.' : 'Un autre mot sera tiré pour tout le monde.'}</p>
          <div className="row">
            <Btn kind="ghost" onClick={() => setKnew(false)}>Annuler</Btn>
            <Btn onClick={() => E.act('knew', { expect: { phase: 'write', rk: S.rk }, manual: true })}>Je le connais</Btn>
          </div>
        </div>
      ) : (
        <button className="link" type="button" onClick={() => setKnew(true)}>Je connais ce mot</button>
      )}
    </form>
  )
}

function Write({ S }) {
  const need = E.seatsOf(E.data.players).filter(u => u !== S.meneur)
  const live = E.liveSubs(E.data.subs, S.rk)
  const done = need.filter(u => E.hasDef(live[u]))
  const missing = need.filter(u => !E.hasDef(live[u]))
  const lead = E.rt.me && S.meneur === E.rt.me
  const w = wordOf(S)
  return (
    <>
      {w.ipa ? <p className="ipa">[{w.ipa}]</p> : null}
      {lead ? (
        <div className="stack">
          <span className="kicker">Tu es le meneur, voici la vraie</span>
          <p className="quote">{E.dec(S.ans)}</p>
        </div>
      ) : E.canPlay() ? <DefForm S={S} key={S.rk} /> : <JoinForm />}
      <Progress label="Bluffs posés" n={done.length} total={need.length} missing={missing} />
      {E.canPlay() && done.length > 0 && missing.length > 0 ? <Force label="Passer au vote" ask={'Passer au vote sans attendre ' + E.listNames(missing) + ' ?'} go={() => E.act('vote', { expect: { phase: 'write', rk: S.rk }, manual: true })} /> : null}
    </>
  )
}

function Vote({ S, view, focus, setFocus }) {
  const live = E.liveSubs(E.data.subs, S.rk)
  const mine = live[E.rt.me]
  const lead = E.rt.me && S.meneur === E.rt.me
  const voter = E.canPlay() && !lead
  const need = E.seatsOf(E.data.players).filter(u => u !== S.meneur)
  const done = need.filter(u => live[u] && live[u].vote)
  const missing = need.filter(u => !(live[u] && live[u].vote))
  const cards = view.cards || []
  const card = cards[focus]
  useArrows(cards.length, focus, setFocus)
  return (
    <>
      <p className="lede">{fr(lead ? 'Les autres cherchent la vraie définition.' : 'Laquelle est la vraie ?')}</p>
      <Deck n={cards.length} focus={focus} setFocus={setFocus} />
      {voter && card ? (
        card.clickable ? (
          <Btn kind={card.variant === 'on' ? 'ghost' : 'primary'} onClick={() => E.castVote(card.k)}>{card.variant === 'on' ? 'Ton vote est posé' : `Voter pour la ${focus + 1}`}</Btn>
        ) : <p className="help">C’est ton bluff : vote pour une autre.</p>
      ) : null}
      {voter ? <p className="help">{fr(mine && mine.vote ? 'Tu peux changer d’avis jusqu’à la révélation.' : 'Fais tourner les cartes, puis touche celle que tu crois vraie.')}</p> : null}
      <Progress label="Votes" n={done.length} total={need.length} missing={missing} />
      {E.canPlay() && done.length > 0 && missing.length > 0 ? <Force label="Révéler maintenant" ask={'Révéler sans attendre le vote de ' + E.listNames(missing) + ' ?'} go={() => E.act('reveal', { expect: { phase: 'vote', rk: S.rk }, manual: true })} /> : null}
    </>
  )
}

function verdict(S, R) {
  const finders = R.opts.filter(o => o.a === '*').reduce((a, o) => a.concat(o.by), [])
  const best = E.bestBluff(R.opts)
  const out = []
  if (!R.voted) out.push('Personne n’a voté cette fois.')
  else if (!finders.length) out.push(S.meneur ? `Personne n’a trouvé : ${E.nameOf(S.meneur)} empoche ${E.RULES.LEAD} points.` : 'Personne n’a trouvé la vraie définition.')
  else out.push(E.listNames(finders) + (finders.length > 1 ? ' ont flairé' : ' a flairé') + ' la vraie définition.')
  if (best) out.push(`Meilleur bluff : ${E.nameOf(best.a)}, ${best.n} vote${best.n > 1 ? 's' : ''}.`)
  return fr(out.join(' '))
}

function Scores({ S, pts }) {
  const rows = E.ranking(S.scores, E.seatsOf(E.data.players))
  return (
    <ol className="scores">
      {rows.map(r => (
        <li key={r.u} className={r.r === 1 && r.s > 0 ? 'lead' : ''}>
          <span className="rk">{r.r}</span>
          <span className="dot" style={{ background: E.avatarOf(r.u).color }} />
          <span className="nm">{E.nameOf(r.u)}{r.u === E.rt.me ? <span className="me"> (toi)</span> : null}</span>
          {pts && pts[r.u] ? <span className="pts">+{pts[r.u]}</span> : <span />}
          <b className="tot">{r.s}</b>
        </li>
      ))}
    </ol>
  )
}

function Reveal({ S, view, focus, setFocus, reveal, cardsOpen, setCardsOpen }) {
  const R = S.reveal || { opts: [], pts: {} }
  const done = E.reached(S.scores, S.settings.target)
  const [busy, run] = useRun()
  useArrows(view.cards ? view.cards.length : 0, focus, setFocus)
  if (!reveal.all) {
    return (
      <>
        <p className="lede">Les cartes se retournent…</p>
        <button className="link" type="button" onClick={reveal.showAll}>Tout révéler</button>
      </>
    )
  }
  return (
    <>
      <p className="lede">{verdict(S, R)}</p>
      {cardsOpen ? <Deck n={R.opts.length} focus={focus} setFocus={setFocus} /> : null}
      <button className="link" type="button" onClick={() => setCardsOpen(!cardsOpen)}>{cardsOpen ? 'Voir le classement' : 'Revoir les définitions'}</button>
      <span className="kicker">Classement{S.settings.target ? ' · objectif ' + S.settings.target + ' points' : ''}</span>
      <Scores S={S} pts={R.pts} />
      {E.canPlay() ? <Btn busy={busy} onClick={() => run(() => E.act(done ? 'end' : 'next', { expect: { phase: 'reveal', rk: S.rk }, manual: true }))}>{done ? 'Voir le podium' : 'Manche suivante'}</Btn> : null}
    </>
  )
}

function End({ S }) {
  const hist = S.hist || []
  const [busy, run] = useRun()
  const [busy2, run2] = useRun()
  return (
    <>
      <span className="kicker">Fin de partie · {hist.length} mot{hist.length > 1 ? 's' : ''}</span>
      <Scores S={S} />
      {hist.length ? (
        <dl className="recap">
          {hist.map(x => (
            <div className="rc" key={x.n + '-' + x.w}>
              <dt>{x.w}</dt>
              <dd>{x.d}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {E.canPlay() ? (
        <div className="row">
          <Btn busy={busy} onClick={() => run(() => E.act('start', { manual: true }))}>Rejouer</Btn>
          <Btn kind="ghost" busy={busy2} onClick={() => run2(() => E.act('lobby', { manual: true }))}>Retour au salon</Btn>
        </div>
      ) : null}
    </>
  )
}

/* ---------- the card deck controls ---------- */
function useArrows(n, focus, setFocus) {
  useEffect(() => {
    const k = e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.key === 'ArrowLeft') setFocus(Math.max(0, focus - 1))
      if (e.key === 'ArrowRight') setFocus(Math.min(n - 1, focus + 1))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [n, focus])
}

function Deck({ n, focus, setFocus }) {
  if (!n) return null
  return (
    <div className="deck">
      <button type="button" className="round-btn" aria-label="Carte précédente" disabled={focus <= 0} onClick={() => setFocus(focus - 1)}>‹</button>
      <div className="pips">{Array.from({ length: n }, (_, i) => <button key={i} type="button" aria-label={'Carte ' + (i + 1)} className={i === focus ? 'on' : ''} onClick={() => setFocus(i)}>{i + 1}</button>)}</div>
      <button type="button" className="round-btn" aria-label="Carte suivante" disabled={focus >= n - 1} onClick={() => setFocus(focus + 1)}>›</button>
    </div>
  )
}

/* ---------- menu, toasts ---------- */
function Menu({ S, close }) {
  const [ask, setAsk] = useState(null)
  const inGame = S && ['pick', 'write', 'vote', 'reveal'].includes(S.phase)
  const items = [
    ['Règles du jeu', () => setAsk('rules')],
    E.canPlay() && inGame ? ['Terminer la partie', () => E.act('end', { manual: true }).then(close)] : null,
    E.canPlay() ? ['Quitter la partie', () => E.leaveGame().then(close)] : null,
    ['Nouvelle partie', () => { close(); E.goHome() }],
  ].filter(Boolean)
  return (
    <>
      <div className="veil" onClick={close} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="sheet-h">
          <span className="logo"><Mark /><span className="logo-word">dictionary<span className="lx">x</span></span></span>
          <button className="icon-btn" type="button" aria-label="Fermer" onClick={close}>✕</button>
        </div>
        {ask === 'rules' ? (
          <ol className="rules">
            <li>Un mot rare tombe sur la table.</li>
            <li>Chacun invente en douce une fausse définition, la plus crédible possible.</li>
            <li>Les bluffs et la vraie sont distribués comme des cartes. Chacun vote pour celle qu’il croit vraie.</li>
            <li>{fr(`+${E.RULES.FIND} si tu trouves la vraie, +${E.RULES.FOOL} pour chaque joueur qui mord à ton bluff.`)}</li>
          </ol>
        ) : (
          <ul className="menu">{items.map(([t, f]) => <li key={t}><button type="button" onClick={f}><span>{t}</span><Arrow /></button></li>)}</ul>
        )}
      </div>
    </>
  )
}

/* ---------- the overlay ---------- */
export default function Overlay({ S, gate, view, focus, setFocus, reveal, cardsOpen, setCardsOpen }) {
  const [menu, setMenu] = useState(false)
  const [folded, setFolded] = useState(false)
  useEffect(() => setFolded(false), [view.key])
  let body
  if (E.rt.error === 'config') body = <p className="lede">{fr('Configuration manquante : renseigne SUPABASE_URL et SUPABASE_ANON_KEY dans .env.')}</p>
  else if (!E.web.room) body = <Landing />
  else if (E.web.notFound) body = <><p className="lede">Aucune partie {E.web.room}.</p><Btn onClick={E.goHome}>Retour à l’accueil</Btn></>
  else if (!E.data.loaded.state || !E.data.loaded.players) body = <p className="lede">On dresse la table…</p>
  else if (!S || S.phase === 'lobby') body = <Lobby S={S} />
  else if (!E.joined() && E.canPlay() === false && S.phase !== 'end') body = <><p className="lede">Une partie est en cours. Prends place, tu joues dès maintenant.</p><JoinForm /></>
  else if (S.phase === 'pick') body = <Pick S={S} />
  else if (S.phase === 'write') body = <Write S={S} />
  else if (S.phase === 'vote') body = <Vote S={S} view={view} focus={focus} setFocus={setFocus} />
  else if (S.phase === 'reveal') body = <Reveal S={S} view={view} focus={focus} setFocus={setFocus} reveal={reveal} cardsOpen={cardsOpen} setCardsOpen={setCardsOpen} />
  else body = <End S={S} />

  const me = E.rt.me && E.data.players[E.rt.me]
  return (
    <div className="overlay">
      <Top S={gate ? null : S} onMenu={() => setMenu(true)} />
      <section className={'panel' + (folded ? ' folded' : '')} key={view.key}>
        <button type="button" className="grip" aria-label={folded ? 'Déplier' : 'Replier'} onClick={() => setFolded(!folded)}><i /></button>
        <div className="panel-in">{body}</div>
        {me && S && S.phase !== 'lobby' ? (
          <p className="you-line">
            <span className="dot" style={{ background: E.avatarOf(E.rt.me).color }} /> {me.nick} · {(S.scores || {})[E.rt.me] || 0} pts
            {statusOf(E.rt.me, S) ? <span className="st"> · {statusOf(E.rt.me, S).t}</span> : null}
          </p>
        ) : null}
      </section>
      <div className="toasts" aria-live="polite">{E.toasts.map(t => <div className="toast" key={t.id}>{t.t}</div>)}</div>
      {menu ? <Menu S={S} close={() => setMenu(false)} /> : null}
    </div>
  )
}
