import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import Scene from './scene/Scene.jsx'
import Overlay from './ui/Overlay.jsx'
import ShaderBackground, { ripple } from './ui/ShaderBackground.jsx'
import { E, useEngine, wordOf } from './engine.js'

/** Reveals the definitions one by one: the bluffs first, the true one last, as the 2D game does. */
function useRevealStep(S) {
  const R = (S && S.phase === 'reveal' && S.reveal) || null
  const rk = S && S.rk
  const seq = useMemo(
    () => (R ? R.opts.filter(o => o.a !== '*').map(o => o.k).concat(R.opts.filter(o => o.a === '*').map(o => o.k)) : []),
    [rk, !!R],
  )
  const [state, setState] = useState({ rk: null, step: 0 })
  const step = state.rk === rk ? state.step : E.reducedMotion() || E.seenReveal.has(rk) ? seq.length : 0
  useEffect(() => {
    if (!R) return undefined
    if (step >= seq.length) {
      E.seenReveal.add(rk)
      return undefined
    }
    const t = setTimeout(() => setState({ rk, step: step + 1 }), step === 0 ? 900 : 1500)
    return () => clearTimeout(t)
  }, [rk, step, !!R])
  return { seq, step, all: !R || step >= seq.length, showAll: () => setState({ rk, step: seq.length }) }
}

function buildView(S, gate, reveal, focus, cardsOpen) {
  const key = gate ? 'gate' : S ? S.phase + ':' + (S.rk || '') : 'none'
  if (gate || !S) {
    return { key, shot: 'home', pointY: 4.1, pointOn: true, title: { text: 'dictionaryx', detail: 'n. m.   jeu de bluff', y: 2.1, z: -0.6, landing: true, width: 6.2 } }
  }
  const w = wordOf(S)
  const wordTitle = (y, z, small) => {
    const text = w.word + (w.fem ? ', ' + w.fem : '')
    const width = Math.min(small ? 4.4 : 6.4, Math.max(2.2, text.length * (small ? 0.42 : 0.6)))
    // with the cards on the table, the nature goes to the panel: nothing under the word
    return { text, detail: small ? '' : w.nat, y, z, width }
  }
  const base = { key, S, seats: true, pointY: 4.5 }
  if (S.phase === 'lobby') return { ...base, shot: 'lobby', pointOn: true, title: { text: 'dictionaryx', detail: 'en attendant les joueurs', y: 2.3, z: -2.2, landing: true, width: 6.4 } }
  if (S.phase === 'pick') return { ...base, shot: 'lobby', title: null }
  if (S.phase === 'write') return { ...base, shot: 'write', pointY: 4.2, title: wordTitle(2.2, -0.9) }
  if (S.phase === 'vote') {
    let key2 = {}
    try { key2 = JSON.parse(E.dec(S.key) || '{}') } catch { key2 = {} }
    const live = E.liveSubs(E.data.subs, S.rk)
    const mine = live[E.rt.me]
    const lead = E.rt.me && S.meneur === E.rt.me
    const voter = E.canPlay() && !lead
    const cards = (S.opts || []).map(o => {
      const own = key2[o.k] === E.rt.me
      const on = !!(mine && mine.vote === o.k)
      const truth = lead && key2[o.k] === '*'
      return {
        k: o.k,
        text: o.t,
        variant: own ? 'own' : on ? 'on' : truth ? 'truth' : '',
        tag: own ? 'Ton bluff' : on ? 'Ton vote' : truth ? 'La vraie' : '',
        tagHot: truth,
        clickable: voter && !own,
      }
    })
    return { ...base, shot: 'cards', pointY: 4.8, title: wordTitle(3.3, -1.7, true), cards }
  }
  if (S.phase === 'reveal') {
    const R = S.reveal || { opts: [], pts: {} }
    const shown = new Set(reveal.seq.slice(0, reveal.step))
    const cards = R.opts.map(o => {
      const truth = o.a === '*'
      const n = o.by.length
      if (!shown.has(o.k)) return { k: o.k, text: o.t, variant: '', tag: '', clickable: false }
      const who = n ? E.listNames(o.by) : ''
      return {
        k: o.k,
        text: o.t,
        variant: truth ? 'true' : 'fake',
        tag: truth ? 'Vrai' : 'Bluff · ' + E.nameOf(o.a),
        tagHot: truth,
        clickable: false,
        footer: truth
          ? n ? `${who} ${n > 1 ? 'ont trouvé' : 'a trouvé'}  ·  +${E.RULES.FIND} chacun` : 'Personne ne l’a trouvée'
          : n ? `${who} ${n > 1 ? 'ont mordu' : 'a mordu'}  ·  +${n * E.RULES.FOOL} pour ${E.nameOf(o.a)}` : 'Personne n’a mordu',
        footerHot: n > 0,
      }
    })
    const truth = R.opts.find(o => o.a === '*')
    const burstKey = truth && shown.has(truth.k) ? S.rk : null
    const scores = reveal.all && !cardsOpen
    return { ...base, shot: scores ? 'scores' : 'cards', title: wordTitle(scores ? 3.1 : 3.3, -1.7, !scores), pointY: 4.8, pointOn: scores, cards: scores ? null : cards, showScore: true, burstKey }
  }
  // end of the game
  const rows = E.ranking(S.scores, E.seatsOf(E.data.players))
  const top = rows.filter(r => r.r === 1 && r.s > 0)
  return {
    ...base,
    shot: 'scores',
    showScore: true,
    title: (() => { const text = top.length ? E.listNames(top.map(r => r.u)) : 'Fin de partie'; return { text, detail: top.length ? (top.length > 1 ? 'gagnent' : 'gagne') : '', y: 3.1, z: -2, width: Math.min(6.4, Math.max(2.4, text.length * 0.6)) } })(),
    burstKey: 'end:' + (S.g || ''),
    pointY: 4.8,
    pointOn: true,
  }
}

export default function App() {
  useEngine()
  const S = E.data.state
  const gate = !E.web.room || E.web.notFound || E.rt.error === 'config'
  const reveal = useRevealStep(S)
  const [focus, setFocus] = useState(0)
  const [cardsOpen, setCardsOpen] = useState(false)
  const phaseKey = S ? S.phase + ':' + (S.rk || '') : 'none'

  // a new phase deals the cards again from the first one
  useEffect(() => {
    setFocus(0)
    setCardsOpen(false)
    ripple(0.5, 0.62)
  }, [phaseKey])
  // during the reveal, the card being turned comes to the front
  useEffect(() => {
    if (!S || S.phase !== 'reveal' || reveal.all || !reveal.step) return
    const k = reveal.seq[reveal.step - 1]
    const i = (S.reveal ? S.reveal.opts : []).findIndex(o => o.k === k)
    if (i >= 0) setFocus(i)
  }, [reveal.step])

  const view = buildView(S, gate, reveal, focus, cardsOpen)
  const count = view.cards ? view.cards.length : 0
  const safeFocus = Math.min(focus, Math.max(0, count - 1))

  return (
    <>
      <ShaderBackground />
      <Canvas
        className="stage3d"
        dpr={[1, 1.75]}
        camera={{ position: [0, 3.2, 9], fov: 42, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={state => { if (import.meta.env.DEV) window.__r3f = state }}
      >
        <Suspense fallback={null}>
          <Scene view={view} focus={safeFocus} setFocus={setFocus} onPick={k => E.castVote(k)} />
        </Suspense>
        <AdaptiveDpr pixelated={false} />
      </Canvas>
      <Overlay
        S={S}
        gate={gate}
        view={view}
        focus={safeFocus}
        setFocus={setFocus}
        reveal={reveal}
        cardsOpen={cardsOpen}
        setCardsOpen={setCardsOpen}
      />
    </>
  )
}
