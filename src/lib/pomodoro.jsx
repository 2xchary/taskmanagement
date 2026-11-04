import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { useAuth } from './auth.jsx'
import { APP_TITLE } from './env.js'
import { useSound } from './sfx.jsx'
import { useToast } from './toast.jsx'

const PomodoroContext = createContext(null)
export const usePomodoro = () => useContext(PomodoroContext)

export const mmss = ms => {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
// h:mm:ss for the count-up clock
export const hms = ms => {
  const s = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(s / 3600)
  return `${h}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ---- count-up timer ---------------------------------------------------------------------------------------------
// A stopwatch for the day. It keeps counting while you work, and when the day changes (midnight) the day's total is
// saved as study time, which is where the XP comes from, and the clock starts again at zero.
// It is stored in this browser (per account) so closing the tab or moving between pages does not lose it.
const MAX_DAY_MIN = 600                                   // at most 10 hours are counted for one day
// "Still studying?": after this much counted time without a check-in the clock asks. If nobody answers within the grace
// time the time is still saved, the clock stops, and it is flagged for the admin to look at (see 052_work_done_and_study_checks.sql).
export const STILL_AFTER_MS = 5 * 3600000
export const STILL_GRACE_MS = 3600000
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const endOfDay = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 0, 0) }
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
const KIND_KEY = 'lock-in-timer-kind'
// A focus round that has not been saved yet: { doneMs, runStart, lastSeen }. It lives in this browser so that closing
// the tab, a crash or a refresh in the middle of a round still saves the minutes you did, next time the app opens.
const pomoKey = uid => `lock-in-pomo-pending-${uid}`
const readPomo = uid => { try { return JSON.parse(localStorage.getItem(pomoKey(uid)) ?? 'null') } catch { return null } }
const writePomo = (uid, v) => { try { v ? localStorage.setItem(pomoKey(uid), JSON.stringify(v)) : localStorage.removeItem(pomoKey(uid)) } catch { /* ignore */ } }
const cuKey = uid => `lock-in-countup-${uid}`
const readKind = () => { try { return localStorage.getItem(KIND_KEY) === 'countup' ? 'countup' : 'pomodoro' } catch { return 'pomodoro' } }
const readCu = uid => {
  try {
    const v = JSON.parse(localStorage.getItem(cuKey(uid)) ?? 'null')
    if (v && typeof v.day === 'string') {
      return { day: v.day, accMs: Number(v.accMs) || 0, startedAt: v.startedAt ? Number(v.startedAt) : null,
        verifiedMs: Number(v.verifiedMs) || 0, askedAt: v.askedAt ? Number(v.askedAt) : null }
    }
  } catch { /* fresh */ }
  return { day: dayKey(new Date()), accMs: 0, startedAt: null, verifiedMs: 0, askedAt: null }
}

// Lives above the router so the timer keeps running while you move between pages.
export function PomodoroProvider({ children }) {
  const { user } = useAuth()
  const { play } = useSound()
  const toast = useToast()
  const [finished, setFinished] = useState(null)   // set when a focus round has just ended: { minutes }
  const [focusMin, setFocusMin] = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [mode, setMode] = useState('focus')
  const [running, setRunning] = useState(false)
  const [endAt, setEndAt] = useState(0)
  const [left, setLeft] = useState(25 * 60000)
  const [msg, setMsg] = useState('')
  const [logged, setLogged] = useState(0) // bumps whenever a session is saved
  const [kind, setKindState] = useState(readKind)   // 'pomodoro' | 'countup'
  // verifiedMs: how much of the count was already confirmed by a person; askedAt: when "Still studying?" popped up (waiting for an answer)
  const [cu, setCu] = useState(() => ({ day: dayKey(new Date()), accMs: 0, startedAt: null, verifiedMs: 0, askedAt: null }))
  const [now, setNow] = useState(() => Date.now())
  const cuRef = useRef(cu)
  cuRef.current = cu

  const total = (mode === 'focus' ? focusMin : breakMin) * 60000
  const elapsedMin = Math.floor((total - left) / 60000)

  // Re-sync the display when settings change while idle.
  useEffect(() => { if (!running) setLeft(total) }, [mode, focusMin, breakMin]) // eslint-disable-line

  // Save study time. A row holds at most 4 hours, so a long stretch becomes a few rows.
  // Returns the ids of the saved rows (an empty list still counts as saved), or false if it could not be saved.
  async function logMinutes(minutes, at) {
    if (minutes < 1 || !user) return false
    let left = Math.min(minutes, MAX_DAY_MIN)
    const ids = []
    while (left > 0) {
      const part = Math.min(240, left)
      const row = { user_id: user.id, minutes: part }
      let { data, error } = await supabase.from('study_sessions').insert(at ? { ...row, created_at: at.toISOString() } : row).select('id').single()
      if (error && at) ({ data, error } = await supabase.from('study_sessions').insert(row).select('id').single())   // could not set the time: save it as now
      if (error) { setMsg(error.message); return false }
      if (data?.id) ids.push(data.id)
      left -= part
    }
    setLogged(n => n + 1)
    if (!at) {
      // say where the day stands, the same way for the Pomodoro and the count-up timer
      const since = startOfDay(new Date()).toISOString()
      const { data } = await supabase.from('study_sessions').select('minutes').eq('user_id', user.id).gte('created_at', since)
      const todayMin = (data ?? []).reduce((n, r) => n + r.minutes, 0)
      if (todayMin > 0) toast(`+${Math.min(minutes, MAX_DAY_MIN)} XP · ${todayMin} min of focus today (${todayMin} XP)`, 'xp', { silent: true })
    }
    return ids
  }

  // Tell the admin about time that nobody confirmed. Quiet if the database has not been given 052 yet.
  async function flagStudy(ids, claimed, verifiedMs) {
    if (!ids?.length) return
    try { await supabase.rpc('flag_study_check', { ids, claimed, verified: Math.min(claimed, Math.floor(verifiedMs / 60000)) }) } catch { /* not set up yet: the time is still saved */ }
  }

  async function log(minutes) {
    if (await logMinutes(minutes)) setMsg(`Logged ${minutes} min of focus. Nice work!`)
  }

  function switchMode(next) {
    setRunning(false)
    if (user && next !== 'focus') writePomo(user.id, null)
    setMode(next)
    setLeft((next === 'focus' ? focusMin : breakMin) * 60000)
  }

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const l = endAt - Date.now()
      if (l > 0) return setLeft(l)
      if (mode === 'focus') {
        // A focus round is done: celebrate, and tell them to start the break themselves.
        if (user) writePomo(user.id, null)
        log(focusMin)
        play('celebrate', { volume: .8 })
        setFinished({ minutes: focusMin })
        toast(`🎉 Focus session done! Press Start when you're ready for your ${breakMin} min break.`, 'level', { silent: true })
        try {
          if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Focus session done 🎉', { body: 'Press Start to begin your break.', tag: 'lock-in-timer' })
          }
        } catch { /* notifications blocked: fine */ }
        switchMode('break')
      } else {
        play('complete')
        toast("Break's over. Ready for another focus session?", 'info', { silent: true })
        switchMode('focus')
      }
    }, 250)
    return () => clearInterval(id)
  }, [running, endAt, mode, focusMin, breakMin]) // eslint-disable-line

  // ---- an unsaved Pomodoro round: keep it recorded while it runs, save what is left over from last time ----
  const roundRef = useRef({ doneMs: 0, runStart: null })
  useEffect(() => {
    if (!user) return
    const left0 = readPomo(user.id)
    if (left0) {
      const ms = (left0.doneMs ?? 0) + (left0.runStart ? Math.max(0, (left0.lastSeen ?? left0.runStart) - left0.runStart) : 0)
      const minutes = Math.min(120, Math.floor(ms / 60000))
      writePomo(user.id, null)
      if (minutes >= 1) {
        logMinutes(minutes, new Date(left0.lastSeen ?? Date.now())).then(ok => {
          if (ok) toast(`Saved ${minutes} min from your last focus round (the app was closed before it ended).`, 'xp')
        })
      }
    }
  }, [user?.id]) // eslint-disable-line

  useEffect(() => {
    if (!user || !running || mode !== 'focus') return
    const beat = () => writePomo(user.id, { doneMs: roundRef.current.doneMs, runStart: roundRef.current.runStart, lastSeen: Date.now() })
    beat()
    const id = setInterval(beat, 10000)
    return () => clearInterval(id)
  }, [user?.id, running, mode]) // eslint-disable-line

  // ---- count-up: load this account's clock, keep it saved, and roll over at midnight ----
  const store = state => {
    const next = { verifiedMs: 0, askedAt: null, ...state }
    setCu(next)
    cuRef.current = next
    try { localStorage.setItem(cuKey(user.id), JSON.stringify(next)) } catch { /* ignore */ }
  }

  useEffect(() => { if (user) { setCu(readCu(user.id)); cuRef.current = readCu(user.id) } }, [user?.id]) // eslint-disable-line

  const cuTotalAt = (state, t) => state.accMs + (state.startedAt ? Math.max(0, t - state.startedAt) : 0)

  // When the day changes, save yesterday's total and start today at zero (carrying on if the clock was running).
  async function rollOver(state, t) {
    const today = dayKey(new Date(t))
    if (state.day === today) return
    const dayEnd = endOfDay(state.day)
    const rawMs = state.accMs + (state.startedAt ? Math.max(0, Math.min(t, dayEnd.getTime() + 60000) - state.startedAt) : 0)
    // never save more than the last check-in + 5 h + the 1 h grace for a clock nobody confirmed
    const ms = state.startedAt ? Math.min(rawMs, (state.verifiedMs ?? 0) + STILL_AFTER_MS + STILL_GRACE_MS) : rawMs
    const minutes = Math.floor(ms / 60000)
    const running = !!state.startedAt
    const unconfirmed = ms - (state.verifiedMs ?? 0) >= STILL_AFTER_MS      // a long stretch nobody checked in on
    store({ day: today, accMs: 0, startedAt: running ? startOfDay(new Date(t)).getTime() : null })
    const ids = minutes >= 1 ? await logMinutes(minutes, dayEnd) : false
    if (ids) {
      toast(`Yesterday's count-up time was saved: ${minutes} min of focus.`, 'xp')
      if (unconfirmed) flagStudy(ids, Math.min(minutes, MAX_DAY_MIN), (state.verifiedMs ?? 0) + STILL_AFTER_MS)
    }
  }

  // "Still studying?": ask once the clock has counted 5 hours since the last check-in. If the app was closed meanwhile,
  // the question counts as asked at the moment it was due, so an unanswered hour is not waiting for someone to come back.
  const expiring = useRef(false)
  async function expireStill(s, total) {
    expiring.current = true
    try {
      // nobody is answering: stop the clock and save only up to the last check-in + 5 h + the 1 h grace.
      // Anything after that (phone asleep, app closed) never happened as far as the clock can tell.
      const capped = Math.min(total, s.verifiedMs + STILL_AFTER_MS + STILL_GRACE_MS)
      const minutes = Math.floor(capped / 60000)
      store({ day: s.day, accMs: capped - minutes * 60000, startedAt: null, askedAt: null })
      const ids = await logMinutes(minutes)
      if (ids) {
        await flagStudy(ids, Math.min(minutes, MAX_DAY_MIN), s.verifiedMs + STILL_AFTER_MS)
        toast(`Nobody answered "Still studying?", so ${Math.min(minutes, MAX_DAY_MIN)} min were saved and sent to the admin to review.`, 'info')
      } else {
        store({ day: s.day, accMs: capped, startedAt: null, verifiedMs: capped })      // could not save: keep the time, stopped
      }
    } finally { expiring.current = false }
  }
  function checkStill(t) {
    const s = cuRef.current
    if (!s.startedAt || expiring.current) return
    const total = cuTotalAt(s, t)
    let askedAt = s.askedAt
    if (!askedAt && total - s.verifiedMs >= STILL_AFTER_MS) {
      askedAt = t - (total - s.verifiedMs - STILL_AFTER_MS)
      store({ ...s, askedAt })
    }
    if (askedAt && t - askedAt >= STILL_GRACE_MS) expireStill(cuRef.current, total)
  }

  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      const t = Date.now()
      if (cuRef.current.startedAt) setNow(t)      // only re-draw every second while the clock is actually running
      checkStill(t)
      rollOver(cuRef.current, t)
    }, 1000)
    checkStill(Date.now())
    rollOver(cuRef.current, Date.now())
    return () => clearInterval(id)
  }, [user?.id]) // eslint-disable-line

  const cuRunning = !!cu.startedAt
  const cuElapsedMs = cuTotalAt(cu, now)
  const cuMinutes = Math.floor(cuElapsedMs / 60000)

  function cuStartPause() {
    const t = Date.now()
    if (cuRef.current.startedAt) {
      play('stop')
      // pausing is a check-in too: someone is there
      const total = cuTotalAt(cuRef.current, t)
      store({ ...cuRef.current, accMs: total, startedAt: null, verifiedMs: total, askedAt: null })
    } else {
      if (running) {
        // one clock at a time: pause the Pomodoro round, keeping its time
        if (user && mode === 'focus') writePomo(user.id, { doneMs: total - left, runStart: null, lastSeen: t })
        setRunning(false)
        toast('Pomodoro paused while Count up runs.', 'info', { silent: true })
      }
      play('start')
      setMsg('')
      store({ ...cuRef.current, startedAt: t })
    }
    setNow(t)
  }

  // Save what has been counted so far, without waiting for midnight, and carry on from zero.
  async function cuLogNow() {
    const t = Date.now()
    const ms = cuTotalAt(cuRef.current, t)
    const minutes = Math.floor(ms / 60000)
    if (minutes < 1) return
    const keepRunning = !!cuRef.current.startedAt
    store({ day: cuRef.current.day, accMs: ms - minutes * 60000, startedAt: keepRunning ? t : null })
    if (await logMinutes(minutes)) setMsg(`Logged ${Math.min(minutes, MAX_DAY_MIN)} min of focus. Nice work!`)
  }

  function cuReset() {
    if (cuRef.current.accMs === 0 && !cuRef.current.startedAt) return
    store({ day: cuRef.current.day, accMs: 0, startedAt: null })
  }

  // answers to "Still studying?"
  function stillYes() {
    const t = Date.now()
    const s = cuRef.current
    store({ ...s, verifiedMs: cuTotalAt(s, t), askedAt: null })
    setNow(t)
  }
  // "I stopped a while ago": count only up to the moment it asked, and pause.
  function stillStopped() {
    const s = cuRef.current
    const total = Math.min(cuTotalAt(s, Date.now()), s.verifiedMs + STILL_AFTER_MS)
    play('stop')
    store({ ...s, accMs: total, startedAt: null, verifiedMs: total, askedAt: null })
  }
  const stillAsk = cu.askedAt && cu.startedAt ? { askedAt: cu.askedAt, deadline: cu.askedAt + STILL_GRACE_MS } : null

  function setKind(next) {
    setKindState(next)
    try { localStorage.setItem(KIND_KEY, next) } catch { /* ignore */ }
  }

  useEffect(() => {
    document.title = stillAsk ? '⚠ STILL STUDYING? · LOCK IN'
      : running ? `${mmss(left)} · ${mode === 'focus' ? 'Focus' : 'Break'}`
      : cuRunning ? `${hms(cuElapsedMs)} · Counting` : APP_TITLE
  }, [running, left, mode, cuRunning, cuElapsedMs, !!stillAsk]) // eslint-disable-line

  function startPause() {
    if (running) {
      play('stop')
      // paused: what has been done so far is kept, so it is saved even if the tab is closed before resuming
      if (user && mode === 'focus') writePomo(user.id, { doneMs: total - left, runStart: null, lastSeen: Date.now() })
      return setRunning(false)
    }
    // one clock at a time: starting a round pauses the count-up timer, so the same minutes are never counted twice
    if (cuRef.current.startedAt) { cuStartPause(); toast('Count up paused while the Pomodoro runs.', 'info', { silent: true }) }
    play('start')
    setFinished(null)
    setMsg('')
    const t = Date.now()
    roundRef.current = { doneMs: total - left, runStart: t }
    setEndAt(t + left)
    setRunning(true)
  }

  async function finishEarly() {
    setRunning(false)
    if (user) writePomo(user.id, null)
    await log(elapsedMin)
    switchMode('break')
  }

  const value = {
    focusMin, setFocusMin, breakMin, setBreakMin, mode, switchMode, running, left, total,
    elapsedMin, msg, logged, startPause, finishEarly, finished, clearFinished: () => setFinished(null),
    // count-up timer
    kind, setKind, cuRunning, cuElapsedMs, cuMinutes, cuDay: cu.day, cuStartPause, cuLogNow, cuReset, maxDayMin: MAX_DAY_MIN,
    stillAsk, stillYes, stillStopped,
  }
  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>
}
