import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, CAL_DAY_NAMES, fmtDay, isoDate, startOfCalWeek } from '../lib/dates.js'
import { classesFrom } from '../lib/tasks.js'
import { TaskItem } from './TodayList.jsx'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ALL = '__all__'      // class filter: every class
const NONE = '__none__'    // class filter: tasks with no class set

// How many open things each day has: tasks planned for it, tasks due on it, and work days.
function dayCounts(tasks) {
  const counts = {}
  const bump = (key, kind) => { const c = (counts[key] ??= { due: 0, plan: 0, work: 0 }); c[kind]++ }
  for (const t of tasks) {
    if (t.done) continue
    if (t.due_date) bump(t.due_date, 'due')
    for (const k of new Set([t.day, ...(t.plan_days ?? [])].filter(Boolean))) if (k !== t.due_date) bump(k, 'plan')   // every work day counts the same
  }
  return counts
}
const totalOf = c => (c ? c.due + c.plan + c.work : 0)
const partsOf = c => [c?.due && c.due + ' due', c?.plan && c.plan + ' to do'].filter(Boolean).join(' · ')

// A number that counts up to its value when it appears (the tiles and badges re-appear when you change week).
function CountUp({ value, ms = 380 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!value || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced') { setN(value); return }
    let raf = 0
    const t0 = performance.now()
    const tick = now => {
      const p = Math.min(1, (now - t0) / ms)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return <>{n}</>
}

// The week as seven tiles. Each shows how many things that day holds; tap one for the day. Drop a task on a tile to plan it for that day.
function WeekStrip({ days, counts, onOpenDay, tasks, move, dir }) {
  const [over, setOver] = useState('')
  const todayKey = isoDate(new Date())
  function drop(e, key) {
    e.preventDefault()
    setOver('')
    const task = tasks.find(t => t.id === e.dataTransfer.getData('text/task-id'))
    if (task && task.day !== key) move(task, key)
  }
  return (
    <div className={'wk-strip' + (dir ? ' go-' + dir : '')} key={isoDate(days[0])} role="list">
      {days.map((d, i) => {
        const key = isoDate(d)
        const c = counts[key]
        const total = totalOf(c)
        return (
          <div key={key} role="listitem" tabIndex={0}
            className={'wk-tile' + (key === todayKey ? ' today' : '') + (c?.due ? ' has-due' : '') + (over === key ? ' over' : '')}
            onClick={() => onOpenDay(d)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDay(d) } }}
            onDragOver={e => { e.preventDefault(); if (over !== key) setOver(key) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(o => (o === key ? '' : o)) }}
            onDrop={e => drop(e, key)}
            style={{ '--i': i }}
            title={total ? partsOf(c) : 'Nothing yet. Drop a task here to plan it.'}>
            <span className="wk-dow">{CAL_DAY_NAMES[i]}</span>
            <span className="wk-date">{fmtDay(d)}</span>
            <strong className="wk-count">{total ? <CountUp value={total} /> : '–'}</strong>
            <small>{total ? partsOf(c) : 'Free'}</small>
          </div>
        )
      })}
    </div>
  )
}

// The month. Each day shows how many things are on it (red when something is due); tap a day to open it.
function MonthCalendar({ counts, focus, weekKeys, onOpenDay, large }) {
  const [month, setMonth] = useState(() => new Date(focus.getFullYear(), focus.getMonth(), 1))
  const focusKey = focus.getFullYear() * 12 + focus.getMonth()
  useEffect(() => { setMonth(new Date(focus.getFullYear(), focus.getMonth(), 1)) }, [focusKey]) // eslint-disable-line
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const weeks = []
  for (let w = startOfCalWeek(month); w <= last; w = addDays(w, 7)) weeks.push(w)
  const todayKey = isoDate(new Date())
  return (
    <div className={'mini-month' + (large ? ' large' : '')} aria-label="Month overview">
      <div className="mini-head">
        <button type="button" className="link" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
        <strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong>
        <button type="button" className="link" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Next month">›</button>
      </div>
      <div className="mini-grid" key={month.getFullYear() * 12 + month.getMonth()} style={{ gridTemplateRows: `auto repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {CAL_DAY_NAMES.map(d => <span key={d} className="mini-dow">{d}</span>)}
        {weeks.flatMap(w => Array.from({ length: 7 }, (_, i) => addDays(w, i))).map(d => {
          const key = isoDate(d)
          const c = counts[key]
          const total = totalOf(c)
          return (
            <button key={key} type="button"
              className={'mini-day' + (d.getMonth() !== month.getMonth() ? ' out' : '') + (key === todayKey ? ' today' : '') + (weekKeys.has(key) ? ' in-week' : '') + (c?.due ? ' has-due' : total ? ' has-plan' : '')}
              onClick={() => onOpenDay(d)}
              title={total ? partsOf(c) : 'Nothing yet'}>
              <span>{d.getDate()}</span>
              {total > 0 && <i><CountUp value={total} ms={320} /></i>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// What is due soon, next to the month.
const AHEAD_KEY = 'lock-in-coming-up-days'
const AHEAD_CHOICES = [7, 14, 0]                  // 0 = everything (anything else is typed in the box)
const readAhead = () => { try { const n = Number(localStorage.getItem(AHEAD_KEY)); return n >= 0 && n <= 365 && localStorage.getItem(AHEAD_KEY) !== null ? n : 0 } catch { return 0 } }

function Upcoming({ tasks, onOpen }) {
  const [ahead, setAheadState] = useState(readAhead)         // how many days ahead to show (0 = all)
  const setAhead = n => { const v = Math.max(0, Math.min(365, Math.round(Number(n) || 0))); setAheadState(v); try { localStorage.setItem(AHEAD_KEY, String(v)) } catch { /* ignore */ } }
  const todayKey = isoDate(new Date())
  const lastKey = ahead ? isoDate(addDays(new Date(), ahead - 1)) : '9999-12-31'          // "3 days" = today, tomorrow and the day after
  const all = tasks.filter(t => t.due_date && !t.done && t.due_date >= todayKey && t.due_date <= lastKey)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || String(a.due_time ?? '').localeCompare(String(b.due_time ?? '')))
  const soon = all.slice(0, 60)
  return (
    <div className="upcoming">
      <div className="upcoming-head">
        <h3>Coming up <small className="muted">{all.length}</small></h3>
        <div className="ahead" role="group" aria-label="How far ahead to look">
          {AHEAD_CHOICES.map(n => (
            <button key={n} type="button" className={'ahead-btn' + (ahead === n ? ' on' : '')} aria-pressed={ahead === n} onClick={() => setAhead(n)}>
              {n === 0 ? 'All' : <><span className="ahead-long">{n} days</span><span className="ahead-short">{n}d</span></>}
            </button>
          ))}
          <input className="ahead-custom" type="number" min="1" max="365" inputMode="numeric" placeholder="days" title="Type any number of days" aria-label="Custom number of days ahead"
            value={AHEAD_CHOICES.includes(ahead) ? '' : ahead}
            onChange={e => { if (e.target.value === '') setAhead(0); else setAhead(e.target.value) }} />
        </div>
      </div>
      {soon.length === 0 ? <p className="muted small">{ahead ? (ahead === 1 ? 'Nothing due today.' : `Nothing due in the next ${ahead} days.`) : 'Nothing due soon. Set a due date on a task and it shows up here.'}</p> : (
        <ul>
          {soon.map(t => (
            <li key={t.id}>
              <button type="button" className="link" onClick={() => onOpen(t)}>
                <b>{new Date(t.due_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</b>
                <span>{t.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// One column of the planner: a single weekday, or Saturday + Sunday together as "Weekend".
function Column({ title, dates, tasks, toggle, remove, move, worked, onOpen, onExpand, full }) {
  const [over, setOver] = useState(false)
  const keys = dates.map(isoDate)
  const isWeekend = dates.length > 1
  const onWorkDay = t => keys.includes(t.day) || (t.plan_days ?? []).some(k => keys.includes(k))
  const items = tasks.filter(onWorkDay)
  const dueItems = tasks.filter(t => t.due_date && keys.includes(t.due_date) && !t.done && !onWorkDay(t))
  const workItems = []
  const done = items.filter(t => t.done).length
  const workKey = t => keys.find(k => t.day === k || (t.plan_days ?? []).includes(k))   // which of this column's days the task is planned on
  const workedCount = items.filter(t => !t.done && (t.plan_done ?? []).includes(workKey(t))).length

  const dayLabel = t => (isWeekend ? (new Date(t.day + 'T00:00:00').getDay() === 6 ? 'Sat' : 'Sun') : undefined)

  function drop(e) {
    e.preventDefault()
    setOver(false)
    const task = tasks.find(t => t.id === e.dataTransfer.getData('text/task-id'))
    if (task && !keys.includes(task.day)) move(task, keys[0])
  }

  return (
    <div
      className={'day' + (keys.includes(isoDate(new Date())) ? ' today' : '') + (over ? ' over' : '')}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false) }}
      onDrop={drop}
    >
      <h3 className={onExpand ? 'day-head tappable' : 'day-head'} onClick={onExpand}
        role={onExpand ? 'button' : undefined} tabIndex={onExpand ? 0 : undefined}
        onKeyDown={onExpand ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand() } } : undefined}>
        {title}{' '}
        <small>{isWeekend ? `${fmtDay(dates[0])} – ${fmtDay(dates[1])}` : fmtDay(dates[0])}</small>
        {items.length > 0 && <small className="count">{done}/{items.length} done{workedCount > 0 ? ` · ${workedCount} worked` : ''}</small>}
      </h3>
      <ul className="tasks scroll">
        {items.length === 0 && dueItems.length === 0 && workItems.length === 0 && <li className="muted small">Nothing here. Drop a task to plan it for this day.</li>}
        {items.length > 0 && <li className="day-group-head plan"><b className="sk sk-work">WORK</b> To do this day</li>}
        {items.map(t => (
          <TaskItem key={t.id} task={t} onToggle={toggle} onRemove={remove} onOpen={onOpen}
            draggable label={dayLabel(t)} note={keys.map(k => t.plan_notes?.[k]).find(Boolean)}
            workDay={workKey(t)} onWorked={worked} />
        ))}
        {dueItems.length > 0 && <li className="day-group-head due"><b className="sk sk-due">DUE</b> Due this day</li>}
        {dueItems.map(t => (
          <li key={'due' + t.id} className="day-extra due"><button type="button" className="link" onClick={() => onOpen(t)} title="Open this task"><b className="sk sk-due">DUE</b> {t.title}{t.due_time ? ' · ' + t.due_time.slice(0, 5) : ''}</button></li>
        ))}
        {workItems.length > 0 && <li className="day-group-head work"><b className="sk sk-work">WORK</b> Work on this day</li>}
        {workItems.map(t => (
          <li key={'work' + t.id} className="day-extra work"><button type="button" className="link" onClick={() => onOpen(t)} title="Open this task"><b className="sk sk-work">WORK</b> {t.title}</button></li>
        ))}
      </ul>
    </div>
  )
}

// The planner: the week as seven count tiles, the month beneath it, and what is due soon. Tasks themselves open in a day pop-up.
export default function WeekPlanner({ tasks, toggle, remove, move, worked, onOpen }) {
  const [mode, setMode] = useState('week')                 // 'week' | 'month'
  const [anchor, setAnchor] = useState(() => new Date())    // the week / month being looked at
  const [filter, setFilter] = useState(ALL)                 // class filter
  const [popup, setPopup] = useState(null)                  // a day opened as a pop-up
  const [dir, setDir] = useState('')                        // which way the last week change went ('next' | 'prev'), so the tiles slide that way

  const classes = classesFrom(tasks)
  const hasUnclassed = tasks.some(t => !t.course)
  const visible = tasks.filter(t => (filter === ALL ? true : filter === NONE ? !t.course : t.course === filter))
  const counts = dayCounts(visible)

  const start = startOfCalWeek(anchor)
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(start, i))
  const weekKeys = new Set(days.map(isoDate))
  const weekTasks = visible.filter(t => weekKeys.has(t.day))
  const monthTasks = visible.filter(t => t.day && t.day.slice(0, 7) === isoDate(anchor).slice(0, 7))
  const shown = mode === 'week' ? weekTasks : monthTasks
  const done = shown.filter(t => t.done).length

  const step = d => { setDir(d > 0 ? 'next' : 'prev'); setAnchor(a => (mode === 'week' ? addDays(a, d * 7) : new Date(a.getFullYear(), a.getMonth() + d, 1))) }
  const goToday = () => { const now = new Date(); setDir(startOfCalWeek(now) < start ? 'prev' : startOfCalWeek(now) > start ? 'next' : ''); setAnchor(now) }
  const label = mode === 'week' ? `${fmtDay(start)} – ${fmtDay(addDays(start, 6))}` : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`

  return (
    <section className="card fill planner">
      <div className="planner-head">
        <h2>
          Planner{' '}
          <small>{label} · {done}/{shown.length} done</small>
        </h2>
        <div className="planner-controls">
          <div className="seg" role="tablist" aria-label="Planner view">
            <button type="button" className="seg-btn" onClick={() => setPopup(new Date())} title="Open today as a day view">Day</button>
            {['week', 'month'].map(m => (
              <button key={m} type="button" role="tab" aria-selected={mode === m}
                className={'seg-btn' + (mode === m ? ' on' : '')} onClick={() => setMode(m)}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <div className="row">
            <button className="secondary" onClick={() => step(-1)} aria-label={'Previous ' + mode}>‹</button>
            <button className="secondary" onClick={goToday}>Today</button>
            <button className="secondary" onClick={() => step(1)} aria-label={'Next ' + mode}>›</button>
          </div>
        </div>
      </div>

      <div className="planner-bar">
        {(classes.length > 0 || hasUnclassed) && (
          <label className="planner-select">
            <span>Class</span>
            <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Show tasks for one class or subject">
              <option value={ALL}>All classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
              {hasUnclassed && classes.length > 0 && <option value={NONE}>No class</option>}
            </select>
          </label>
        )}
        <span className="cal-legend"><span>Numbers are how many things are on a day. <b className="lg-due">Red</b> = something is due. Tap a day to see it.</span></span>
      </div>

      {mode === 'week' && <WeekStrip days={days} counts={counts} onOpenDay={setPopup} tasks={visible} move={move} dir={dir} />}

      <div className={'planner-foot' + (mode === 'month' ? ' month-only' : '')}>
        <MonthCalendar counts={counts} focus={anchor} weekKeys={mode === 'week' ? weekKeys : new Set()} onOpenDay={setPopup} large />
        <Upcoming tasks={visible} onOpen={onOpen} />
      </div>

      {popup && createPortal(
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setPopup(null) }}>
          <div className="modal day-pop" role="dialog" aria-modal="true" aria-label="Day view">
            <div className="row between">
              <span className="row">
                <button type="button" className="secondary" onClick={() => setPopup(d => addDays(d, -1))} aria-label="Previous day">‹</button>
                <button type="button" className="secondary" onClick={() => setPopup(d => addDays(d, 1))} aria-label="Next day">›</button>
              </span>
              <h2>{popup.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              <button type="button" className="link" onClick={() => setPopup(null)} aria-label="Close">×</button>
            </div>
            <Column title={popup.toLocaleDateString(undefined, { weekday: 'long' })} dates={[popup]} tasks={visible}
              toggle={toggle} remove={remove} move={move} worked={worked} onOpen={t => { setPopup(null); onOpen(t) }} full />
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}
