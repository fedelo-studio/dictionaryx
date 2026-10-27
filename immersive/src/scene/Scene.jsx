// The table is made of light: the fedelo.studio field behind (ShaderBackground), a slow galaxy for the table,
// the word as a cloud of particles, each player a swarm of their colour, the definitions dealt as glass cards.
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Text, useCursor } from '@react-three/drei'
import { E, statusOf } from '../engine.js'
import { Burst, Galaxy, Swarm, WordCloud } from './particles.jsx'

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
function Rig({ shot, calm }) {
  const look = useRef(new THREE.Vector3(...SHOTS.home.look))
  const offset = useRef({ x: 0, y: 0 })
  const { size } = useThree()
  useFrame((state, dt) => {
    const s = SHOTS[shot] || SHOTS.home
    const back = size.width < size.height ? 1 + (size.height / size.width - 1) * 0.55 : 1
    const t = state.clock.elapsedTime
    // a slow breath of the camera, and the pointer's parallax
    const drift = calm ? 0 : Math.sin(t * 0.12) * 0.35
    const px = calm ? 0 : state.pointer.x * 0.5
    const py = calm ? 0 : state.pointer.y * 0.3
    const cam = state.camera
    cam.position.x = damp(cam.position.x, s.pos[0] + px + drift, 2, dt)
    cam.position.y = damp(cam.position.y, s.pos[1] * (0.9 + back * 0.1) + py, 2, dt)
    cam.position.z = damp(cam.position.z, s.pos[2] * back, 2, dt)
    look.current.x = damp(look.current.x, s.look[0], 2.4, dt)
    look.current.y = damp(look.current.y, s.look[1], 2.4, dt)
    look.current.z = damp(look.current.z, s.look[2], 2.4, dt)
    cam.lookAt(look.current)
    // keep the table clear of the panel: left of it on a wide screen, above it on a phone held upright
    const wide = size.width >= 960
    offset.current.x = damp(offset.current.x, wide ? Math.min(280, size.width * 0.18) : 0, 3, dt)
    offset.current.y = damp(offset.current.y, !wide && size.width < size.height ? size.height * 0.2 : 0, 3, dt)
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

function Point({ y = 4.3, phaseKey, calm }) {
  const ref = useRef()
  const halo = useRef()
  const flare = useRef({ key: phaseKey, t: 0 })
  useFrame((state, dt) => {
    if (flare.current.key !== phaseKey) flare.current = { key: phaseKey, t: 1 }
    flare.current.t = damp(flare.current.t, 0, 2, dt)
    const f = flare.current.t
    const t = state.clock.elapsedTime
    ref.current.position.y = damp(ref.current.position.y, y + (calm ? 0 : Math.sin(t * 0.8) * 0.1), 3, dt)
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
function seatPositions(n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? -Math.PI / 2 : THREE.MathUtils.lerp(-Math.PI * 0.92, -Math.PI * 0.08, i / (n - 1))
    out.push([Math.cos(a) * 2.75, 0.55, Math.sin(a) * 2.4 - 0.2])
  }
  return out
}

function Seat({ u, pos, S, score, maxScore, showScore, isLead, calm }) {
  const group = useRef()
  const label = useRef()
  const st = statusOf(u, S)
  const me = u === E.rt.me
  const online = E.data.online.has(u)
  const color = isLead ? C.hot : E.avatarOf(u).color
  const column = showScore ? 0.3 + (maxScore ? score / maxScore : 0) * 2.4 : 0
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    group.current.position.y = pos[1] + (calm ? 0 : Math.sin(t * 1.2 + pos[0]) * 0.04)
    label.current.position.y = damp(label.current.position.y, 0.62 + (showScore ? column - 0.2 : 0), 3, dt)
  })
  const line = showScore
    ? `${score} pt${score > 1 ? 's' : ''}${st && st.c === 'gain' ? '   ' + st.t : ''}`
    : st ? st.t : online ? 'en ligne' : 'absent'
  return (
    <group ref={group} position={pos}>
      <Swarm color={online || showScore ? color : '#3a3a38'} agitate={st && st.c === 'typing' ? 1 : 0} ready={st && st.c === 'done' ? 1 : 0} column={column} me={me} calm={calm} />
      <Billboard ref={label} position={[0, 0.62, 0]}>
        <Text font={FONT.medium} fontSize={0.27} anchorX="center" anchorY="bottom" color={C.fg} maxWidth={2.4}>
          {E.nameOf(u)}{me ? ' (toi)' : ''}
        </Text>
        <Text font={FONT.medium} fontSize={0.18} letterSpacing={0.04} anchorX="center" anchorY="top" position={[0, -0.05, 0]} color={(st && ['typing', 'lead', 'gain'].includes(st.c)) || isLead ? C.hot : C.dim}>
          {line}
        </Text>
      </Billboard>
    </group>
  )
}

function Seats({ S, showScore, calm }) {
  const order = E.seatsOf(E.data.players)
  const pos = useMemo(() => seatPositions(order.length), [order.length])
  const scores = (S && S.scores) || {}
  const goal = (S && S.settings && S.settings.target) || 15
  const max = Math.max(goal, ...order.map(u => scores[u] || 0))
  const top = Math.max(0, ...order.map(u => scores[u] || 0))
  return order.map((u, i) => (
    <Seat key={u} u={u} pos={pos[i]} S={S} score={scores[u] || 0} maxScore={max} showScore={showScore} isLead={showScore && top > 0 && (scores[u] || 0) === top} calm={calm} />
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
  float a = max(fill * 0.94, edge);
  vec3 col = face * a + uEdge * glow;
  gl_FragColor = vec4(col, max(a, glow) * uOpacity);
}`

const CARD_GREY = new THREE.Color('#5a5a56')
const CARD_HOVER = new THREE.Color('#a3a39e')
const CARD_HOT = new THREE.Color(C.hot)
const CARD_FACE = new THREE.Color(C.card)
const CARD_NEG = new THREE.Color(C.fg)

function Card({ i, focus, card, onFocus, onPick, scale }) {
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
    const x = d * 1.9 * scale
    const z = 1.5 - Math.min(3, Math.abs(d)) * 0.9
    const y = 1.66 + (front && hover ? 0.05 : 0) + (front ? Math.sin(state.clock.elapsedTime * 1.2) * 0.02 : 0)
    g.position.x = damp(g.position.x, x, 4.5, dt)
    g.position.y = damp(g.position.y, y, 4.5, dt)
    g.position.z = damp(g.position.z, z, 4.5, dt)
    g.rotation.y = damp(g.rotation.y, -d * 0.48, 4.5, dt)
    g.rotation.z = damp(g.rotation.z, 0, 4, dt)
    g.scale.setScalar(damp(g.scale.x, (front ? 1 : 0.84) * scale, 4.5, dt))
    const u = mat.uniforms
    const k = 1 - Math.exp(-6 * dt)
    u.uOpacity.value = damp(u.uOpacity.value, 1, 3, dt)
    u.uFace.value.lerp(negative ? CARD_NEG : CARD_FACE, k)
    u.uEdge.value.lerp(hot || negative ? CARD_HOT : hover ? CARD_HOVER : CARD_GREY, k)
    u.uEdgeW.value = damp(u.uEdgeW.value, hot || negative ? 0.045 : 0.022, 6, dt)
    u.uGlow.value = damp(u.uGlow.value, hot ? 1.3 : negative ? 0.6 : 0, 4, dt)
  })
  const long = card.text.length
  const fontSize = long > 220 ? 0.1 : long > 140 ? 0.116 : long > 80 ? 0.134 : 0.155
  const ink = negative ? '#0b0b0b' : card.variant === 'own' || card.variant === 'fake' ? C.dim : C.fg
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
      <mesh material={mat}>
        <planeGeometry args={[W + 0.16, H + 0.16]} />
      </mesh>
      <Text font={FONT.medium} fontSize={0.13} anchorX="left" anchorY="top" position={[-W / 2 + 0.2, H / 2 - 0.18, 0.01]} color={negative ? '#0b0b0b' : C.hot}>
        {String(i + 1).padStart(2, '0')}
      </Text>
      {card.tag ? (
        <Text font={FONT.medium} fontSize={0.095} letterSpacing={0.08} anchorX="right" anchorY="top" position={[W / 2 - 0.2, H / 2 - 0.195, 0.01]} color={card.tagHot ? C.hot : negative ? '#0b0b0b' : C.dim}>
          {card.tag.toUpperCase()}
        </Text>
      ) : null}
      <Text font={FONT.regular} fontSize={fontSize} lineHeight={1.38} maxWidth={W - 0.42} anchorX="left" anchorY="top" position={[-W / 2 + 0.21, H / 2 - 0.46, 0.01]} color={ink}>
        {card.text}
      </Text>
      {card.footer ? (
        <Text font={FONT.medium} fontSize={0.105} maxWidth={W - 0.42} anchorX="left" anchorY="bottom" position={[-W / 2 + 0.21, -H / 2 + 0.17, 0.01]} color={card.footerHot ? C.hot : C.dim}>
          {card.footer}
        </Text>
      ) : null}
    </group>
  )
}

function Cards({ cards, focus, onFocus, onPick }) {
  const { size } = useThree()
  const scale = size.width < size.height ? Math.max(0.74, (size.width / size.height) * 1.5) : 1
  return cards.map((card, i) => <Card key={card.k} i={i} focus={focus} card={card} onFocus={onFocus} onPick={onPick} scale={scale} />)
}

/* ---------- the whole scene ---------- */
export default function Scene({ view, focus, setFocus, onPick }) {
  const calm = E.reducedMotion()
  const { size } = useThree()
  const narrow = size.width < size.height
  const t = view.title
  const width = t ? (narrow ? t.width * 0.56 : t.width) : 0
  return (
    <>
      <ambientLight intensity={0.6} />
      <Rig shot={view.shot} calm={calm} />
      <Galaxy pulseKey={view.key} calm={calm} />
      <Point y={view.pointY} phaseKey={view.key} calm={calm} />
      <WordCloud text={t ? t.text : ''} hotFrom={t && t.landing ? t.text.length - 1 : -1} y={t ? t.y : 2.2} z={t ? t.z : -1} width={width || 6} calm={calm} />
      {t && t.detail ? <Caption text={t.detail} y={t.y - (width / (Math.max(4, t.text.length) * 0.56)) * 0.42 - 0.22} z={t.z} /> : null}
      {view.seats ? <Seats S={view.S} showScore={view.showScore} calm={calm} /> : null}
      {view.cards ? <Cards cards={view.cards} focus={focus} onFocus={setFocus} onPick={onPick} /> : null}
      <Burst fireKey={view.burstKey} position={[0, 1.7, 1.4]} />
    </>
  )
}
