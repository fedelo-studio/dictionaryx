// A player's figurine: a low-poly animal in matte clay, standing on a plinth. The plinth lights up once the
// player has written, and rises as a column with the score.
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

const cache = new Map()
/** One geometry per figurine, shared by every seat: its parts merged, each vertex carrying its part's lightness. */
function geometryOf(fig) {
  if (cache.has(fig.id)) return cache.get(fig.id)
  const pos = []
  const col = []
  const idx = []
  for (const p of fig.parts) {
    const base = pos.length / 3
    pos.push(...p.pos)
    for (let i = 0; i < p.pos.length / 3; i++) col.push(p.light, p.light, p.light)
    for (const i of p.idx) idx.push(base + i)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  cache.set(fig.id, g)
  return g
}

// a nine-sided plinth, its top at y = 0, one unit tall: scaled to the column it becomes
const PLINTH = new THREE.CylinderGeometry(0.4, 0.44, 1, 9, 1).translate(0, -0.5, 0)
const PLINTH_DARK = new THREE.Color('#2a2a27')
const PLINTH_LIT = new THREE.Color('#cfccc4')

// matte clay: no shine, the facets of the polygons kept
const clay = color => new THREE.MeshStandardMaterial({ color, vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0, toneMapped: false })

/** fig: from figures.js; height: the most a figure may stand. */
export function Figure({ fig, color, agitate = 0, ready = 0, column = 0, calm, height = 0.95 }) {
  const geo = geometryOf(fig)
  const mat = useMemo(() => clay(color), [])
  const plinthMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PLINTH_DARK.clone(), flatShading: true, roughness: 1, metalness: 0, toneMapped: false }), [])
  useEffect(() => { mat.color.set(color) }, [color])
  const body = useRef()
  const turn = useRef()
  const plinth = useRef()
  const v = useRef({ t: Math.random() * 10, pop: 1, agitate: 0, ready: 0, column: 0 })
  const k = Math.min(height, 1.3 / Math.max(0.5, fig.length))
  // a new figurine comes in with a small pop
  useEffect(() => { v.current.pop = 0.6 }, [fig])
  useFrame((_, dt) => {
    const s = v.current
    const damp = THREE.MathUtils.damp
    s.t += dt
    s.pop = damp(s.pop, 1, 7, dt)
    s.agitate = damp(s.agitate, calm ? 0 : agitate, 4, dt)
    s.ready = damp(s.ready, ready, 4, dt)
    s.column = damp(s.column, column, 2.2, dt)
    body.current.position.y = -0.5 + s.column + Math.abs(Math.sin(s.t * 7)) * 0.035 * s.agitate
    body.current.scale.setScalar(k * s.pop)
    // in a three-quarter profile, as a figurine on a slow turntable; writing, it nods a little
    turn.current.rotation.y = -0.5 + (calm ? 0 : Math.sin(s.t * 0.3) * 0.18)
    turn.current.rotation.z = Math.sin(s.t * 7) * 0.05 * s.agitate
    plinth.current.position.y = -0.5 + s.column
    plinth.current.scale.y = 0.09 + s.column
    plinthMat.color.lerpColors(PLINTH_DARK, PLINTH_LIT, s.ready)
  })
  return (
    <group>
      <group ref={body}>
        <group ref={turn}>
          <mesh geometry={geo} material={mat} />
        </group>
      </group>
      <mesh ref={plinth} geometry={PLINTH} material={plinthMat} />
    </group>
  )
}
