// Built-in sounds for the three Style packs (Clay Pop, Neo Brutal, Wabi-Sabi). Nothing to download: every sound is
// a few tones made with the Web Audio API, each pack with its own material (soft squish, hard clack, wood and bell).
let ctx = null
const audio = () => {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC() }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone({ freq, to, dur = .12, gain = .2, at = 0, type = 'sine', lp = 0 }, master) {
  const c = audio()
  const t = c.currentTime + at
  const o = c.createOscillator(), a = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  a.gain.setValueAtTime(.0001, t)
  a.gain.exponentialRampToValueAtTime(Math.max(.0002, gain * master), t + .008)
  a.gain.exponentialRampToValueAtTime(.0001, t + dur)
  let out = a
  o.connect(a)
  if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; a.connect(f); out = f }
  out.connect(c.destination)
  o.start(t); o.stop(t + dur + .03)
}

const seq = (notes, step, dur, gain, extra = {}) => notes.map((freq, i) => ({ freq, at: i * step, dur, gain, ...extra }))

// Clay: round, low, squishy "bloops" (sine with a falling or rising glide, softened with a low-pass).
const A = { type: 'sine', lp: 1800 }
const CLAY = {
  hover:        [{ freq: 520, to: 600, dur: .05, gain: .05, ...A }],
  press:        [{ freq: 330, to: 170, dur: .14, gain: .3, ...A }],
  open:         [{ freq: 260, to: 420, dur: .18, gain: .22, ...A }],
  close:        [{ freq: 420, to: 240, dur: .16, gain: .2, ...A }],
  check:        [{ freq: 300, to: 520, dur: .12, gain: .25, ...A }],
  uncheck:      [{ freq: 400, to: 220, dur: .12, gain: .2, ...A }],
  success:      seq([392, 523, 659], .09, .22, .22, A),
  celebrate:    seq([392, 523, 659, 784, 988], .08, .26, .22, A),
  achievement:  seq([392, 494, 659, 784], .09, .28, .22, A),
  info:         [{ freq: 700, to: 640, dur: .2, gain: .18, ...A }],
  notification: seq([660, 880], .12, .3, .2, A),
  start:        [{ freq: 240, to: 520, dur: .24, gain: .22, ...A }],
  stop:         [{ freq: 520, to: 240, dur: .2, gain: .2, ...A }],
  complete:     seq([523, 659, 784, 1047], .09, .26, .2, A),
  intro:        seq([262, 330, 392, 523], .13, .4, .2, A),
  error:        [{ freq: 200, to: 120, dur: .22, gain: .22, ...A }],
  send:         [{ freq: 300, to: 620, dur: .13, gain: .22, ...A }],
  delete:       [{ freq: 280, to: 90, dur: .2, gain: .24, ...A }],
}

// Brutal: short, hard, square-wave clacks and stabs. Dry, no tail.
const B = { type: 'square', lp: 3200 }
const BRUTAL = {
  hover:        [{ freq: 900, dur: .02, gain: .035, ...B }],
  press:        [{ freq: 190, to: 95, dur: .07, gain: .2, ...B }, { freq: 1400, dur: .015, gain: .07, ...B }],
  open:         [{ freq: 220, dur: .06, gain: .16, ...B }, { freq: 330, dur: .08, at: .06, gain: .16, ...B }],
  close:        [{ freq: 330, dur: .06, gain: .16, ...B }, { freq: 220, dur: .08, at: .06, gain: .16, ...B }],
  check:        [{ freq: 440, dur: .05, gain: .16, ...B }, { freq: 660, dur: .07, at: .05, gain: .16, ...B }],
  uncheck:      [{ freq: 330, dur: .05, gain: .14, ...B }, { freq: 220, dur: .07, at: .05, gain: .14, ...B }],
  success:      seq([392, 523, 659], .07, .1, .16, B),
  celebrate:    seq([392, 523, 659, 784, 1047], .06, .12, .16, B),
  achievement:  seq([330, 440, 554, 659], .07, .14, .16, B),
  info:         [{ freq: 880, dur: .09, gain: .14, ...B }],
  notification: seq([880, 1175], .09, .12, .15, B),
  start:        [{ freq: 220, to: 440, dur: .12, gain: .16, ...B }],
  stop:         [{ freq: 440, to: 220, dur: .12, gain: .16, ...B }],
  complete:     seq([440, 554, 659, 880], .07, .12, .15, B),
  intro:        seq([196, 262, 330, 392], .1, .18, .15, B),
  error:        [{ freq: 150, dur: .12, gain: .18, ...B }, { freq: 110, dur: .16, at: .1, gain: .18, ...B }],
  send:         [{ freq: 300, to: 700, dur: .08, gain: .16, ...B }],
  delete:       [{ freq: 260, to: 70, dur: .14, gain: .2, ...B }],
}

// Wabi: wood blocks and quiet bells, uneven and unhurried (a pentatonic scale, a little space between notes).
const W = { type: 'triangle', lp: 2600 }
const bell = (f, at = 0, g = .16) => [{ freq: f, dur: .7, gain: g, at, type: 'sine' }, { freq: f * 2.76, dur: .35, gain: g * .25, at, type: 'sine' }]
const WABI = {
  hover:        [{ freq: 620, dur: .04, gain: .04, ...W }],
  press:        [{ freq: 520, to: 470, dur: .09, gain: .26, ...W }, { freq: 1040, to: 940, dur: .05, gain: .06, ...W }],
  open:         bell(523, 0, .14),
  close:        bell(392, 0, .13),
  check:        [{ freq: 600, to: 560, dur: .08, gain: .22, ...W }, ...bell(880, .04, .08)],
  uncheck:      [{ freq: 440, to: 400, dur: .09, gain: .2, ...W }],
  success:      [...bell(523, 0, .14), ...bell(659, .16, .14), ...bell(784, .34, .14)],
  celebrate:    [...bell(523, 0, .14), ...bell(587, .12, .14), ...bell(784, .26, .14), ...bell(880, .42, .14), ...bell(1175, .6, .12)],
  achievement:  [...bell(392, 0, .15), ...bell(523, .18, .15), ...bell(659, .38, .15)],
  info:         bell(784, 0, .12),
  notification: [...bell(880, 0, .13), ...bell(660, .22, .12)],
  start:        [...bell(440, 0, .13), ...bell(587, .14, .12)],
  stop:         [...bell(587, 0, .12), ...bell(440, .14, .12)],
  complete:     [...bell(523, 0, .13), ...bell(659, .15, .13), ...bell(880, .32, .13)],
  intro:        [...bell(392, 0, .13), ...bell(494, .25, .13), ...bell(587, .5, .13), ...bell(784, .78, .13)],
  error:        [{ freq: 220, to: 170, dur: .18, gain: .22, ...W }],
  send:         [{ freq: 520, to: 620, dur: .09, gain: .2, ...W }],
  delete:       [{ freq: 330, to: 200, dur: .16, gain: .2, ...W }],
}

// Cyber: bright digital blips and quick arpeggios, a little detuned and cold.
const C = { type: 'sawtooth', lp: 4200 }
const CYBER = {
  hover:        [{ freq: 1800, dur: .025, gain: .035, ...C }],
  press:        [{ freq: 900, to: 300, dur: .08, gain: .16, ...C }],
  open:         seq([440, 880], .05, .09, .13, C),
  close:        seq([880, 440], .05, .09, .13, C),
  check:        seq([660, 990], .045, .07, .14, C),
  uncheck:      seq([660, 330], .045, .07, .12, C),
  success:      seq([523, 659, 784, 1047], .055, .1, .13, C),
  celebrate:    seq([523, 659, 784, 1047, 1319, 1568], .05, .11, .13, C),
  achievement:  seq([392, 587, 784, 1175], .06, .12, .13, C),
  info:         seq([1175, 1568], .06, .09, .11, C),
  notification: seq([1568, 1175, 1568], .07, .09, .12, C),
  start:        [{ freq: 220, to: 880, dur: .16, gain: .14, ...C }],
  stop:         [{ freq: 880, to: 220, dur: .16, gain: .14, ...C }],
  complete:     seq([659, 784, 988, 1319], .06, .12, .13, C),
  intro:        seq([220, 330, 440, 660, 880], .08, .18, .12, C),
  error:        [{ freq: 180, dur: .08, gain: .16, ...C }, { freq: 140, dur: .12, at: .09, gain: .16, ...C }],
  send:         [{ freq: 500, to: 1500, dur: .09, gain: .14, ...C }],
  delete:       [{ freq: 700, to: 80, dur: .16, gain: .16, ...C }],
}

// Phantom: sharp square-wave stabs, fast sweeps and a punchy "snap" on every press.
const P = { type: 'square', lp: 3400 }
const PS = { type: 'sawtooth', lp: 3000 }
const PHANTOM = {
  hover:        [{ freq: 1500, dur: .02, gain: .03, ...P }],
  press:        [{ freq: 1400, to: 300, dur: .05, gain: .2, ...P }],
  open:         [{ freq: 300, to: 1300, dur: .1, gain: .14, ...PS }],
  close:        [{ freq: 1300, to: 300, dur: .1, gain: .14, ...PS }],
  check:        seq([784, 1175], .04, .06, .16, P),
  uncheck:      [{ freq: 500, to: 250, dur: .07, gain: .16, ...P }],
  success:      [{ freq: 523, dur: .2, gain: .1, ...P }, { freq: 659, dur: .2, gain: .1, ...P }, { freq: 784, dur: .2, gain: .1, ...P }, { freq: 1047, dur: .22, at: .09, gain: .12, ...P }],
  celebrate:    seq([523, 659, 784, 1047, 1319, 1047, 1319, 1568], .06, .1, .13, P),
  achievement:  [{ freq: 392, dur: .16, gain: .11, ...P }, { freq: 494, dur: .16, gain: .11, ...P }, { freq: 587, dur: .16, gain: .11, ...P }, { freq: 784, dur: .26, at: .12, gain: .13, ...P }],
  info:         seq([880, 1175], .07, .08, .12, P),
  notification: seq([1175, 880, 1175], .08, .08, .13, P),
  start:        [{ freq: 250, to: 1000, dur: .16, gain: .14, ...PS }],
  stop:         [{ freq: 1000, to: 250, dur: .16, gain: .14, ...PS }],
  complete:     seq([523, 659, 784, 1047], .07, .12, .14, P),
  intro:        seq([196, 262, 330, 392, 523, 659], .07, .16, .13, P),
  error:        [{ freq: 200, dur: .1, gain: .2, ...PS, lp: 1500 }, { freq: 150, dur: .14, at: .1, gain: .2, ...PS, lp: 1500 }],
  send:         [{ freq: 600, to: 1800, dur: .07, gain: .14, ...P }],
  delete:       [{ freq: 900, to: 70, dur: .14, gain: .18, ...PS, lp: 2500 }],
}

// Scrap: soft paper taps, little pencil ticks and a light "ding", all warm and dry.
const S = { type: 'triangle', lp: 2200 }
const SCRAP = {
  hover:        [{ freq: 1000, dur: .02, gain: .03, ...S }],
  press:        [{ freq: 700, to: 420, dur: .06, gain: .2, ...S }, { freq: 2400, dur: .012, gain: .05, type: 'square', lp: 3000 }],
  open:         [{ freq: 480, to: 640, dur: .1, gain: .17, ...S }],
  close:        [{ freq: 640, to: 440, dur: .1, gain: .16, ...S }],
  check:        [{ freq: 780, to: 940, dur: .08, gain: .18, ...S }],
  uncheck:      [{ freq: 600, to: 480, dur: .08, gain: .15, ...S }],
  success:      seq([523, 659, 784], .09, .16, .16, S),
  celebrate:    seq([523, 659, 784, 1047, 1319], .08, .2, .16, S),
  achievement:  seq([440, 554, 659, 880], .09, .2, .16, S),
  info:         [{ freq: 988, dur: .14, gain: .14, ...S }],
  notification: seq([880, 1175], .11, .18, .15, S),
  start:        [{ freq: 400, to: 700, dur: .14, gain: .15, ...S }],
  stop:         [{ freq: 700, to: 400, dur: .14, gain: .15, ...S }],
  complete:     seq([523, 659, 880], .09, .18, .15, S),
  intro:        seq([392, 494, 587, 784], .12, .3, .14, S),
  error:        [{ freq: 260, to: 200, dur: .14, gain: .18, ...S }],
  send:         [{ freq: 520, to: 780, dur: .09, gain: .16, ...S }],
  delete:       [{ freq: 420, to: 180, dur: .14, gain: .17, ...S }],
}

// Nostalgic Menu: soft, round, friendly blips and little bell chimes, bright but never sharp.
const N = { type: 'sine', lp: 5200 }
const NT = { type: 'triangle', lp: 4200 }
const NOSTALGIC = {
  hover:        [{ freq: 1320, dur: .03, gain: .035, ...N }],
  press:        [{ freq: 520, to: 780, dur: .08, gain: .17, ...NT }, { freq: 1560, dur: .05, at: .02, gain: .05, ...N }],
  open:         [{ freq: 600, to: 900, dur: .12, gain: .15, ...NT }],
  close:        [{ freq: 900, to: 560, dur: .12, gain: .14, ...NT }],
  check:        seq([784, 1047], .07, .1, .16, N),
  uncheck:      [{ freq: 700, to: 520, dur: .09, gain: .14, ...NT }],
  success:      seq([523, 659, 784, 1047], .08, .16, .15, N),
  celebrate:    seq([523, 659, 784, 1047, 1319, 1568], .08, .22, .15, N),
  achievement:  seq([523, 659, 784, 1047], .09, .24, .15, N),
  info:         seq([988, 1319], .09, .14, .13, N),
  notification: seq([1047, 1319, 1568], .09, .16, .14, N),
  start:        [{ freq: 440, to: 880, dur: .18, gain: .14, ...NT }],
  stop:         [{ freq: 880, to: 440, dur: .18, gain: .14, ...NT }],
  complete:     seq([659, 784, 1047], .09, .18, .14, N),
  intro:        seq([392, 523, 659, 784, 1047], .12, .3, .13, N),
  error:        [{ freq: 330, to: 260, dur: .16, gain: .16, ...NT }, { freq: 260, to: 220, dur: .18, at: .12, gain: .14, ...NT }],
  send:         [{ freq: 600, to: 1200, dur: .1, gain: .14, ...NT }],
  delete:       [{ freq: 700, to: 200, dur: .16, gain: .14, ...NT }],
}

const PACKS = { clay: CLAY, brutal: BRUTAL, wabi: WABI, cyber: CYBER, scrap: SCRAP, phantom: PHANTOM, nostalgic: NOSTALGIC }
export const isStylePack = id => id in PACKS

export function playStyle(pack, cue, volume = .85) {
  const recipe = PACKS[pack]?.[cue]
  if (!recipe) return false
  try { for (const part of recipe) tone(part, Math.max(0, Math.min(1, volume)) * 1.15) } catch { return false }
  return true
}
