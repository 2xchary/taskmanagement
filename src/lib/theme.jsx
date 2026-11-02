import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { useAuth } from './auth.jsx'
import { IS_ADMIN } from './env.js'
import Logo from '../components/Logo.jsx'

// Original fan-inspired looks. They use their own names and palettes, with no logos or characters.
// `preview` is the theme's five-colour palette, shown as swatches in the picker and the shop.
// `signature` marks the looks whose dock buttons change shape too (flowers, monitors, stars, records, petals and leaves); they cost more.
// Each theme also has its own animated background (see "Themes" at the bottom of styles.css).
export const THEMES = [
  { id: 'default', name: 'Classic', blurb: 'Airy whites and sky blue, with soft light drifting by.',
    preview: ['#f4f8fc', '#dfeaf5', '#bfe3ff', '#2d8fe6', '#1f2d3d'] },
  { id: 'dark', name: 'Classic Dark', blurb: 'The classic look in deep navy, easy on the eyes at night.',
    preview: ['#0c1428', '#16243f', '#25395f', '#5aa9ff', '#e8eefc'] },
  { id: 'gordon', name: 'Gordon College', free: true, blurb: 'Gordon blue and gold, with a hint of tartan and the chapel on the hill.',
    preview: ['#ffffff', '#0098d1', '#004a87', '#003f73', '#fdb913'] },
  { id: 'stonybrook', name: 'Stony Brook', free: true, blurb: 'Seawolf red and navy, with waves rolling in.',
    preview: ['#ffffff', '#bebebe', '#990000', '#002244', '#1791ad'] },
  { id: 'umaine', name: 'University of Maine', free: true, blurb: 'Black Bear navy and ice blue under a still, cold winter sky.',
    preview: ['#ffffff', '#eaf3fb', '#b0d7ff', '#2d6aa3', '#003263'] },
  { id: 'aero', name: 'Frutiger Aero', signature: 'glass bubbles', blurb: 'Glossy aqua glass, bubbles and bright skies, with its own bubbly sounds.',
    preview: ['#ffffff', '#bfeaff', '#5fd3e8', '#1a8fe3', '#7fd34a'] },
  { id: 'sprout', name: 'Sprout Squad', blurb: 'Olive leaves, cream and warm amber, with pollen floating up.',
    preview: ['#606c38', '#283618', '#fefae0', '#dda15e', '#bc6c25'] },
  { id: 'console', name: 'Retro Console', signature: 'computers', blurb: 'Mint, steel blue and a pop of red over sliding stripes and tiles.',
    preview: ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557'] },
  { id: 'capsule', name: 'Capsule Quest', blurb: 'Navy, red and sunny orange under a slowly turning sunburst.',
    preview: ['#003049', '#d62828', '#f77f00', '#fcbf49', '#eae2b7'] },
  { id: 'meadow', name: "Hero's Meadow", blurb: 'Dark earth, teal and parchment, lit by drifting fireflies.',
    preview: ['#0a0908', '#22333b', '#eae0d5', '#c6ac8f', '#5e503f'] },
  { id: 'island', name: 'Cozy Island', signature: 'flowers', blurb: 'Rose petals drifting down over soft aqua.',
    preview: ['#880d1e', '#dd2d4a', '#f26a8d', '#f49cbb', '#cbeef3'] },
  { id: 'arcade', name: 'Starlit Arcade', signature: 'stars', blurb: 'Deep lavender night with twinkling stars and drifting aurora.',
    preview: ['#22223b', '#4a4e69', '#9a8c98', '#c9ada7', '#f2e9e4'] },
  { id: 'lofi', name: 'Lofi Nights', signature: 'records', blurb: 'Purple, coral and pink over a rainy dusk skyline, with notes drifting up.',
    preview: ['#a83aa0', '#ff7078', '#fdb1d2', '#cd98d3', '#8d88d8'] },
  { id: 'shore', name: 'Coral Shore', signature: 'shells', blurb: 'Coral sunset, warm sand and seafoam waves rolling in.',
    preview: ['#ffaea0', '#ffebd2', '#9bcbc0', '#6ba3c8', '#2f5f7d'] },
  { id: 'rose', name: 'Dusty Rose', signature: 'petals and leaves', blurb: 'A vintage parlour in rose, blush and cream: lace, climbing roses and a sunlit window.',
    preview: ['#de929d', '#e4babe', '#f7efd9', '#99976c', '#6f5d4e'] },
  { id: 'tile', name: 'Glazed Tile', signature: 'glazed tiles', blurb: 'An arts-and-crafts tile wall: relief tiles in moss, amber, teal and terracotta.',
    preview: ['#587d3e', '#d29a35', '#2b6862', '#ad522a', '#27382c'] },
  { id: 'handheld', name: 'Handheld Glow', signature: 'glossy game buttons', blurb: 'Soft violet and sky glass over a dotted grid, with glossy console-style buttons in every colour.',
    preview: ['#5a2fd8', '#b9a3ff', '#1f8fd0', '#f0a21c', '#1fa77d'] },
  { id: 'golden', name: 'Golden Hour', exclusive: true, signature: 'gold coin buttons', blurb: 'Earned, never bought: warm cream and gold glass in low sun, with glossy gold coin buttons.',
    preview: ['#7a4a0a', '#d9a21b', '#ffe08a', '#fff3d0', '#2b1b05'] },
  { id: 'library', name: 'Old Library', signature: 'books', blurb: 'Walls of bookshelves in warm lamplight with dust drifting by, and a dock of leather-bound books.',
    preview: ['#2c1d12', '#7b2d26', '#b08d57', '#2f4a3a', '#f3e9d2'] },
  // Style packs: a step above a theme. They reshape the boxes and buttons, and bring their own sounds and music.
  { id: 'clay', name: 'Clay Pop', style: true, music: 'coffee', blurb: 'Claymorphism: soft, puffy, pastel boxes you could squish, with round bloopy sounds and easy coffee-shop music.',
    preview: ['#fdeee8', '#ffd1c4', '#ff7f9e', '#8fb8ff', '#4a3f55'] },
  { id: 'brutal', name: 'Neo Brutal', style: true, music: 'lofi', blurb: 'Neo-brutalism: thick black outlines, hard shadows and loud flat colours, with crisp clacks and a slow lofi beat.',
    preview: ['#fff6d6', '#ffd93d', '#ff5c8a', '#4dd4c4', '#111111'] },
  { id: 'wabi', name: 'Wabi-Sabi', style: true, music: 'ambient', blurb: 'Quiet paper, ink and imperfect edges, with wooden taps, soft bells and calm ambient music.',
    preview: ['#f3ecdf', '#d9cdb8', '#a89a82', '#5d5243', '#b3242b'] },
  { id: 'cyber', name: 'Cybercore', style: true, music: 'lofi', blurb: 'Neon on black: glowing outlines, a mono terminal font and digital blips, with a slow lofi beat.',
    preview: ['#07080f', '#101426', '#00e5ff', '#ff2bd6', '#eaf6ff'] },
  { id: 'scrap', name: 'Scrapbook', style: true, music: 'coffee', blurb: 'Kraft paper, taped notes and handwritten titles, with soft paper sounds and easy coffee-shop music.',
    preview: ['#efe2c8', '#fff8e6', '#ffd966', '#e8735a', '#5a4632'] },
  { id: 'phantom', name: 'Phantom Heist', style: true, music: 'lofi', blurb: 'Red, white and black heist style: white dialogue-box cards, bubble buttons and name-tag titles over a moving red background, with sharp stab sounds and a slow beat.',
    preview: ['#e60012', '#ffffff', '#0a0a0a', '#a8000d', '#ffe3e6'] },
  { id: 'nostalgic', name: 'Nostalgic Menu', style: true, music: 'coffee', blurb: 'A bright, soft game-menu look: frosted white glass, a gradient title, capsule buttons with a glossy coloured dot, a shelf bar along the bottom and shapes drifting slowly behind, with soft bloopy sounds.',
    preview: ['#eaf1f8', '#ffffff', '#1a6db8', '#0e7f86', '#a84c0a'] },
  { id: 'twilight', name: 'Twilight Sky', blurb: 'Blush clouds and a crescent moon over indigo mountains and stars.',
    preview: ['#fff1f1', '#a9b4dc', '#7885c6', '#2c3470', '#161b45'] },
]

const KEY = 'friends-site-theme'
const valid = id => THEMES.some(t => t.id === id)
const readLocal = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const writeLocal = id => { try { localStorage.setItem(KEY, id) } catch { /* private mode: fine */ } }

function apply(id) {
  const root = document.documentElement
  if (id && id !== 'default') root.dataset.theme = id
  else delete root.dataset.theme
}

const ThemeContext = createContext({ theme: 'default', setTheme: () => {} })
export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({ children }) {
  const { user } = useAuth()
  const [theme, setThemeState] = useState(() => {
    const saved = readLocal()
    const id = valid(saved) ? saved : 'default'
    apply(id) // before first paint, so there's no flash of the wrong look
    return id
  })

  useEffect(() => { apply(theme) }, [theme])

  // Pick up the theme you saved on another device.
  useEffect(() => {
    if (!user || !supabase || IS_ADMIN) return   // the admin build keeps its own, local-only choice
    supabase.from('profiles').select('theme').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.theme && valid(data.theme)) { setThemeState(data.theme); writeLocal(data.theme) }
    })
  }, [user?.id]) // eslint-disable-line

  // Changing look shows a short loading page (in the NEW look) while the new colours, scene and sounds settle in.
  const [switching, setSwitching] = useState(null)   // { name, leaving }
  const timers = useRef([])
  const showSwitch = useCallback(name => {
    timers.current.forEach(clearTimeout)
    setSwitching({ name, leaving: false })
    timers.current = [
      setTimeout(() => setSwitching(s => (s ? { ...s, leaving: true } : s)), 1050),
      setTimeout(() => setSwitching(null), 1450),
    ]
  }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const setTheme = useCallback(async id => {
    if (!valid(id)) return
    if (id !== theme) showSwitch(THEMES.find(t => t.id === id)?.name ?? 'your new look')
    setThemeState(id)
    writeLocal(id)
    if (user && supabase && !IS_ADMIN) await supabase.from('profiles').update({ theme: id }).eq('id', user.id)
  }, [user?.id, theme]) // eslint-disable-line

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
      {switching && (
        <div className={'theme-loading' + (switching.leaving ? ' leaving' : '')} role="status" aria-live="polite">
          <div className="tl-card">
            <Logo size={54} />
            <div className="tl-name">Switching to <strong>{switching.name}</strong></div>
            <div className="tl-bar" aria-hidden="true"><i /></div>
          </div>
        </div>
      )}
    </ThemeContext.Provider>
  )
}
