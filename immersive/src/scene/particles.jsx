// The word and the table are made of light: soft round points, added to each other, moved on the GPU.
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'

const HOT = new THREE.Color('#ff6a3a')
const FG = new THREE.Color('#f5f5f2')

// Ashima's 3D simplex noise (MIT), for drift and swirl.
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`

// A soft round point with a bright core: added up, a few thousand of them read as light, not dots.
const POINT_FS = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a * (0.55 + 0.45 * smoothstep(0.22, 0.0, d));
  if (a < 0.01) discard;
  float k = a * vAlpha;
  gl_FragColor = vec4(min(vColor, vec3(1.0)) * k, k);
}`

const pointMaterial = (vertexShader, uniforms) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: POINT_FS,
    uniforms,
    transparent: true,
    depthWrite: false,
    // added up as light, already premultiplied: the canvas over the field stays clean round each point
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  })

const isPhone = () => Math.min(window.innerWidth, window.innerHeight) < 600

/* ---------- the word, as a cloud of light ---------- */
const WORD_VS = /* glsl */ `
${NOISE}
attribute vec3 aFrom;
attribute vec3 aTo;
attribute vec4 aRand;   // delay, size, phase, swirl
attribute vec3 aColor;
uniform float uTime, uStart, uDur, uPixel, uSize, uCalm;
uniform float uSettle;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float p = clamp((uTime - uStart - aRand.x * 0.9) / uDur, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - p, 4.0);
  vec3 pos = mix(aFrom, aTo, e);
  // on the way, the particles swirl through a noise field; once there, they only breathe
  float travel = sin(3.14159 * p);
  vec3 n = vec3(snoise(aTo * 0.35 + uTime * 0.25), snoise(aTo * 0.35 + 17.0 + uTime * 0.25), snoise(aTo * 0.35 + 41.0));
  pos += n * travel * (1.4 + aRand.w * 1.6) * (1.0 - uCalm);
  pos += vec3(sin(uTime * 0.9 + aRand.z * 6.28), cos(uTime * 0.7 + aRand.z * 6.28), 0.0) * 0.012 * (1.0 - uCalm);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aRand.y * uPixel * (10.0 / -mv.z);
  vColor = aColor * (1.0 + travel * 0.6);
  // once the word has landed, the real letters take over and the cloud is gone
  vAlpha = (0.55 + 0.45 * (1.0 - travel)) * (1.0 - uSettle);
}`

// Where the particles of a text go: the text drawn on a hidden canvas, its lit pixels sampled.
function sampleText(text, hotFrom, width, count) {
  const W = 1400
  const H = 420
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  let size = 300
  g.font = `500 ${size}px Strawford, system-ui, sans-serif`
  const m = g.measureText(text)
  size = Math.min(300, (300 * (W * 0.94)) / Math.max(1, m.width))
  g.font = `500 ${size}px Strawford, system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  // the orange part of the text (the x of the logo) is drawn in the red channel only
  const head = hotFrom >= 0 ? text.slice(0, hotFrom) : text
  const tail = hotFrom >= 0 ? text.slice(hotFrom) : ''
  const total = g.measureText(text).width
  const headW = g.measureText(head).width
  g.textAlign = 'left'
  g.lineJoin = 'round'
  g.lineWidth = size * 0.045
  g.fillStyle = g.strokeStyle = '#fff'
  g.fillText(head, W / 2 - total / 2, H / 2)
  g.strokeText(head, W / 2 - total / 2, H / 2)
  g.fillStyle = g.strokeStyle = '#f00'
  g.fillText(tail, W / 2 - total / 2 + headW, H / 2)
  g.strokeText(tail, W / 2 - total / 2 + headW, H / 2)
  const px = g.getImageData(0, 0, W, H).data
  const lit = []
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4
      if (px[i + 3] > 140) lit.push([x, y, px[i + 1] < 100 ? 1 : 0])
    }
  }
  const scale = width / (total || 1)
  const out = new Float32Array(count * 3)
  const hot = new Uint8Array(count)
  for (let k = 0; k < count; k++) {
    const s = lit.length ? lit[(Math.random() * lit.length) | 0] : [W / 2, H / 2, 0]
    out[k * 3] = (s[0] + Math.random() * 2 - W / 2) * scale
    out[k * 3 + 1] = -(s[1] + Math.random() * 2 - H / 2) * scale
    out[k * 3 + 2] = (Math.random() - 0.5) * 0.08
    hot[k] = s[2]
  }
  // the same text set in type, where the particles drew it
  const type = { head, tail, size: size * scale, x: -(total / 2) * scale, tailX: (headW - total / 2) * scale }
  return { pos: out, hot, type }
}

function nebula(count, spread = 1) {
  const out = new Float32Array(count * 3)
  for (let k = 0; k < count; k++) {
    const u = Math.random() * Math.PI * 2
    const v = Math.acos(2 * Math.random() - 1)
    const r = Math.cbrt(Math.random()) * 2.6 * spread
    out[k * 3] = Math.sin(v) * Math.cos(u) * r * 1.6
    out[k * 3 + 1] = Math.cos(v) * r * 0.55
    out[k * 3 + 2] = Math.sin(v) * Math.sin(u) * r * 0.8
  }
  return out
}

/** The word in play. A new word gathers out of the previous one; no word is a slow nebula. */
export function WordCloud({ text, hotFrom = -1, y = 2.4, z = -1, width = 7, font, calm }) {
  const [type, setType] = useState(null)
  const settle = useRef(0)
  const head = useRef()
  const tail = useRef()
  const count = useMemo(() => (isPhone() ? 3500 : 6000), [])
  const state = useRef({ start: 0, from: null, to: null, rand: null, ready: false })
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const rand = new Float32Array(count * 4)
    const color = new Float32Array(count * 3)
    for (let k = 0; k < count; k++) {
      rand[k * 4] = Math.random()
      rand[k * 4 + 1] = 0.75 + Math.random() * 0.45
      rand[k * 4 + 2] = Math.random()
      rand[k * 4 + 3] = Math.random()
    }
    const from = nebula(count)
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aFrom', new THREE.BufferAttribute(from, 3))
    g.setAttribute('aTo', new THREE.BufferAttribute(from.slice(), 3))
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 4))
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50)
    state.current.rand = rand
    return g
  }, [count])
  const mat = useMemo(
    () =>
      pointMaterial(WORD_VS, {
        uTime: { value: 0 },
        uStart: { value: -10 },
        uDur: { value: 1.9 },
        uPixel: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uSize: { value: isPhone() ? 2.4 : 2.6 },
        uCalm: { value: calm ? 1 : 0 },
        uSettle: { value: 0 },
      }),
    [],
  )
  const group = useRef()

  // a new text: every particle leaves from where it is now
  useEffect(() => {
    let cancelled = false
    const go = async () => {
      try { await document.fonts.load('500 120px Strawford') } catch { /* system font then */ }
      if (cancelled) return
      const s = state.current
      // the type goes at once: the particles, still in its shape, carry the change
      s.ready = false
      settle.current = 0
      mat.uniforms.uSettle.value = 0
      const fromA = geo.getAttribute('aFrom')
      const toA = geo.getAttribute('aTo')
      const colA = geo.getAttribute('aColor')
      const t = mat.uniforms.uTime.value
      const dur = mat.uniforms.uDur.value
      for (let k = 0; k < count; k++) {
        const p = Math.min(1, Math.max(0, (t - mat.uniforms.uStart.value - s.rand[k * 4] * 0.9) / dur))
        const e = 1 - Math.pow(1 - p, 4)
        for (let a = 0; a < 3; a++) fromA.array[k * 3 + a] = fromA.array[k * 3 + a] + (toA.array[k * 3 + a] - fromA.array[k * 3 + a]) * e
      }
      const target = text ? sampleText(text, hotFrom, width, count) : { pos: nebula(count), hot: new Uint8Array(count) }
      toA.array.set(target.pos)
      for (let k = 0; k < count; k++) {
        const c = target.hot[k] ? HOT : FG
        const dim = text ? 0.9 + Math.random() * 0.1 : 0.25 + Math.random() * 0.3
        // a few warm sparks inside the white text
        const spark = !target.hot[k] && Math.random() < (text ? 0.012 : 0.1)
        const cc = spark ? HOT : c
        colA.array[k * 3] = cc.r * dim
        colA.array[k * 3 + 1] = cc.g * dim
        colA.array[k * 3 + 2] = cc.b * dim
      }
      fromA.needsUpdate = true
      toA.needsUpdate = true
      colA.needsUpdate = true
      mat.uniforms.uStart.value = t
      setType(text ? target.type : null)
      s.ready = true
    }
    go()
    return () => { cancelled = true }
  }, [text, hotFrom, width])

  useFrame((st, dt) => {
    const u = mat.uniforms
    u.uTime.value += dt
    // the last particles land about 2.8 s after the start: the type fades in as they do
    const landed = state.current.ready && text && u.uTime.value - u.uStart.value > 0.9 + u.uDur.value * 0.8
    settle.current = THREE.MathUtils.damp(settle.current, landed ? 1 : 0, 2.6, dt)
    u.uSettle.value = settle.current
    for (const r of [head, tail]) if (r.current) r.current.fillOpacity = settle.current
    const g = group.current
    g.position.y = THREE.MathUtils.damp(g.position.y, y, 3, dt)
    g.position.z = THREE.MathUtils.damp(g.position.z, z, 3, dt)
  })
  return (
    <group ref={group} position={[0, y, z]}>
      <points geometry={geo} material={mat} frustumCulled={false} />
      {type ? (
        <>
          <Text ref={head} font={font} fontSize={type.size} anchorX="left" anchorY="middle" position={[type.x, 0, 0.02]} color="#f5f5f2" fillOpacity={0} renderOrder={2}>
            {type.head}
          </Text>
          {type.tail ? (
            <Text ref={tail} font={font} fontSize={type.size} anchorX="left" anchorY="middle" position={[type.tailX, 0, 0.02]} color="#ff4a1c" fillOpacity={0} renderOrder={2}>
              {type.tail}
            </Text>
          ) : null}
        </>
      ) : null}
    </group>
  )
}

/* ---------- the table: a slow galaxy ---------- */
const GALAXY_VS = /* glsl */ `
attribute vec4 aOrbit;  // radius, angle, height, rand
attribute vec3 aColor;
uniform float uTime, uPixel, uSize, uCalm, uDim;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = aOrbit.x;
  float a = aOrbit.y + uTime * (0.9 / (r + 0.6)) * 0.12 * (1.0 - uCalm * 0.9);
  vec3 pos = vec3(cos(a) * r, aOrbit.z + sin(uTime * 0.6 + aOrbit.w * 6.28) * 0.015, sin(a) * r);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + aOrbit.w) * uPixel * (10.0 / -mv.z);
  vColor = aColor;
  vAlpha = 0.5 * uDim;
}`

export function Galaxy({ dim, calm }) {
  const count = useMemo(() => (isPhone() ? 1200 : 2200), [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const orbit = new Float32Array(count * 4)
    const color = new Float32Array(count * 3)
    for (let k = 0; k < count; k++) {
      // most of the stars in a band, a few spread in towards the centre
      const band = Math.random() < 0.78
      const r = band ? 3.2 + (Math.random() + Math.random() - 1) * 0.55 : 0.6 + Math.random() * 3.4
      orbit[k * 4] = r
      orbit[k * 4 + 1] = Math.random() * Math.PI * 2
      orbit[k * 4 + 2] = (Math.random() - 0.5) * (band ? 0.12 : 0.05)
      orbit[k * 4 + 3] = Math.random()
      const warm = Math.random() < 0.06
      const b = band ? 0.45 + Math.random() * 0.4 : 0.18 + Math.random() * 0.2
      const c = warm ? HOT : FG
      color[k * 3] = c.r * b
      color[k * 3 + 1] = c.g * b
      color[k * 3 + 2] = c.b * b
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4))
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50)
    return g
  }, [count])
  const mat = useMemo(
    () =>
      pointMaterial(GALAXY_VS, {
        uTime: { value: 0 },
        uPixel: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uSize: { value: isPhone() ? 2.2 : 1.9 },
        uCalm: { value: calm ? 1 : 0 },
        uDim: { value: 1 },
      }),
    [],
  )
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
    // quieter while the cards are read
    mat.uniforms.uDim.value = THREE.MathUtils.damp(mat.uniforms.uDim.value, dim ? 0.35 : 1, 3, dt)
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}
