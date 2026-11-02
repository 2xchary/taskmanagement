import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsAdmin } from '../lib/moderation.js'
import { useToast } from '../lib/toast.jsx'
import { useSound } from '../lib/sfx.jsx'
import { systemNotify } from '../lib/notify.jsx'
import { fmtMinutes } from '../lib/dates.js'
import PickerModal from './PickerModal.jsx'

export const FLAGS_CHANGED = 'lock-in:study-flags-changed'
const TOLD_KEY = 'lock-in-study-flags-told'
const fmtWhen = d => (d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const STATUS_TEXT = { kept: 'Kept as saved', adjusted: 'Changed to the true time', voided: 'Voided' }

// One flagged study session and what the admin can do about it: keep it, put the true time, or void it.
export function StudyFlagCard({ flag, onResolve }) {
  const [minutes, setMinutes] = useState(String(flag.verified_minutes))
  const [busy, setBusy] = useState(false)
  const open = flag.status === 'open'
  const n = Math.round(Number(minutes))
  const valid = Number.isFinite(n) && n >= 0 && n <= flag.claimed_minutes
  const run = async (how, true_minutes) => { setBusy(true); await onResolve(flag, how, true_minutes); setBusy(false) }
  return (
    <article className={'card study-flag' + (open ? '' : ' resolved')}>
      <div className="row between">
        <strong>{flag.person ?? 'Someone'} <small className="muted">{flag.username ? '@' + flag.username + ' · ' : ''}{fmtWhen(flag.created_at)}</small></strong>
        <span className={'status-pill ' + (open ? 'muted' : 'active')}>{open ? 'needs a decision' : STATUS_TEXT[flag.status] ?? flag.status}</span>
      </div>
      <p className="small">
        Saved <b>{fmtMinutes(flag.claimed_minutes)}</b> from the count-up timer. They did not answer "Still studying?", and the clock was
        at <b>{fmtMinutes(flag.verified_minutes)}</b> when it asked.
        {!open && flag.final_minutes != null && <> Final: <b>{fmtMinutes(flag.final_minutes)}</b>.</>}
      </p>
      {open && (
        <div className="study-flag-actions">
          <button type="button" disabled={busy} onClick={() => run('keep')} title="Leave the time exactly as saved">Keep it ({fmtMinutes(flag.claimed_minutes)})</button>
          <span className="row study-flag-true">
            <input type="number" min="0" max={flag.claimed_minutes} inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} aria-label="True minutes" />
            <span className="muted small">min</span>
            <button type="button" className="secondary" disabled={busy || !valid} onClick={() => run('adjust', n)} title="Change the saved time to this many minutes">Put true time</button>
          </span>
          <button type="button" className="secondary danger" disabled={busy}
            onClick={() => { if (confirm(`Void all ${fmtMinutes(flag.claimed_minutes)} for ${flag.person ?? 'this person'}? It comes off their XP, streak and totals.`)) run('void') }}>Void it</button>
        </div>
      )}
    </article>
  )
}

// For admins only: watches for count-up time that nobody confirmed. A red bar stays at the top of every page while any
// is waiting, and a new one pings, pops up a message and opens the review.
export default function StudyFlagAlert() {
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const { play } = useSound()
  const [flags, setFlags] = useState([])
  const [reviewing, setReviewing] = useState(false)
  const seen = useRef(new Set())                          // ids of open flags already announced

  const load = useCallback(async () => {
    if (!isAdmin) return
    const { data, error } = await supabase.rpc('admin_study_flags')
    if (error) return                                     // the database has not been given 052 yet: nothing to show
    const list = Array.isArray(data) ? data : []
    setFlags(list)
    const open = list.filter(f => f.status === 'open')
    // announce each flag once per browser tab (a reload does not pop the review open again; the red bar stays)
    let told = []
    try { told = JSON.parse(sessionStorage.getItem(TOLD_KEY) ?? '[]') } catch { /* ignore */ }
    const known = new Set([...told, ...seen.current])
    const fresh = open.filter(f => !known.has(f.id))
    open.forEach(f => seen.current.add(f.id))
    if (fresh.length) {
      try { sessionStorage.setItem(TOLD_KEY, JSON.stringify([...seen.current].slice(-100))) } catch { /* ignore */ }
      play('notification')
      toast(`⚠ ${open.length} study session${open.length === 1 ? '' : 's'} need${open.length === 1 ? 's' : ''} your decision`, 'reminder', { silent: true })
      if (document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        systemNotify('LOCK IN: study time to review', `${open[0].person ?? 'Someone'} did not answer "Still studying?"`)
      }
      setReviewing(true)
    }
  }, [isAdmin, play, toast])

  useEffect(() => {
    if (!isAdmin) return
    load()
    const poll = setInterval(load, 60000)
    const vis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener(FLAGS_CHANGED, load)
    return () => { clearInterval(poll); document.removeEventListener('visibilitychange', vis); window.removeEventListener(FLAGS_CHANGED, load) }
  }, [isAdmin, load])

  const resolve = async (flag, how, true_minutes) => {
    const { error } = await supabase.rpc('admin_resolve_study_flag', { fid: flag.id, how, true_minutes: true_minutes ?? null })
    if (error) { toast(error.message); return }
    toast(how === 'keep' ? 'Kept as saved' : how === 'void' ? 'Voided' : `Changed to ${fmtMinutes(true_minutes)}`, 'info', { silent: true })
    window.dispatchEvent(new Event(FLAGS_CHANGED))
  }

  const open = flags.filter(f => f.status === 'open')
  useEffect(() => { if (reviewing && open.length === 0) setReviewing(false) }, [reviewing, open.length])
  if (!isAdmin || open.length === 0) return null
  return (
    <>
      <button type="button" className="flag-banner" onClick={() => setReviewing(true)}>
        <span aria-hidden="true">⚠</span> {open.length} study session{open.length === 1 ? '' : 's'} need{open.length === 1 ? 's' : ''} your decision <u>Review</u>
      </button>
      {reviewing && (
        <PickerModal title="Study time to review" onClose={() => setReviewing(false)}
          hint="Each of these ran 5 hours on the count-up timer and nobody answered “Still studying?”. The time is already saved. Choose what to do with it.">
          <div className="stack">
            {open.map(f => <StudyFlagCard key={f.id} flag={f} onResolve={resolve} />)}
          </div>
        </PickerModal>
      )}
    </>
  )
}
