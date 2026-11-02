import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { useAuth } from './auth.jsx'
import { addDays, isoDate, startOfWeek } from './dates.js'
import { DEMO, demoTasks, isDemoId } from './demo.js' // DEMO

export const CATEGORIES = ['Homework', 'Exam', 'Project', 'Reading', 'Study', 'Work', 'Personal', 'Other']

export const REPEAT_WEEKS = 5     // how far ahead a weekly repeat is turned into tasks

// The tasks a set of weekly repeats still needs: one per matching day from today for the next few weeks.
function missingCopies(repeats, have, userId) {
  const out = []
  const today = new Date()
  for (const r of repeats) {
    const days = new Set(r.weekdays)
    const skips = new Set(r.skips ?? [])
    const mine = new Set(have.filter(t => t.repeat_id === r.id).map(t => t.day))
    for (let i = 0; i < REPEAT_WEEKS * 7; i++) {
      const d = addDays(today, i)
      const key = isoDate(d)
      if (!days.has(d.getDay()) || key < r.starts_on || (r.ends_on && key > r.ends_on) || skips.has(key) || mine.has(key)) continue
      out.push({ user_id: userId, repeat_id: r.id, title: r.title, course: r.course, category: r.category, color: r.color, notes: r.notes, day: key })
    }
  }
  return out
}

// The classes/subjects already used on tasks, most recently used first.
export function classesFrom(tasks) {
  const sorted = [...tasks].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return [...new Set(sorted.map(t => t.course).filter(Boolean))]
}

// Loads every unscheduled task plus a window around the current week,
// so the planner can page a few weeks either way.
export function useTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [error, setError] = useState('')
  const [demo, setDemo] = useState(() => (DEMO ? demoTasks() : [])) // DEMO: local-only filler tasks

  const [repeats, setRepeats] = useState([])    // weekly repeats (see 047_weekly_repeats.sql); empty until the database has them
  const repeatsRef = useRef([])
  repeatsRef.current = repeats

  const load = useCallback(async () => {
    // Finished tasks tidy themselves away a week after they were ticked off (see 020_auto_clean_done_tasks.sql).
    // Ignored if the database hasn't been given that step yet.
    try { await supabase.rpc('purge_my_done_tasks') } catch { /* not set up yet: fine */ }
    const week = startOfWeek()
    const from = isoDate(addDays(week, -28))
    const to = isoDate(addDays(week, 90))
    const fetchTasks = () => supabase
      .from('tasks')
      .select('*')
      .or(`day.is.null,and(day.gte.${from},day.lte.${to}),and(due_date.gte.${from},due_date.lte.${to})`)
      .order('created_at')
    let { data, error } = await fetchTasks()
    if (error) return setError(error.message)
    // weekly repeats: make sure each one has its copies for the next few weeks
    const rep = await supabase.from('task_repeats').select('*').order('created_at')
    const list = rep.error ? [] : (rep.data ?? [])
    setRepeats(list)
    if (list.length && user) {
      const rows = missingCopies(list, data, user.id)
      if (rows.length) {
        await supabase.from('tasks').insert(rows)     // an error here (another device was first) is fine: we re-read below
        const again = await fetchTasks()
        if (!again.error) data = again.data
      }
    }
    setTasks(data)
  }, [user?.id]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  // `day` may be null (goes to the To plan list). `extra` can hold course, category, due_date, etc.
  async function add(title, day, color, extra = {}) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, day, color, user_id: user.id, ...extra })
      .select()
      .single()
    if (error) return setError(error.message)
    setTasks(t => [...t, data])
  }

  // A copy of a weekly repeat that is moved or deleted must not come back on its old day.
  async function skipDay(task) {
    const rep = repeatsRef.current.find(r => r.id === task.repeat_id)
    if (!rep || !task.day || (rep.skips ?? []).includes(task.day)) return
    const skips = [...(rep.skips ?? []), task.day].slice(-200)
    setRepeats(rs => rs.map(r => (r.id === rep.id ? { ...r, skips } : r)))
    await supabase.from('task_repeats').update({ skips }).eq('id', rep.id)
  }

  async function update(task, patch) {
    if (isDemoId(task.id)) { // DEMO
      return setDemo(d => d.map(x => (x.id === task.id ? { ...x, ...patch } : x)))
    }
    if (task.repeat_id && 'day' in patch && patch.day !== task.day) await skipDay(task)
    setTasks(t => t.map(x => (x.id === task.id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('tasks').update(patch).eq('id', task.id)
    if (error) { setError(/plan_done/.test(error.message) ? 'Ticking off a work day needs a database update first (supabase/052_work_done_and_study_checks.sql).' : error.message); load() }
  }

  const toggle = task => update(task, { done: !task.done })
  const move = (task, day) => update(task, { day })

  // "I did my work for the day": ticks (or un-ticks) one work day of a task, separate from finishing the whole task.
  const markWorked = (task, key) => {
    const have = task.plan_done ?? []
    return update(task, { plan_done: have.includes(key) ? have.filter(k => k !== key) : [...have, key].sort() })
  }

  async function remove(task) {
    if (isDemoId(task.id)) return setDemo(d => d.filter(x => x.id !== task.id)) // DEMO
    if (task.repeat_id) await skipDay(task)
    setTasks(t => t.filter(x => x.id !== task.id))
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) { setError(error.message); load() }
  }

  // ---- weekly repeats ----
  const needsDb = e => (/task_repeats|repeat_id|does not exist|schema cache/i.test(e.message) ? 'Weekly repeats need a database update first (supabase/047_weekly_repeats.sql).' : e.message)

  // Make a task repeat every week on these weekdays (0 = Sunday). This task becomes one of the copies when its day fits.
  async function makeRepeat(task, weekdays, endsOn) {
    const row = { user_id: user.id, title: task.title, course: task.course ?? '', category: task.category ?? '', color: task.color ?? 'blue', notes: task.notes ?? '',
      weekdays, starts_on: isoDate(new Date()), ends_on: endsOn || null }
    const { data, error } = await supabase.from('task_repeats').insert(row).select().single()
    if (error) { setError(needsDb(error)); return false }
    if (task.day && weekdays.includes(new Date(task.day + 'T00:00:00').getDay()) && (!endsOn || task.day <= endsOn)) {
      await supabase.from('tasks').update({ repeat_id: data.id }).eq('id', task.id)
    }
    await load()
    return true
  }

  // New weekdays or end date: copies that no longer fit are removed (only future, unfinished ones), new ones appear.
  async function changeRepeat(rep, weekdays, endsOn) {
    const { error } = await supabase.from('task_repeats').update({ weekdays, ends_on: endsOn || null }).eq('id', rep.id)
    if (error) { setError(needsDb(error)); return false }
    const today = isoDate(new Date())
    const stale = tasks.filter(t => t.repeat_id === rep.id && !t.done && t.day >= today
      && (!weekdays.includes(new Date(t.day + 'T00:00:00').getDay()) || (endsOn && t.day > endsOn))).map(t => t.id)
    if (stale.length) await supabase.from('tasks').delete().in('id', stale)
    await load()
    return true
  }

  // Stop repeating: future unfinished copies go away; finished and past ones stay as ordinary tasks.
  async function stopRepeat(rep) {
    await supabase.from('tasks').delete().eq('repeat_id', rep.id).eq('done', false).gte('day', isoDate(new Date()))
    const { error } = await supabase.from('task_repeats').delete().eq('id', rep.id)
    if (error) { setError(needsDb(error)); return false }
    await load()
    return true
  }

  return { tasks: [...demo, ...tasks], repeats, error, add, update, toggle, move, markWorked, remove, makeRepeat, changeRepeat, stopRepeat } // DEMO: was `tasks`
}
