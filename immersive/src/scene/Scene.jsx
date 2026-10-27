// The table: a dark round in a dark room, lit by the studio's orange point. The word falls onto it,
// the players sit around it, the definitions are cards dealt in front of you.
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Environment, Lightformer, RoundedBox, Sparkles, Text, useCursor } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { E, statusOf } from '../engine.js'

export const C = {
  bg: '#080808',
  card: '#161616',
  fg: '#f5f5f2',
  dim: '#a9a9a6',
  hot: '#ff4a1c',
  line: '#2a2a28',
}
// Absolute: troika loads fonts from a worker, where a path alone resolves against nothing.
const fontUrl = name => new URL(`/fonts/strawford-${name}-webfont.woff`, location.origin).href
export const FONT = {
  light: fontUrl('light'),
  regular: fontUrl('regular'),
  medium: fontUrl('medium'),
}
const damp = THREE.MathUtils.damp
const TABLE_R = 4.2

/* ---------- room, light and the point ---------- */
function Room({ calm }) {
  return (
    <>
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 9, 24]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[3, 8, 6]} intensity={0.9} />
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={1.2} position={[0, 6, 2]} scale={[8, 2, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="ring" color={C.hot} intensity={2} position={[-6, 2, -4]} scale={3} />
        <Lightformer form="rect" intensity={0.6} position={[6, 1, 2]} scale={[2, 4, 1]} rotation-y={-Math.PI / 2} />
      </Environment>
      <Sparkles count={calm ? 30 : 70} scale={[14, 6, 14]} position={[0, 3, 0]} size={2.2} speed={calm ? 0.1 : 0.25} opacity={0.5} color={C.fg} />
      <Sparkles count={calm ? 8 : 18} scale={[10, 4, 10]} position={[0, 2.5, 0]} size={3.5} speed={calm ? 0.1 : 0.3} opacity={0.8} color={C.hot} />
    </>
  )
}

function Table() {
  return (
    <group>
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <cylinderGeometry args={[TABLE_R, TABLE_R * 1.02, 0.12, 96]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.45} metalness={0.35} />
      </mesh>
      {/* the hairline round the edge, the one orange line of the room */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
        <ringGeometry args={[TABLE_R - 0.04, TABLE_R - 0.025, 128]} />
        <meshBasicMaterial color={C.hot} toneMapped={false} transparent opacity={0.55} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
        <ringGeometry args={[1.2, 1.205, 96]} />
        <meshBasicMaterial color={C.fg} transparent opacity={0.08} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.4, 0]}>
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial color="#050505" roughness={1} />
      </mesh>
    </group>
  )
}

/** The fedelo.studio point: it floats over the table, flares when a phase changes. */
function Point({ phaseKey, calm, y = 4.3 }) {
  const ref = useRef()
  const light = useRef()
  const flare = useRef({ key: phaseKey, t: 0 })
  useFrame((state, dt) => {
    if (flare.current.key !== phaseKey) flare.current = { key: phaseKey, t: 1 }
    flare.current.t = damp(flare.current.t, 0, 2.5, dt)
    const t = state.clock.elapsedTime
    const f = flare.current.t
    ref.current.position.y = damp(ref.current.position.y, y + (calm ? 0 : Math.sin(t * 0.9) * 0.12), 3, dt)
    ref.current.scale.setScalar(0.16 + f * 0.25)
    light.current.intensity = 6 + f * 30
  })
  return (
    <group ref={ref} position={[0, y, -0.6]}>
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={C.hot} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color={C.hot} distance={9} decay={1.6} />
    </group>
  )
}

/* ---------- camera ---------- */
const SHOTS = {
  home: { pos: [0, 3.1, 8.6], look: [0, 1.7, 0] },
  lobby: { pos: [0, 3.6, 8.2], look: [0, 1.1, 0] },
  write: { pos: [0, 3.3, 7.2], look: [0, 1.6, 0] },
  cards: { pos: [0, 2.3, 6.3], look: [0, 1.75, 0.6] },
  scores: { pos: [0, 4.1, 8.8], look: [0, 1.7, -0.6] },
}
function Rig({ shot, calm }) {
  const look = useRef(new THREE.Vector3(...SHOTS.home.look))
  const offset = useRef({ x: 0, y: 0 })
  const { size } = useThree()
  useFrame((state, dt) => {
    const s = SHOTS[shot] || SHOTS.home
    // a phone held upright sees less width: step back
    const back = size.width < size.height ? 1 + (size.height / size.width - 1) * 0.55 : 1
    const px = calm ? 0 : state.pointer.x * 0.45
    const py = calm ? 0 : state.pointer.y * 0.25
    const cam = state.camera
    cam.position.x = damp(cam.position.x, s.pos[0] + px, 2.2, dt)
    cam.position.y = damp(cam.position.y, s.pos[1] * (0.9 + back * 0.1) + py, 2.2, dt)
    cam.position.z = damp(cam.position.z, s.pos[2] * back, 2.2, dt)
    look.current.x = damp(look.current.x, s.look[0], 2.6, dt)
    look.current.y = damp(look.current.y, s.look[1], 2.6, dt)
    look.current.z = damp(look.current.z, s.look[2], 2.6, dt)
    cam.lookAt(look.current)
    // keep the table clear of the panel: left of it on a wide screen, above it on a phone held upright
    const wide = size.width >= 960
    const ox = wide ? Math.min(280, size.width * 0.18) : 0
    const oy = !wide && size.width < size.height ? size.height * 0.2 : 0
    offset.current.x = damp(offset.current.x, ox, 3, dt)
    offset.current.y = damp(offset.current.y, oy, 3, dt)
    cam.setViewOffset(size.width, size.height, offset.current.x, offset.current.y, size.width, size.height)
  })
  return null
}

/* ---------- the word ---------- */
/** The headword drops onto the table, as in a dictionary: big, then its details under it. */
export function Headword({ text, detail, y = 2.4, z = -0.8, landing }) {
  const group = useRef()
  const fall = useRef({ text: null, t: 0 })
  const { size } = useThree()
  const narrow = size.width < size.height
  const len = Math.max(6, text.length)
  const fontSize = Math.min(landing ? 1.5 : 1.15, (narrow ? (landing ? 5.2 : 4.3) : 8.5) / (len * 0.56))
  useFrame((state, dt) => {
    if (fall.current.text !== text) fall.current = { text, t: 1 }
    fall.current.t = damp(fall.current.t, 0, 3.2, dt)
    const t = fall.current.t
    const g = group.current
    g.position.y = damp(g.position.y, y + t * 2.5, 6, dt) + (landing ? Math.sin(state.clock.elapsedTime * 0.6) * 0.004 : 0)
    g.position.z = z
    g.rotation.x = -t * 0.9
    g.scale.setScalar(1 - t * 0.25)
  })
  return (
    <group ref={group} position={[0, y + 2.5, z]}>
      <Text
        font={FONT.regular}
        fontSize={fontSize}
        letterSpacing={-0.035}
        anchorX="center"
        anchorY="bottom"
        color={C.fg}
        colorRanges={landing ? { 0: C.fg, [text.length - 1]: C.hot } : undefined}
        outlineWidth={0}
      >
        {text}
      </Text>
      {detail ? (
        <Text font={FONT.light} fontSize={Math.max(0.2, fontSize * 0.24)} anchorX="center" anchorY="top" position={[0, -0.12, 0]} color={C.dim}>
          {detail}
        </Text>
      ) : null}
    </group>
  )
}

/* ---------- players round the table ---------- */
function seatPositions(n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? -Math.PI / 2 : THREE.MathUtils.lerp(-Math.PI * 0.92, -Math.PI * 0.08, i / (n - 1))
    out.push([Math.cos(a) * 2.75, 0, Math.sin(a) * 2.4 - 0.2])
  }
  return out
}

function Seat({ u, pos, S, score, maxScore, showScore, isLead }) {
  const orb = useRef()
  const pillar = useRef()
  const card = useRef()
  const st = statusOf(u, S)
  const me = u === E.rt.me
  const online = E.data.online.has(u)
  const color = E.avatarOf(u).color
  const typing = st && st.c === 'typing'
  const done = st && st.c === 'done'
  const target = showScore ? 0.2 + (maxScore ? score / maxScore : 0) * 2.4 : 0.02
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    pillar.current.scale.y = damp(pillar.current.scale.y, target, 3, dt)
    pillar.current.position.y = pillar.current.scale.y / 2
    const top = pillar.current.scale.y
    orb.current.position.y = damp(orb.current.position.y, top + 0.42 + (typing ? Math.sin(t * 8) * 0.05 : Math.sin(t * 1.4 + pos[0]) * 0.03), 6, dt)
    orb.current.scale.setScalar(damp(orb.current.scale.x, typing ? 1.12 : 1, 6, dt))
    card.current.position.y = damp(card.current.position.y, done ? 0.03 : 1.6, 5, dt)
    card.current.rotation.z = damp(card.current.rotation.z, done ? 0 : 1.2, 5, dt)
    card.current.visible = card.current.position.y < 1.55
  })
  return (
    <group position={pos}>
      <mesh ref={pillar} scale={[1, 0.02, 1]}>
        <boxGeometry args={[0.62, 1, 0.62]} />
        <meshStandardMaterial
          color={isLead ? C.hot : '#1b1b1a'}
          emissive={isLead ? C.hot : '#000000'}
          emissiveIntensity={isLead ? 0.9 : 0}
          roughness={0.35}
          metalness={0.4}
          toneMapped={!isLead}
        />
      </mesh>
      <group ref={orb} position={[0, 0.44, 0]}>
        <mesh>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={online ? 0.55 : 0.08} roughness={0.3} metalness={0.2} />
        </mesh>
        {me ? (
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.42, 0.018, 12, 64]} />
            <meshBasicMaterial color={C.hot} toneMapped={false} />
          </mesh>
        ) : null}
        <Billboard position={[0, 0.62, 0]}>
          <Text font={FONT.medium} fontSize={0.24} anchorX="center" anchorY="bottom" color={C.fg} maxWidth={2}>
            {E.nameOf(u)}{me ? ' (toi)' : ''}
          </Text>
          <Text font={FONT.regular} fontSize={0.17} anchorX="center" anchorY="top" position={[0, -0.04, 0]} color={st && ['typing', 'lead', 'gain'].includes(st.c) ? C.hot : C.dim}>
            {showScore ? `${score} pt${score > 1 ? 's' : ''}${st && st.c === 'gain' ? '  ' + st.t : ''}` : st ? st.t : online ? 'en ligne' : ''}
          </Text>
        </Billboard>
      </group>
      {/* the bluff, dealt face down in front of the player once it is written */}
      <group ref={card} position={[0, 1.6, 0.75]} rotation-x={-Math.PI / 2}>
        <RoundedBox args={[0.7, 0.48, 0.02]} radius={0.04} smoothness={3}>
          <meshStandardMaterial color={C.card} roughness={0.5} metalness={0.2} />
        </RoundedBox>
        <mesh position={[0.24, -0.15, 0.012]}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color={C.hot} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function Seats({ S, showScore }) {
  const goal = (S && S.settings && S.settings.target) || 15
  const order = E.seatsOf(E.data.players)
  const pos = useMemo(() => seatPositions(order.length), [order.length])
  const scores = (S && S.scores) || {}
  const max = Math.max(goal, ...order.map(u => scores[u] || 0))
  const top = Math.max(0, ...order.map(u => scores[u] || 0))
  return order.map((u, i) => (
    <Seat
      key={u}
      u={u}
      pos={pos[i]}
      S={S}
      score={scores[u] || 0}
      maxScore={max}
      showScore={showScore}
      isLead={showScore && top > 0 && (scores[u] || 0) === top}
    />
  ))
}

/* ---------- the definitions, dealt as cards ---------- */
function Card({ i, focus, card, onFocus, onPick, scale }) {
  const ref = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover && card.clickable)
  const d = i - focus
  const front = d === 0
  useFrame((state, dt) => {
    const g = ref.current
    const x = d * 1.85 * scale
    const z = 1.5 - Math.min(3, Math.abs(d)) * 0.85
    const y = 1.62 + (front && hover ? 0.06 : 0) + (front ? Math.sin(state.clock.elapsedTime * 1.3) * 0.015 : 0)
    g.position.x = damp(g.position.x, x, 5, dt)
    g.position.y = damp(g.position.y, y, 5, dt)
    g.position.z = damp(g.position.z, z, 5, dt)
    g.rotation.y = damp(g.rotation.y, -d * 0.5, 5, dt)
    const s = (front ? 1 : 0.84) * scale
    g.scale.setScalar(damp(g.scale.x, s, 5, dt))
  })
  const W = 2.5
  const H = 1.62
  const long = card.text.length
  const fontSize = long > 220 ? 0.098 : long > 140 ? 0.114 : long > 80 ? 0.13 : 0.15
  const negative = card.variant === 'on'
  const face = negative ? C.fg : C.card
  const ink = negative ? C.bg : card.variant === 'own' || card.variant === 'fake' ? C.dim : C.fg
  const edge = card.variant === 'true' ? C.hot : card.variant === 'truth' ? C.hot : null
  return (
    <group
      ref={ref}
      position={[d * 2, 1.4, 0]}
      onClick={e => {
        e.stopPropagation()
        if (!front) onFocus(i)
        else if (card.clickable) onPick(card.k)
      }}
      onPointerOver={e => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <RoundedBox args={[W, H, 0.035]} radius={0.07} smoothness={4}>
        <meshStandardMaterial color={face} roughness={0.55} metalness={negative ? 0 : 0.15} />
      </RoundedBox>
      {edge ? (
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[W + 0.08, H + 0.08]} />
          <meshBasicMaterial color={edge} toneMapped={false} />
        </mesh>
      ) : null}
      <Text font={FONT.medium} fontSize={0.12} anchorX="left" anchorY="top" position={[-W / 2 + 0.16, H / 2 - 0.14, 0.02]} color={negative ? C.bg : C.hot}>
        {String(i + 1).padStart(2, '0')}
      </Text>
      {card.tag ? (
        <Text font={FONT.medium} fontSize={0.085} letterSpacing={0.08} anchorX="right" anchorY="top" position={[W / 2 - 0.16, H / 2 - 0.155, 0.02]} color={card.tagHot ? C.hot : negative ? C.bg : C.dim}>
          {card.tag.toUpperCase()}
        </Text>
      ) : null}
      <Text
        font={FONT.light}
        fontSize={fontSize}
        lineHeight={1.4}
        maxWidth={W - 0.36}
        anchorX="left"
        anchorY="top"
        position={[-W / 2 + 0.18, H / 2 - 0.4, 0.02]}
        color={ink}
      >
        {card.text}
      </Text>
      {card.footer ? (
        <Text font={FONT.regular} fontSize={0.1} maxWidth={W - 0.36} anchorX="left" anchorY="bottom" position={[-W / 2 + 0.18, -H / 2 + 0.14, 0.02]} color={card.footerHot ? C.hot : C.dim}>
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
  return (
    <>
      <Room calm={calm} />
      <Rig shot={view.shot} calm={calm} />
      <Table />
      <Point phaseKey={view.key} calm={calm} y={view.pointY} />
      {view.title ? <Headword text={view.title.text} detail={view.title.detail} y={view.title.y} z={view.title.z} landing={view.title.landing} /> : null}
      {view.seats ? <Seats S={view.S} showScore={view.showScore} /> : null}
      {view.cards ? <Cards cards={view.cards} focus={focus} onFocus={setFocus} onPick={onPick} /> : null}
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.62} luminanceSmoothing={0.2} />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    </>
  )
}
