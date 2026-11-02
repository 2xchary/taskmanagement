import { useEffect, useState } from 'react'

// The colour of the Nostalgic Menu style pack: the accent, the drifting shapes, the glow and the 3D icons all follow it.
// Chosen on the Me page under Style (only shown while Nostalgic Menu is your page theme), and kept on this device.
export const NM_ACCENTS = [
  { id: 'blue', name: 'Blue', swatch: '#1a6db8' },
  { id: 'red', name: 'Red', swatch: '#c0262d' },
  { id: 'yellow', name: 'Yellow', swatch: '#f2b705' },
  { id: 'green', name: 'Green', swatch: '#17703a' },
]
const KEY = 'lock-in-nm-accent'
const EVENT = 'lock-in:nm-accent'
const valid = id => NM_ACCENTS.some(a => a.id === id)
const read = () => { try { const v = localStorage.getItem(KEY); return valid(v) ? v : 'blue' } catch { return 'blue' } }
const apply = id => { document.documentElement.dataset.accent = id }
apply(read())   // before first paint, so there is no flash of the wrong colour

export function useNmAccent() {
  const [accent, setAccent] = useState(read)
  useEffect(() => {
    const sync = () => setAccent(read())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  const choose = id => {
    if (!valid(id)) return
    try { localStorage.setItem(KEY, id) } catch { /* private mode: it still applies for this visit */ }
    apply(id)
    window.dispatchEvent(new Event(EVENT))
  }
  return [accent, choose]
}
