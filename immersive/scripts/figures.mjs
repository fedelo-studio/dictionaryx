// Turns the figurines into clouds of points: each OBJ of Quaternius's Farm Animals pack (CC0) is sampled on its
// surface, laid in profile, one unit tall, and written with the lightness of its material at each point.
// The models stay out of the repository; only src/scene/figures.json does.
//   node scripts/figures.mjs "<folder with the pack's OBJ and MTL files>"
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

const DIR = process.argv[2]
if (!DIR) throw new Error('Usage: node scripts/figures.mjs <OBJ folder>')
const COUNT = 1100
// id, French name, file; the order is the order of the picker
const FIGS = [
  ['vache', 'Vache', 'Cow'],
  ['cheval', 'Cheval', 'Horse'],
  ['lama', 'Lama', 'Llama'],
  ['cochon', 'Cochon', 'Pig'],
  ['carlin', 'Carlin', 'Pug'],
  ['mouton', 'Mouton', 'Sheep'],
  ['zebre', 'Zèbre', 'Zebra'],
]

// lightness of each material, from its diffuse colour
function materials(file) {
  const out = {}
  let name = null
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const [k, ...v] = line.trim().split(/\s+/)
    if (k === 'newmtl') name = v.join(' ')
    if (k === 'Kd' && name) {
      const [r, g, b] = v.map(Number)
      out[name] = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b)
    }
  }
  return out
}

function sample(file, mtl) {
  const group = new OBJLoader().parse(readFileSync(file, 'utf8'))
  const tris = []
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  group.traverse(o => {
    if (!o.isMesh) return
    const pos = o.geometry.getAttribute('position')
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const groups = o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: pos.count, materialIndex: 0 }]
    for (const g of groups) {
      const lum = mtl[mats[g.materialIndex]?.name] ?? 0.6
      for (let i = g.start; i < g.start + g.count; i += 3) {
        a.fromBufferAttribute(pos, i)
        b.fromBufferAttribute(pos, i + 1)
        c.fromBufferAttribute(pos, i + 2)
        const area = new THREE.Triangle(a, b, c).getArea()
        if (area > 0) tris.push({ a: a.clone(), b: b.clone(), c: c.clone(), area, lum })
      }
    }
  })
  const box = new THREE.Box3()
  for (const t of tris) box.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c)
  const size = box.getSize(new THREE.Vector3())
  // in profile: the body's length along x
  const lengthAlongZ = size.z > size.x
  const total = tris.reduce((s, t) => s + t.area, 0)
  const pts = []
  const lum = []
  for (let k = 0; k < COUNT; k++) {
    let r = Math.random() * total
    let t = tris[0]
    for (const u of tris) { r -= u.area; if (r <= 0) { t = u; break } }
    let s1 = Math.random(), s2 = Math.random()
    if (s1 + s2 > 1) { s1 = 1 - s1; s2 = 1 - s2 }
    const p = t.a.clone().addScaledVector(t.b.clone().sub(t.a), s1).addScaledVector(t.c.clone().sub(t.a), s2)
    let x = p.x - (box.min.x + box.max.x) / 2
    let z = p.z - (box.min.z + box.max.z) / 2
    if (lengthAlongZ) [x, z] = [z, -x]
    pts.push(x / size.y, (p.y - box.min.y) / size.y, z / size.y)
    lum.push(t.lum)
  }
  return { pts: pts.map(v => Math.round(v * 100) / 100), lum: lum.map(v => Math.round(v * 10) / 10) }
}

const out = FIGS.map(([id, name, file]) => ({ id, name, ...sample(join(DIR, file + '.obj'), materials(join(DIR, file + '.mtl'))) }))
writeFileSync(new URL('../src/scene/figures.json', import.meta.url), JSON.stringify(out))
console.log(out.map(f => `${f.id} ${f.pts.length / 3} pts`).join('\n'))
