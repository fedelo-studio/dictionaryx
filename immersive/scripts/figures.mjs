// Bakes the figurines: each OBJ of Quaternius's Farm Animals pack (CC0) kept as its own low-poly mesh, laid in
// profile, one unit tall, standing on y = 0, one indexed part per material with that material's lightness.
// The models stay out of the repository; only src/scene/figures.json does.
//   node scripts/figures.mjs "<folder with the pack's OBJ and MTL files>"
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const DIR = process.argv[2]
if (!DIR) throw new Error('Usage: node scripts/figures.mjs <OBJ folder>')
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

function bake(file, mtl) {
  const group = new OBJLoader().parse(readFileSync(file, 'utf8'))
  // triangles gathered by material
  const byMat = new Map()
  group.updateMatrixWorld(true)
  group.traverse(o => {
    if (!o.isMesh) return
    const pos = o.geometry.getAttribute('position')
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const groups = o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: pos.count, materialIndex: 0 }]
    const v = new THREE.Vector3()
    for (const g of groups) {
      const lum = mtl[mats[g.materialIndex]?.name] ?? 0.6
      if (!byMat.has(lum)) byMat.set(lum, [])
      const list = byMat.get(lum)
      for (let i = g.start; i < g.start + g.count; i++) list.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).toArray())
    }
  })
  const box = new THREE.Box3()
  for (const list of byMat.values()) for (const p of list) box.expandByPoint(new THREE.Vector3(...p))
  const size = box.getSize(new THREE.Vector3())
  // in profile: the body's length along x
  const lengthAlongZ = size.z > size.x
  const parts = []
  let len = 0
  for (const [lum, list] of byMat) {
    const flat = []
    for (const [px, py, pz] of list) {
      let x = px - (box.min.x + box.max.x) / 2
      let z = pz - (box.min.z + box.max.z) / 2
      if (lengthAlongZ) [x, z] = [z, -x]
      flat.push(x / size.y, (py - box.min.y) / size.y, z / size.y)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(flat.map(n => Math.round(n * 1000) / 1000)), 3))
    const m = mergeVertices(g)
    const pos = Array.from(m.getAttribute('position').array, n => Math.round(n * 1000) / 1000)
    for (let i = 0; i < pos.length; i += 3) len = Math.max(len, Math.abs(pos[i]) * 2)
    parts.push({ lum: Math.round(lum * 100) / 100, pos, idx: Array.from(m.index.array) })
  }
  return { length: Math.round(len * 1000) / 1000, parts }
}

const out = FIGS.map(([id, name, file]) => ({ id, name, ...bake(join(DIR, file + '.obj'), materials(join(DIR, file + '.mtl'))) }))
writeFileSync(new URL('../src/scene/figures.json', import.meta.url), JSON.stringify(out))
console.log(out.map(f => `${f.id} ${f.parts.reduce((s, p) => s + p.idx.length / 3, 0)} triangles, ${f.parts.length} parts`).join('\n'))
