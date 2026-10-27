// The 2D game's engine (rules, shared state, Supabase), plus the few view helpers ui.js keeps for itself.
import { useEffect, useState } from 'react'
import * as E from 'virtual:dictionaryx-engine'

export { E }

/** Redraws on every change of the shared state (Realtime, a move, a toast). */
export function useEngine() {
  const [, set] = useState(0)
  useEffect(() => {
    const f = () => set(x => x + 1)
    E.listeners.add(f)
    return () => E.listeners.delete(f)
  }, [])
}

/** Redraws every second, for clocks. */
export function useTick() {
  const [, set] = useState(0)
  useEffect(() => {
    const f = () => set(x => x + 1)
    E.tickers.add(f)
    return () => E.tickers.delete(f)
  }, [])
}

export function useRun() {
  const [busy, setBusy] = useState(false)
  const run = async fn => {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }
  return [busy, run]
}

/** A player's status in the current phase, as the 2D game shows it. */
export function statusOf(u, S) {
  if (!S) return null
  const live = E.liveSubs(E.data.subs, S.rk)
  if (S.phase === 'pick') return u === S.meneur ? { t: 'meneur', c: 'lead' } : null
  if (S.phase === 'write') {
    if (u === S.meneur) return { t: 'meneur', c: 'lead' }
    if (E.hasDef(live[u])) return { t: 'prêt', c: 'done' }
    if (E.data.typing[u] && E.data.typing[u] === S.rk) return { t: 'écrit…', c: 'typing' }
    return { t: 'réfléchit', c: '' }
  }
  if (S.phase === 'vote') {
    if (u === S.meneur) return { t: 'meneur', c: 'lead' }
    if (live[u] && live[u].vote) return { t: 'a voté', c: 'done' }
    return { t: 'hésite', c: '' }
  }
  if (S.phase === 'reveal') {
    const p = (S.reveal && S.reveal.pts[u]) || 0
    return { t: '+' + p, c: p ? 'gain' : '' }
  }
  return null
}

/** French typography, as scripts/bundle.mjs applies it: thin no-break space before ; ! ? and a no-break space before : and inside guillemets. */
export const fr = s => String(s).replace(/ ([;!?])/g, ' $1').replace(/ :/g, ' :').replace(/« /g, '« ').replace(/ »/g, ' »')

const TIPS = [
  'Les vraies définitions sont sèches et précises. Imite ce ton.',
  'Un détail technique rend un bluff crédible.',
  'Une mention comme « vieilli » ou « marine » fait très dictionnaire.',
  'Évite la blague trop visible : on vote pour ce qui sonne vrai.',
]
export function tipFor(S) {
  const e = E.bankEntry(S.word)
  const nat = String((e ? e[3] : S.word && S.word.nat) || '')
  const h = E.hashStr(S.rk || '')
  if (h % 2 === 0) {
    if (/^v/.test(nat)) return fr('Un verbe se définit par un verbe : « Faire… », « Rendre… ».')
    if (/^adj/.test(nat)) return fr('Un adjectif se définit souvent par « Qui… » ou « Se dit de… ».')
    if (/^n/.test(nat)) return fr('Un nom se définit par un nom : « Petit… », « Sorte de… », « Action de… ».')
  }
  return fr(TIPS[h % TIPS.length])
}

/** The word in play with its dictionary details. */
export function wordOf(S) {
  const w = (S && S.word) || {}
  const e = E.bankEntry(w)
  return {
    word: w.w || '',
    fem: e ? e[1] : w.fem || '',
    ipa: e ? e[2] : w.ipa || '',
    nat: e ? e[3] : w.nat || '',
  }
}
