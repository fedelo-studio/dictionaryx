// Dictionaryx in 3D. The game engine is not copied: src/core.js and src/platform-web.js of the 2D
// game are bundled as they are (same rules, same Supabase rooms), with React standing in for Preact.
import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { bankRows, bundleJs } from '../scripts/bundle.mjs'

const root = new URL('..', import.meta.url).pathname
const ENGINE = 'virtual:dictionaryx-engine'
const SOURCES = ['core.js', 'platform-web.js']
// What the 3D app reads from the engine.
const EXPORTS = [
  'data', 'rt', 'web', 'act', 'emit', 'listeners', 'tickers', 'toasts', 'boot', 'toast', 'seenReveal',
  'joinGame', 'saveDef', 'castVote', 'createRoom', 'goRoom', 'goHome', 'roomLink', 'saveNick', 'leaveGame',
  'removePlayer', 'writeFailed', 'nameOf', 'avatarOf', 'seatsOf', 'liveSubs', 'hasDef', 'bankEntry', 'dec',
  'ranking', 'reached', 'RULES', 'BANK', 'remaining', 'fmt', 'bestBluff', 'typingPing', 'setTyping', 'lsGet',
  'lsSet', 'canPlay', 'joined', 'listNames', 'initials', 'CODE_RE', 'hashStr', 'reducedMotion', 'labelOf',
]

// Same rule as scripts/build.mjs: keys from the environment, else from the project's .env.
function config() {
  const env = { ...process.env }
  if (existsSync(root + '.env')) {
    for (const line of readFileSync(root + '.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return {
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || '',
  }
}

function engine() {
  return {
    name: 'dictionaryx-engine',
    resolveId: id => (id === ENGINE ? '\0' + ENGINE : null),
    load(id) {
      if (id !== '\0' + ENGINE) return null
      for (const f of [...SOURCES, 'bank.json']) this.addWatchFile(root + 'src/' + f)
      const code = bundleJs(root + 'src/', SOURCES, bankRows(root + 'src/bank.json'))
      return [
        "import React from 'react'",
        "import htm from 'htm'",
        "import { createClient } from '@supabase/supabase-js'",
        'window.preact = { h: React.createElement, render() {} }',
        'window.preactHooks = { useState: React.useState, useEffect: React.useEffect, useRef: React.useRef, useMemo: React.useMemo }',
        'window.htm = htm',
        'window.supabase = { createClient }',
        'window.DICTIONARYX_CONFIG = ' + JSON.stringify(config()),
        code,
        'export { ' + EXPORTS.join(', ') + ' }',
      ].join('\n')
    },
  }
}

export default defineConfig({
  plugins: [react(), engine()],
  // Fonts and favicon come from the 2D game's public folder (Strawford stays out of git there).
  publicDir: '../public',
  server: { port: 5175, strictPort: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
})
