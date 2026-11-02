import { useTheme } from '../lib/theme.jsx'

// A person's name, set in its own typeface and a colour chosen to suit the current theme, with a
// soft glow. The font and the colour both come from the name, so the same name always looks the same,
// different names look different, and it always belongs to the theme it sits in.
const FONTS = [
  "'Pacifico', cursive",
  "'Lilita One', 'Rubik', sans-serif",
  "'Baloo 2', sans-serif",
  "'Fredoka', sans-serif",
  "'Cinzel', serif",
  "'Comfortaa', sans-serif",
  "'Righteous', sans-serif",
  "'Orbitron', sans-serif",
  "'Lora', serif",
  "'Quicksand', sans-serif",
]
const DARK_LOOKS = new Set(['dark', 'arcade', 'meadow', 'cyber'])   // themes whose cards are dark

function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// Hand-picked name colours for each theme: they belong to its palette but are vivid enough to pop off the
// cards (the palettes themselves have too many pale or muddy colours to pick from directly). [hue, saturation %]
const ACCENTS = {
  default:    [[210, 85], [190, 80], [265, 65], [330, 70]],
  dark:       [[205, 100], [175, 80], [265, 85], [330, 80]],
  gordon:     [[200, 100], [215, 90], [38, 95]],
  stonybrook: [[0, 80], [205, 80], [220, 75]],
  umaine:     [[212, 90], [200, 75], [218, 85]],
  aero:       [[200, 90], [175, 80], [100, 60], [285, 60]],
  sprout:     [[85, 55], [32, 70], [18, 75], [100, 45]],
  console:    [[355, 80], [205, 60], [175, 60]],
  capsule:    [[0, 75], [28, 95], [205, 70]],
  meadow:     [[175, 60], [32, 65], [48, 75], [12, 65]],
  island:     [[350, 80], [335, 70], [190, 60], [320, 60]],
  arcade:     [[265, 85], [45, 95], [300, 75], [190, 85]],
  lofi:       [[300, 60], [355, 85], [270, 55], [330, 80]],
  shore:      [[10, 80], [195, 60], [165, 50], [215, 55]],
  rose:       [[345, 48], [60, 28], [24, 32], [320, 34]],
  tile:       [[100, 42], [32, 72], [172, 50], [14, 60]],
  library:    [[8, 62], [140, 38], [32, 70], [270, 38]],
  clay:       [[345, 70], [215, 65], [20, 80], [265, 50]],
  brutal:     [[340, 90], [215, 90], [165, 80], [270, 80]],
  cyber:      [[185, 100], [315, 95], [160, 90], [265, 85]],
  phantom:    [[0, 92], [350, 85], [0, 0], [340, 80]],
  nostalgic:  [[208, 80], [184, 72], [215, 70], [170, 62]],
  scrap:      [[12, 65], [35, 70], [95, 35], [200, 40]],
  wabi:       [[5, 55], [30, 35], [95, 25], [210, 20]],
  golden:     [[38, 80], [28, 75], [45, 85], [18, 70]],
  handheld:   [[255, 70], [190, 70], [285, 65], [35, 85]],
  twilight:   [[235, 55], [330, 60], [270, 50], [215, 60]],
}

export function nameLook(name, themeId) {
  const h = hash(String(name ?? '').trim().toLowerCase() || 'friend')
  const list = ACCENTS[themeId] ?? ACCENTS.default
  const [hue, sat] = list[(h >>> 8) % list.length]
  const dark = DARK_LOOKS.has(themeId)
  // light cards need a deep shade to read; dark cards need a bright one
  const light = dark ? 70 : (hue > 35 && hue < 80 ? 34 : hue >= 150 && hue <= 260 ? 30 : 38)
  return { font: FONTS[h % FONTS.length], hue, sat, light, dark }
}

export default function FancyName({ name, as: Tag = 'span', className = '' }) {
  const { theme } = useTheme()
  const look = nameLook(name, theme)
  return (
    <Tag className={'fancy-name ' + className}
      style={{ '--name-hue': look.hue, '--name-sat': look.sat + '%', '--name-l': look.light + '%', fontFamily: look.font }}>
      {name}
    </Tag>
  )
}
