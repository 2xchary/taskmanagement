// A loud, hard-to-miss ping for the "Still studying?" question. It is its own little synth and ignores the site's sound
// switch on purpose: the whole point is to get someone's attention when the clock has run a long time without a check-in.
let ctx = null

export function stillPing() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') ctx.resume()
    const t0 = ctx.currentTime
    const out = ctx.createDynamicsCompressor()      // keeps it loud without crackling
    out.connect(ctx.destination)
    // two rising three-note bursts
    ;[[0, 880], [.17, 1175], [.34, 1568], [.7, 880], [.87, 1175], [1.04, 1568]].forEach(([dt, hz]) => {
      for (const [type, mult, peak] of [['triangle', 1, .9], ['sine', 2, .35]]) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = type
        o.frequency.value = hz * mult
        g.gain.setValueAtTime(0, t0 + dt)
        g.gain.linearRampToValueAtTime(peak, t0 + dt + .012)
        g.gain.exponentialRampToValueAtTime(.001, t0 + dt + .42)
        o.connect(g).connect(out)
        o.start(t0 + dt)
        o.stop(t0 + dt + .45)
      }
    })
  } catch { /* no audio available: the screen still flashes */ }
}
