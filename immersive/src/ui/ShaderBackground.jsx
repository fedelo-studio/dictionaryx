// The fedelo.studio hero field (shader-bg.js on the site, "topo" with the site's tuning): contour lines of a
// slowly flowing warped noise and a little grain. Nothing else moves in it: the table does the moving.
// Its own canvas behind the 3D table, at a low resolution and 30 fps: the field is many noise lookups per pixel.
import { useEffect, useRef } from 'react'

const VS = `attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`
const FS = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
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
  vec2 q = vec2(fbm(st + t), fbm(st + vec2(5.2, 1.3) + t * 0.75));
  vec2 r = vec2(fbm(st + 1.2 * q + vec2(1.7, 9.2) + t * 0.5), fbm(st + 1.2 * q + vec2(8.3, 2.8) + t * 0.4));
  float f = fbm(st + 1.32 * r) * 0.5 + 0.5;
  float cf = fract(f * 10.5);
  // a heavier line than the site's 1.2: on a phone, behind a game, the site's hairline disappears
  float pattern = smoothstep(0.06 * 1.7, 0.0, abs(cf - 0.5)) + smoothstep(0.025 * 1.7, 0.0, abs(cf - 0.5)) * 0.5;
  vec3 bg = vec3(0.031);
  // quieter where the word and the cards are read
  float centre = exp(-dot((uv - vec2(0.42, 0.62)) * vec2(asp, 1.0), (uv - vec2(0.42, 0.62)) * vec2(asp, 1.0)) * 3.0);
  vec3 col = mix(bg, vec3(0.22), pattern * mix(0.5, 0.18, centre));
  col += (rand2(uv * 1000.0 + u_time) - 0.5) * 0.1 * 0.35;
  // darker round the edges, so the table stays the light of the room
  float vig = smoothstep(1.25, 0.25, length((uv - vec2(0.5, 0.55)) * vec2(asp * 0.9, 1.0)));
  col *= mix(0.45, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}`

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
    const u = { res: U('u_res'), time: U('u_time'), flow: U('u_flow') }
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gl.uniform1f(u.flow, calm ? 0 : 0.3)

    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.75
    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale))
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const t0 = performance.now()
    const now = () => (performance.now() - t0) / 1000
    window.addEventListener('resize', resize)

    let raf = 0
    let last = 0
    const frame = ms => {
      raf = requestAnimationFrame(frame)
      if (ms - last < 33) return // 30 fps is enough for a drift this slow
      last = ms
      gl.uniform2f(u.res, canvas.width, canvas.height)
      gl.uniform1f(u.time, now())
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={ref} className="field" aria-hidden="true" />
}
