// Strawford is licensed for the site but must not sit in the public repository: like the 2D build,
// fetch it from the project's private Vercel Blob store into ../public/fonts when it is missing.
// woff2 for the page, woff for the 3D text (troika reads no woff2).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const dir = new URL('../../public/fonts/', import.meta.url).pathname
const files = ['light', 'regular', 'medium'].flatMap(w => ['woff2', 'woff'].map(ext => `strawford-${w}-webfont.${ext}`))
const token = process.env.BLOB_READ_WRITE_TOKEN || ''
mkdirSync(dir, { recursive: true })

for (const file of files) {
  if (existsSync(dir + file)) continue
  if (!token) {
    if (process.env.VERCEL) throw new Error('Strawford missing: BLOB_READ_WRITE_TOKEN is not set for this deployment')
    console.warn('Warning: public/fonts/' + file + ' is missing and BLOB_READ_WRITE_TOKEN is not set, the system font will show.')
    continue
  }
  const store = token.split('_')[3].toLowerCase()
  const res = await fetch(`https://${store}.private.blob.vercel-storage.com/fonts/${file}`, { headers: { authorization: 'Bearer ' + token } })
  if (!res.ok) throw new Error('Strawford download failed for ' + file + ': HTTP ' + res.status)
  writeFileSync(dir + file, Buffer.from(await res.arrayBuffer()))
}
