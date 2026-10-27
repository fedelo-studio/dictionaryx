import { createRoot } from 'react-dom/client'
import { advance } from '@react-three/fiber'
import App from './App.jsx'
import { E } from './engine.js'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)
E.boot()

// Development only: step the 3D loop by hand where the page runs in the background (no animation frames).
if (import.meta.env.DEV) {
  window.__advance = (frames = 90) => {
    for (let i = 0; i < frames; i++) {
      const until = performance.now() + 16
      while (performance.now() < until) { /* one frame's worth of time */ }
      advance(performance.now())
    }
  }
}
