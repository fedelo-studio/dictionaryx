// The table is made of light: the fedelo.studio field behind (ShaderBackground), a slow galaxy for the table,
// the word as a cloud of particles, each player a swarm of their colour, the definitions dealt as glass cards.
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Text, useCursor } from '@react-three/drei'
import { E, statusOf } from '../engine.js'
import { Burst, Figure, Galaxy, WordCloud } from './particles.jsx'
import { figOf } from '../figures.js'

export const C = {
  card: '#141414',
  fg: '#f5f5f2',
  dim: '#b3b3ae',
  hot: '#ff4a1c',
}
// Absolute: troika loads fonts from a worker, where a path alone resolves against nothing.
const fontUrl = name => new URL(`/fonts/strawford-${name}-webfont.woff`, location.origin).href
export const FONT = { light: fontUrl('light'), regular: fontUrl('regular'), medium: fontUrl('medium') }
const damp = THREE.MathUtils.damp

/* ---------- camera ---------- */
const SHOTS = {
  home: { pos: [0, 2.6, 8.8], look: [0, 1.6, 0] },
  lobby: { pos: [0, 3.4, 8.4], look: [0, 1.2, 0] },
  write: { pos: [0, 3.2, 7.6], look: [0, 1.6, 0] },
  cards: { pos: [0, 2.3, 6.4], look: [0, 1.8, 0.6] },
  scores: { pos: [0, 3.9, 8.8], look: [0, 1.7, -0.6] },
}
const PANEL = 452 // the panel's width plus its right margin on a wide screen (styles.css)
const wideScreen = size => size.width >= 960

// Where the camera goes for a shot. Rows: the players sit on two rows when one would crowd them.
function shotPose(shot, size, rows = 1) {
  const s = SHOTS[shot] || SHOTS.home
  const back = size.width < size.height ? 1 + (size.height / size.width - 1) * 0.55 : 1
  const wide = wideScreen(size)
  return {
    pos: [s.pos[0], s.pos[1] * (0.9 + back * 0.1), s.pos[2] * back],
    look: s.look,
    // the table centred in the free part of the screen: left of the panel on a wide screen, above it upright
    ox: wide ? PANEL / 2 : 0,
    oy: !wide && size.width < size.height ? size.height * (rows > 1 ? 0.27 : 0.2) : 0,
  }
}

/**
 * The free part of the screen, seen from where the camera is going: how wide the table may be at a point,
 * where a point lands on screen, and which point of a plane lies under a pixel.
 */
function makeRoom(shot, size, rows, camera) {
  const p = shotPose(shot, size, rows)
  const cam = camera.clone()
  cam.position.set(...p.pos)
  cam.lookAt(...p.look)
  cam.setViewOffset(size.width, size.height, p.ox, p.oy, size.width, size.height)
  cam.updateMatrixWorld()
  const wide = wideScreen(size)
  // below the top bar; left of the panel on a wide screen, above it on a phone
  const free = { left: 20, right: wide ? size.width - PANEL - 20 : size.width - 20, top: 84, bottom: wide ? size.height - 36 : size.height * 0.37 }
  const ray = new THREE.Raycaster()
  const v = new THREE.Vector3()
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const under = (px, py, z) => {
    plane.constant = -z
    ray.setFromCamera({ x: (px / size.width) * 2 - 1, y: 1 - (py / size.height) * 2 }, cam)
    return ray.ray.intersectPlane(plane, new THREE.Vector3())
  }
  const toPx = (x, y, z) => {
    v.set(x, y, z).project(cam)
    return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height]
  }
  const half = (y, z) => {
    const py = toPx(0, y, z)[1]
    const l = under(free.left, py, z)
    const r = under(free.right, py, z)
    return Math.max(0.4, Math.min(l ? -l.x : 0, r ? r.x : 0))
  }
  return { free, under, toPx, half }
}

function Rig({ shot, rows, calm }) {
  const look = useRef(new THREE.Vector3(...SHOTS.home.look))
  const offset = useRef({ x: 0, y: 0 })
  const { size } = useThree()
  useFrame((state, dt) => {
    const p = shotPose(shot, size, rows)
    const t = state.clock.elapsedTime
    // a slow breath of the camera, and the pointer's parallax: small, so nothing slides off the edge
    const drift = calm ? 0 : Math.sin(t * 0.12) * 0.18
    const px = calm ? 0 : state.pointer.x * 0.25
    const py = calm ? 0 : state.pointer.y * 0.2
    const cam = state.camera
    cam.position.x = damp(cam.position.x, p.pos[0] + px + drift, 2, dt)
    cam.position.y = damp(cam.position.y, p.pos[1] + py, 2, dt)
    cam.position.z = damp(cam.position.z, p.pos[2], 2, dt)
    look.current.x = damp(look.current.x, p.look[0], 2.4, dt)
    look.current.y = damp(look.current.y, p.look[1], 2.4, dt)
    look.current.z = damp(look.current.z, p.look[2], 2.4, dt)
    cam.lookAt(look.current)
    offset.current.x = damp(offset.current.x, p.ox, 3, dt)
    offset.current.y = damp(offset.current.y, p.oy, 3, dt)
    cam.setViewOffset(size.width, size.height, offset.current.x, offset.current.y, size.width, size.height)
  })
  return null
}

/* ---------- the studio's point ---------- */
let glowTex = null
function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,140,90,1)')
  r.addColorStop(0.2, 'rgba(255,74,28,0.55)')
  r.addColorStop(1, 'rgba(255,74,28,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c)
  return glowTex
}

function Point({ y = 4.3, on = true, phaseKey, calm }) {
  const ref = useRef()
  const show = useRef(on ? 1 : 0)
  const halo = useRef()
  const flare = useRef({ key: phaseKey, t: 0 })
  useFrame((state, dt) => {
    if (flare.current.key !== phaseKey) flare.current = { key: phaseKey, t: 1 }
    flare.current.t = damp(flare.current.t, 0, 2, dt)
    const f = flare.current.t
    const t = state.clock.elapsedTime
    ref.current.position.y = damp(ref.current.position.y, y + (calm ? 0 : Math.sin(t * 0.8) * 0.1), 3, dt)
    show.current = damp(show.current, on ? 1 : 0, 3, dt)
    ref.current.scale.setScalar(Math.max(0.001, show.current))
    ref.current.visible = show.current > 0.01
    halo.current.scale.setScalar(0.95 + f * 3 + (calm ? 0 : Math.sin(t * 2) * 0.05))
  })
  return (
    <group ref={ref} position={[0, y, -0.8]}>
      <mesh>
        <sphereGeometry args={[0.11, 32, 32]} />
        <meshBasicMaterial color="#ff5a2a" toneMapped={false} />
      </mesh>
      <sprite ref={halo}>
        <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  )
}

/* ---------- the word's details, under the cloud ---------- */
function Caption({ text, y, z }) {
  const ref = useRef()
  useFrame((_, dt) => {
    ref.current.position.y = damp(ref.current.position.y, y, 3, dt)
    ref.current.position.z = damp(ref.current.position.z, z, 3, dt)
  })
  return (
    <group ref={ref} position={[0, y, z]}>
      <Text font={FONT.regular} fontSize={0.26} letterSpacing={0.02} anchorX="center" anchorY="top" color={C.dim}>
        {text}
      </Text>
    </group>
  )
}

/* ---------- players round the table ---------- */
const GAP = 1.4 // the room a name needs beside its neighbour, in seat units
const SEAT_UP = 1.15 // the name and the status above the swarm's centre
const SEAT_H = 1.7 // a whole seat, swarm included
const DEPTH = [-1.3, -0.3] // the back row and the front row

/**
 * Where the players sit, laid out on the screen itself: under the word, inside the free part of the screen,
 * on one row, or on two staggered rows when one would crowd. Short of room, the seats shrink a little.
 * under: the lowest point of the word and its caption, [y, z]. low: at the bottom of the band, for the scores,
 * whose columns of light rise into the room left above.
 */
function seatLayout(n, roomOf, under, low) {
  if (!n) return { pos: [], rows: 1, scale: 1, label: 2.4, crowded: false, tall: 2.4 }
  const plan = rows => {
    const room = roomOf(rows)
    const top = Math.max(room.free.top, under ? room.toPx(0, under[0], under[1])[1] + 16 : 0)
    const band = Math.max(80, room.free.bottom - top)
    const counts = rows > 1 ? [Math.ceil(n / 2), Math.floor(n / 2)] : [n]
    const even = rows > 1 && counts[0] === counts[1]
    let scale = 1
    let gap = 2.6
    const rowsOut = counts.map((k, r) => {
      const z = DEPTH[r]
      const mid = room.under(room.toPx(0, 0, z)[0], top + band / 2, z) || new THREE.Vector3(0, 0.5, z)
      const ppw = Math.abs(room.toPx(0, mid.y, z)[1] - room.toPx(0, mid.y + 1, z)[1]) // pixels per unit there
      scale = Math.min(scale, band / rows / (SEAT_H * ppw))
      const half = room.half(mid.y, z) - 0.95
      const span = k - 1 + (even ? 0.5 : 0)
      if (span > 0) gap = Math.min(gap, (2 * Math.max(0.3, half)) / span)
      return { k, z, ppw, half }
    })
    scale = Math.min(scale, gap / GAP)
    return { room, top, bottom: room.free.bottom, rowsOut, even, gap, scale }
  }
  let L = plan(1)
  if (n > 2 && L.scale < 0.82) {
    const two = plan(2)
    // names side by side that would not fit: two rows, even a little smaller
    if (two.scale > L.scale || L.gap / GAP < 0.8) L = two
  }
  const scale = THREE.MathUtils.clamp(L.scale, 0.5, 1)
  const pos = []
  const height = L.rowsOut.reduce((h, row) => h + SEAT_H * row.ppw * scale + 6, 0)
  let y = low ? Math.max(L.top, L.bottom - height) : L.top
  // the columns rise into the room above the back row, in seat units; on two rows, no higher than a row
  const tall = THREE.MathUtils.clamp((y - L.top) / (L.rowsOut[0].ppw * scale) - 0.1, 0.4, L.rowsOut.length > 1 ? 0.55 : 2.4)
  L.rowsOut.forEach((row, r) => {
    // rows packed from the top of the band, the front row in the gaps of the back one
    const cy = y + SEAT_UP * row.ppw * scale
    y += SEAT_H * row.ppw * scale + 6
    const cx = L.room.toPx(0, 0, row.z)[0]
    const at = L.room.under(cx, cy, row.z)
    for (let i = 0; i < row.k; i++) {
      const x = (i - (row.k - 1) / 2) * L.gap + (L.even ? ((r ? 1 : -1) * L.gap) / 4 : 0)
      const u = Math.min(1, Math.abs(x) / Math.max(0.5, row.half))
      pos.push([x, at ? at.y : 0.55, row.z - 0.3 * (1 - u * u)])
    }
  })
  return { pos, rows: L.rowsOut.length, scale, label: Math.min(2.4, (L.gap / scale) * 0.94), crowded: scale < 0.85, tall }
}

function Seat({ u, pos, scale, label: labelW, tall, crowded, S, score, maxScore, showScore, isLead, away, calm }) {
  const group = useRef()
  const shown = useRef(away ? 0 : 1)
  const base = useRef(pos[1])
  const label = useRef()
  const st = statusOf(u, S)
  const me = u === E.rt.me
  const online = E.data.online.has(u)
  // the shapes tell the players apart; the colour is the studio's: white, orange for you and for the lead
  const color = me || isLead ? C.hot : online || showScore ? C.fg : '#4a4a46'
  const fig = figOf(u)
  const column = showScore ? 0.3 + (maxScore ? score / maxScore : 0) * tall : 0
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const g = group.current
    g.position.x = damp(g.position.x, pos[0], 3, dt)
    g.position.z = damp(g.position.z, pos[2], 3, dt)
    base.current = damp(base.current, pos[1], 3, dt)
    g.position.y = base.current + (calm ? 0 : Math.sin(t * 1.2 + u.length) * 0.04)
    shown.current = damp(shown.current, away ? 0 : 1, 4, dt)
    g.scale.setScalar(Math.max(0.001, shown.current * scale))
    group.current.visible = shown.current > 0.01
    label.current.position.y = damp(label.current.position.y, showScore ? column + 0.62 : 0.78, 3, dt)
  })
  const line = showScore
    ? `${score} pt${score > 1 ? 's' : ''}${st && st.c === 'gain' ? '   ' + st.t : ''}`
    : st ? st.t : online ? 'en ligne' : 'absent'
  return (
    <group ref={group} position={pos}>
      <Figure fig={fig} color={color} agitate={st && st.c === 'typing' ? 1 : 0} ready={st && st.c === 'done' ? 1 : 0} column={column} calm={calm} />
      <Billboard ref={label} position={[0, 0.78, 0]}>
        <Text font={FONT.medium} fontSize={0.27} anchorX="center" anchorY="bottom" textAlign="center" color={C.fg} maxWidth={labelW}>
          {E.nameOf(u)}{me && !crowded ? ' (toi)' : ''}
        </Text>
        {crowded && !showScore ? null : <Text font={FONT.medium} fontSize={0.18} letterSpacing={0.04} anchorX="center" anchorY="top" position={[0, -0.05, 0]} color={(st && ['typing', 'lead', 'gain'].includes(st.c)) || isLead ? C.hot : C.dim}>
          {line}
        </Text>}
      </Billboard>
    </group>
  )
}

function Seats({ S, layout, showScore, away, calm }) {
  const order = E.seatsOf(E.data.players)
  const scores = (S && S.scores) || {}
  const goal = (S && S.settings && S.settings.target) || 15
  const max = Math.max(goal, ...order.map(u => scores[u] || 0))
  const top = Math.max(0, ...order.map(u => scores[u] || 0))
  return order.map((u, i) => (
    <Seat key={u} u={u} pos={layout.pos[i] || [0, 0.55, -1.3]} scale={layout.scale} label={layout.label} tall={layout.tall} crowded={layout.crowded} S={S} score={scores[u] || 0} maxScore={max} showScore={showScore} isLead={showScore && top > 0 && (scores[u] || 0) === top} away={away} calm={calm} />
  ))
}

/* ---------- the definitions, dealt as glass cards ---------- */
const CARD_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const CARD_FS = /* glsl */ `
varying vec2 vUv;
uniform vec2 uSize;
uniform vec3 uFace, uEdge;
uniform float uEdgeW, uGlow, uOpacity;
float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = box(p, uSize * 0.5 - 0.08, 0.1);
  float fill = smoothstep(0.004, -0.004, d);
  float edge = smoothstep(uEdgeW, uEdgeW * 0.5, abs(d));
  float glow = exp(-max(d, 0.0) * 16.0) * uGlow * step(0.0, d);
  float sheen = smoothstep(0.0, 1.0, 1.0 - abs(vUv.y - 0.85 + vUv.x * 0.25) * 3.0) * 0.05;
  vec3 face = mix(uFace + sheen, uEdge, edge);
  float a = max(fill * 0.98, edge);
  vec3 col = face * a + uEdge * glow;
  gl_FragColor = vec4(col, max(a, glow) * uOpacity);
}`

const CARD_GREY = new THREE.Color('#5a5a56')
const CARD_HOVER = new THREE.Color('#a3a39e')
const CARD_HOT = new THREE.Color(C.hot)
const CARD_FACE = new THREE.Color(C.card)
const CARD_NEG = new THREE.Color(C.fg)

function Card({ i, focus, card, onFocus, onPick, scale, reach }) {
  const ref = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover && (card.clickable || i !== focus))
  const d = i - focus
  const front = d === 0
  const W = 2.6
  const H = 1.7
  const negative = card.variant === 'on'
  const hot = card.variant === 'true' || card.variant === 'truth'
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CARD_VS,
        fragmentShader: CARD_FS,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uSize: { value: new THREE.Vector2(W + 0.16, H + 0.16) },
          uFace: { value: CARD_FACE.clone() },
          uEdge: { value: CARD_GREY.clone() },
          uEdgeW: { value: 0.02 },
          uGlow: { value: 0 },
          uOpacity: { value: 0 },
        },
      }),
    [],
  )
  useFrame((state, dt) => {
    const g = ref.current
    // the neighbours peek in from the sides, never past the edge of the free screen
    const x = Math.sign(d) * Math.min(Math.abs(d) * 2.25 * scale, reach + (Math.abs(d) - 1) * 0.8)
    const z = 1.5 - Math.min(3, Math.abs(d)) * 1.3
    const y = 1.66 + (front && hover ? 0.05 : 0) + (front ? Math.sin(state.clock.elapsedTime * 1.2) * 0.02 : 0)
    g.position.x = damp(g.position.x, x, 4.5, dt)
    g.position.y = damp(g.position.y, y, 4.5, dt)
    g.position.z = damp(g.position.z, z, 4.5, dt)
    g.rotation.y = damp(g.rotation.y, -d * 0.6, 4.5, dt)
    g.rotation.z = damp(g.rotation.z, 0, 4, dt)
    g.scale.setScalar(damp(g.scale.x, (front ? 1 : 0.84) * scale, 4.5, dt))
    const u = mat.uniforms
    const k = 1 - Math.exp(-6 * dt)
    u.uOpacity.value = damp(u.uOpacity.value, front ? 1 : Math.abs(d) === 1 ? 0.3 : 0, 4, dt)
    g.visible = u.uOpacity.value > 0.02
    u.uFace.value.lerp(negative ? CARD_NEG : CARD_FACE, k)
    u.uEdge.value.lerp(hot || negative ? CARD_HOT : hover ? CARD_HOVER : CARD_GREY, k)
    u.uEdgeW.value = damp(u.uEdgeW.value, hot || negative ? 0.045 : 0.022, 6, dt)
    u.uGlow.value = damp(u.uGlow.value, hot ? 1.3 : negative ? 0.6 : 0, 4, dt)
  })
  const long = card.text.length
  const fontSize = long > 220 ? 0.1 : long > 140 ? 0.116 : long > 80 ? 0.134 : 0.155
  const ink = negative ? '#0b0b0b' : card.variant === 'own' || card.variant === 'fake' ? C.dim : C.fg
  const fade = front ? 1 : Math.abs(d) === 1 ? 0.3 : 0
  return (
    <group
      ref={ref}
      // dealt from the centre of the table
      position={[0, 0.6, 0]}
      rotation-z={0.6 - i * 0.3}
      scale={0.2}
      onClick={e => {
        e.stopPropagation()
        if (!front) onFocus(i)
        else if (card.clickable) onPick(card.k)
      }}
      onPointerOver={e => { e.stopPropagation(); setHover(true) }}
      onPointerOut={() => setHover(false)}
    >
      <mesh material={mat} renderOrder={front ? 10 : 0}>
        <planeGeometry args={[W + 0.16, H + 0.16]} />
      </mesh>
      <Text renderOrder={front ? 11 : 1} fillOpacity={fade} font={FONT.medium} fontSize={0.13} anchorX="left" anchorY="top" position={[-W / 2 + 0.2, H / 2 - 0.18, 0.01]} color={negative ? '#0b0b0b' : C.hot}>
        {String(i + 1).padStart(2, '0')}
      </Text>
      {card.tag ? (
        <Text renderOrder={front ? 11 : 1} fillOpacity={fade} font={FONT.medium} fontSize={0.095} letterSpacing={0.08} anchorX="right" anchorY="top" position={[W / 2 - 0.2, H / 2 - 0.195, 0.01]} color={card.tagHot ? C.hot : negative ? '#0b0b0b' : C.dim}>
          {card.tag.toUpperCase()}
        </Text>
      ) : null}
      <Text renderOrder={front ? 11 : 1} fillOpacity={fade} font={FONT.regular} fontSize={fontSize} lineHeight={1.38} maxWidth={W - 0.42} anchorX="left" anchorY="top" position={[-W / 2 + 0.21, H / 2 - 0.46, 0.01]} color={ink}>
        {card.text}
      </Text>
      {card.footer ? (
        <Text renderOrder={front ? 11 : 1} fillOpacity={fade} font={FONT.medium} fontSize={0.105} maxWidth={W - 0.42} anchorX="left" anchorY="bottom" position={[-W / 2 + 0.21, -H / 2 + 0.17, 0.01]} color={card.footerHot ? C.hot : C.dim}>
          {card.footer}
        </Text>
      ) : null}
    </group>
  )
}

function Cards({ cards, focus, onFocus, onPick, room }) {
  const { size } = useThree()
  const scale = size.width < size.height ? Math.max(0.95, (size.width / size.height) * 1.9) : 1
  // a neighbour, half turned towards the camera, reaches about 1.35 on each side of its centre
  const reach = Math.max(0.6, room.half(1.66, 0.2) - 1.35 * scale)
  return cards.map((card, i) => <Card key={card.k} i={i} focus={focus} card={card} onFocus={onFocus} onPick={onPick} scale={scale} reach={reach} />)
}

/* ---------- the whole scene ---------- */
export default function Scene({ view, focus, setFocus, onPick }) {
  const calm = E.reducedMotion()
  const { size, camera } = useThree()
  const n = view.seats ? E.seatsOf(E.data.players).length : 0
  const roomOf = useMemo(() => {
    const cache = {}
    return rows => (cache[rows] ||= makeRoom(view.shot, size, rows, camera))
  }, [view.shot, size.width, size.height, camera])
  const t = view.title
  // the word as wide as the bank asks, never wider than the free part of the screen
  const width = t ? Math.round(Math.min(t.width, 2 * roomOf(1).half(t.y, t.z) * 0.9) * 100) / 100 : 0
  const letter = t ? width / (Math.max(4, t.text.length) * 0.56) : 0 // about the height of a capital
  // and never under the top bar
  const wordY = useMemo(() => {
    if (!t) return 0
    const room = roomOf(1)
    const top = room.toPx(0, t.y + letter * 0.6, t.z)[1]
    const ppw = Math.abs(room.toPx(0, t.y, t.z)[1] - room.toPx(0, t.y + 1, t.z)[1])
    return t.y - Math.max(0, (room.free.top + 8 - top) / ppw)
  }, [t && t.y, t && t.z, letter, roomOf])
  const captionY = t ? wordY - letter * 0.42 - 0.22 : 0
  const bottom = t ? (t.detail ? captionY - 0.3 : wordY - letter * 0.45) : null
  const layout = useMemo(() => seatLayout(n, roomOf, t ? [bottom, t.z] : null, !!view.showScore), [n, roomOf, bottom, t && t.z, view.showScore])
  const rows = view.cards ? 1 : layout.rows
  return (
    <>
      <ambientLight intensity={0.6} />
      <Rig shot={view.shot} rows={rows} calm={calm} />
      <Galaxy pulseKey={view.key} dim={!!view.cards} calm={calm} />
      <Point y={view.pointY} on={!!view.pointOn} phaseKey={view.key} calm={calm} />
      <WordCloud text={t ? t.text : ''} hotFrom={t && t.landing ? t.text.length - 1 : -1} y={t ? wordY : 2.2} z={t ? t.z : -1} width={width || 6} font={FONT.medium} calm={calm} />
      {t && t.detail ? <Caption text={t.detail} y={captionY} z={t.z} /> : null}
      {view.seats ? <Seats S={view.S} layout={layout} showScore={view.showScore} away={!!view.cards} calm={calm} /> : null}
      {view.cards ? <Cards cards={view.cards} focus={focus} onFocus={setFocus} onPick={onPick} room={roomOf(1)} /> : null}
      <Burst fireKey={view.burstKey} position={[0, 1.7, 1.4]} />
    </>
  )
}
