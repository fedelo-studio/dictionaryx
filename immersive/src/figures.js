// The figurines: one shape per player, chosen on arrival and kept in the room's state (state.figs), so every
// phone sees the same table. The shapes are Quaternius's Farm Animals (CC0), sampled by scripts/figures.mjs.
import RAW from './scene/figures.json'
import { E } from './engine.js'

/** Each figurine: id, French name, points (x, y, z: one unit tall, in profile along x), and a lightness per point. */
export const FIGS = RAW.map(f => {
  const lo = Math.min(...f.lum)
  const hi = Math.max(...f.lum)
  // the material's lightness kept as a contrast inside the figure, never as a colour: spots, stripes, a muzzle
  const light = f.lum.map(l => (hi > lo ? 0.42 + 0.58 * ((l - lo) / (hi - lo)) : 1))
  let len = 0
  for (let i = 0; i < f.pts.length; i += 3) len = Math.max(len, Math.abs(f.pts[i]))
  return { id: f.id, name: f.name, pts: f.pts, light, length: len * 2 }
})
const BY_ID = Object.fromEntries(FIGS.map(f => [f.id, f]))

/** Who sits behind which figurine: their choice, else the next one free from a place of their own. */
export function figures() {
  const chosen = (E.data.state && E.data.state.figs) || {}
  const out = {}
  const taken = new Set()
  const order = E.seatsOf(E.data.players)
  for (const u of order) if (BY_ID[chosen[u]] && !taken.has(chosen[u])) { out[u] = chosen[u]; taken.add(chosen[u]) }
  for (const u of order) {
    if (out[u]) continue
    const start = E.hashStr(String(u)) % FIGS.length
    let f = null
    for (let k = 0; k < FIGS.length && !f; k++) { const c = FIGS[(start + k) % FIGS.length].id; if (!taken.has(c)) f = c }
    // more players than figurines: two may share one
    out[u] = f || FIGS[start].id
    taken.add(out[u])
  }
  return out
}

export const figOf = u => BY_ID[figures()[u]] || FIGS[E.hashStr(String(u)) % FIGS.length]

/** The figurine someone else already sits behind, by id: their uid. */
export function takenBy() {
  const map = figures()
  const out = {}
  for (const [u, f] of Object.entries(map)) if (u !== E.rt.me) out[f] = u
  return out
}

/** Sits behind a figurine, and remembers it on this phone for the next games. */
export function chooseFig(id) {
  if (!BY_ID[id]) return Promise.resolve('error')
  E.lsSet('fig', id)
  if (!E.joined()) return Promise.resolve('ok')
  return E.act('fig', { args: id, manual: true })
}

/** The figurine this phone prefers: the last one chosen, if no one else has it. */
export function preferredFig() {
  const t = takenBy()
  const last = E.lsGet('fig')
  if (BY_ID[last] && !t[last]) return last
  return (FIGS.find(f => !t[f.id]) || FIGS[0]).id
}
