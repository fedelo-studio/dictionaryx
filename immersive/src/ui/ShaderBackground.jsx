// The fedelo.studio hero field (shader-bg.js on the site, "topo" with the site's tuning): contour lines of a
// slowly flowing warped noise, a little grain, and orange ripples where something happens.
// Its own canvas behind the 3D table, at a low resolution and 30 fps: the field is many noise lookups per pixel.
import { useEffect, useRef } from 'react'

const VS = `attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`
const FS = `
precision highp float;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_time;
uniform vec2 u_cpos[6];
uniform float u_cage[6];
uniform float u_flow;
vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; } return v; }
float rand2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  vec2 stRaw = vec2(uv.x * asp, uv.y);
  vec2 st = stRaw * 0.7;
  float t = u_time * 0.10 * u_flow;
  vec2 ms = vec2(u_mouse.x * asp, u_mouse.y);
  float md = length(stRaw - ms);
  float mg = exp(-md * md * (5.5 / (1.9 * 1.9)));
  vec2 q = vec2(fbm(st + t), fbm(st + vec2(5.2, 1.3) + t * 0.75));
  vec2 r = vec2(fbm(st + 1.2 * q + vec2(1.7, 9.2) + t * 0.5), fbm(st + 1.2 * q + vec2(8.3, 2.8) + t * 0.4));
  float f = fbm(st + 1.32 * r) * 0.5 + 0.5;
  f += mg * 0.12;
  float cf = fract(f * 10.5);
  // a heavier line than the site's 1.2: on a phone, behind a game, the site's hairline disappears
  float pattern = smoothstep(0.06 * 1.7, 0.0, abs(cf - 0.5)) + smoothstep(0.025 * 1.7, 0.0, abs(cf - 0.5)) * 0.5;
  vec3 bg = vec3(0.031);
  vec3 col = mix(bg, vec3(0.22), pattern * 0.62);
  // the lines warm up near the pointer
  col = mix(col, vec3(1.0, 0.29, 0.11), pattern * exp(-md * md * 14.0) * 0.28);
  float ripple = 0.0;
  for (int i = 0; i < 6; i++) {
    float age = u_cage[i];
    if (age >= 0.0 && age < 2.6) {
      vec2 cp = vec2(u_cpos[i].x * asp, u_cpos[i].y);
      float d = length(stRaw - cp);
      float R = age * 0.6; float w = 0.03;
      float ring = smoothstep(R - w, R - w * 0.3, d) - smoothstep(R + w * 0.3, R + w, d);
      ripple += (ring + pattern * smoothstep(R + 0.12, R - 0.05, d) * smoothstep(R - 0.5, R - 0.1, d) * 0.6) * exp(-age * 1.6);
    }
  }
  col = mix(col, vec3(1.0, 0.29, 0.11), clamp(ripple, 0.0, 1.0) * 0.6);
  col += (rand2(uv * 1000.0 + u_time) - 0.5) * 0.1 * 0.35;
  // darker round the edges, so the table stays the light of the room
  float vig = smoothstep(1.25, 0.25, length((uv - vec2(0.5, 0.55)) * vec2(asp * 0.9, 1.0)));
  col *= mix(0.45, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}`

export function ripple(x = 0.5, y = 0.55) {
  window.dispatchEvent(new CustomEvent('dx:ripple', { detail: { x, y } }))
}

export default function ShaderBackground() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!gl) return undefined
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
    const prog = gl.createProgram()
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(prog)
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const U = n => gl.getUniformLocation(prog, n)
    const u = { res: U('u_res'), mouse: U('u_mouse'), time: U('u_time'), cpos: U('u_cpos'), cage: U('u_cage'), flow: U('u_flow') }
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gl.uniform1f(u.flow, calm ? 0 : 0.3)

    const s = { mouse: [-2, -2], lerp: [-2, -2], cpos: new Float32Array(12), born: new Array(6).fill(-99), idx: 0 }
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.75
    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale))
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const t0 = performance.now()
    const now = () => (performance.now() - t0) / 1000
    const addRipple = (x, y) => {
      const i = s.idx++ % 6
      s.cpos[i * 2] = x
      s.cpos[i * 2 + 1] = y
      s.born[i] = now()
    }
    const onMove = e => { s.mouse = [e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight] }
    const onDown = e => addRipple(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight)
    const onRipple = e => addRipple(e.detail.x, e.detail.y)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('dx:ripple', onRipple)

    let raf = 0
    let last = 0
    const frame = ms => {
      raf = requestAnimationFrame(frame)
      if (ms - last < 33) return // 30 fps is enough for a drift this slow
      last = ms
      const t = now()
      s.lerp[0] += (s.mouse[0] - s.lerp[0]) * 0.06
      s.lerp[1] += (s.mouse[1] - s.lerp[1]) * 0.06
      gl.uniform2f(u.res, canvas.width, canvas.height)
      gl.uniform2f(u.mouse, s.lerp[0], s.lerp[1])
      gl.uniform1f(u.time, t)
      gl.uniform2fv(u.cpos, s.cpos)
      gl.uniform1fv(u.cage, s.born.map(b => t - b))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('dx:ripple', onRipple)
    }
  }, [])
  return <canvas ref={ref} className="field" aria-hidden="true" />
}
