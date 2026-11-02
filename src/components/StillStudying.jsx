import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePomodoro, hms, mmss } from '../lib/pomodoro.jsx'
import { stillPing } from '../lib/stillPing.js'
import { systemNotify } from '../lib/notify.jsx'

// "Still studying?": when the count-up clock has run 5 hours without a check-in this fills the screen, flashes and pings
// until someone answers. If nobody does within the hour, the time is saved anyway and flagged for the admin (see pomodoro.jsx).
export default function StillStudying() {
  const p = usePomodoro()
  const ask = p.stillAsk
  const open = !!ask
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!open) return
    stillPing()
    const ping = setInterval(stillPing, 4000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    setNow(Date.now())
    if (document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      systemNotify('Still studying?', 'Open LOCK IN and answer. If nobody answers within the hour, your time is sent to the admin to review.')
    }
    return () => { clearInterval(ping); clearInterval(tick) }
  }, [open])

  if (!ask) return null
  const left = Math.max(0, ask.deadline - now)
  return createPortal(
    <div className="modal-backdrop still-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="still-title">
      <div className="modal card stack still-ask">
        <div className="still-bell" aria-hidden="true">🔔</div>
        <h2 id="still-title">Still studying?</h2>
        <p>Your count-up clock is at <strong>{hms(p.cuElapsedMs)}</strong>. Tap below so we know you're really there.</p>
        <p className="still-count">
          Answer in <strong>{mmss(left)}</strong>. If nobody does, your time is still saved, the clock stops, and the admin is asked to look at it.
        </p>
        <button type="button" className="still-yes" onClick={p.stillYes} autoFocus>Yes, still studying</button>
        <button type="button" className="secondary" onClick={p.stillStopped}>I stopped a while ago</button>
        <small className="muted">"I stopped" pauses the clock and only counts the time up to when this first popped up.</small>
      </div>
    </div>,
    document.body,
  )
}
