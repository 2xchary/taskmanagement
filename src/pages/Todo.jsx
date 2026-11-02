import { useState } from 'react'
import { classesFrom, useTasks } from '../lib/tasks.js'
import { levelFromXp } from '../lib/levels.js'
import { useMyXp } from '../lib/xp.jsx'
import { useToast } from '../lib/toast.jsx'
import { isDemoId } from '../lib/demo.js' // DEMO
import { fmtDay } from '../lib/dates.js'
import { supabase } from '../lib/supabase.js'
import Inbox from '../components/Inbox.jsx'
import WeekPlanner from '../components/WeekPlanner.jsx'
import TaskModal from '../components/TaskModal.jsx'

export default function Todo() {
  const { tasks, repeats, error, update, toggle, move: moveRaw, markWorked, remove: removeRaw, add: addRaw, makeRepeat, changeRepeat, stopRepeat } = useTasks()
  const { xp, refresh } = useMyXp()
  const toast = useToast()
  const [openId, setOpenId] = useState(null)
  const openTask = tasks.find(t => t.id === openId)

  // Run a change that might finish (or un-finish) a task, then say what it did to your XP.
  // `finishing` is true when the task is being completed, false when it's being un-completed.
  async function withXp(task, finishing, run) {
    const before = xp ?? 0
    await run()
    if (finishing === null || isDemoId(task.id)) return // DEMO: filler tasks are local only and earn nothing
    const after = await refresh()
    const gained = after - before
    if (finishing) {
      if (gained > 0) toast(`+${gained} XP for finishing "${task.title}"`, 'xp')
      else toast("That's today's task XP limit (10 tasks). Great work!", 'info')
      const lvBefore = levelFromXp(before)
      const lvAfter = levelFromXp(after)
      if (lvAfter > lvBefore) {
        let bonus = 0
        for (let l = lvBefore + 1; l <= lvAfter; l++) bonus += 25 * l
        toast(`🎉 Level up! You're now level ${lvAfter}. Bonus: +${bonus} coins`, 'level')
      }
    } else if (gained < 0) {
      toast(`${gained} XP (task marked not done)`, 'info')
    }
  }

  // Ticking the last planned task of a day (3 or more) earns the daily bonus; say so when it really was granted.
  const toggleTask = async task => {
    const planned = tasks.filter(t => t.day && t.day === task.day)
    const completesDay = !task.done && !isDemoId(task.id) && planned.length >= 3 && planned.every(t => t.id === task.id || t.done)
    await withXp(task, !task.done, () => toggle(task))
    if (completesDay) {
      const { data } = await supabase.from('xp_log').select('amount').eq('earned_on', task.day).eq('kind', 'day_bonus').maybeSingle()
      if (data?.amount) toast(`🎉 Every task for the day done! +${data.amount} bonus XP`, 'xp')
    }
  }
  const saveTask = (task, patch) => {
    if (patch.done === task.done) toast(`✓ Saved "${task.title}"`, 'info', { silent: true })
    return withXp(task, patch.done !== task.done ? patch.done : null, () => update(task, patch))
  }

  // small pop-ups for the everyday things, so it is clear something happened
  const addTask = (title, day, color, extra) => {
    toast(day ? `✓ Added "${title}" for ${fmtDay(new Date(day + 'T00:00:00'))}` : `✓ Added "${title}" to To plan`, 'info', { silent: true })
    return addRaw(title, day, color, extra)
  }
  const removeTask = task => {
    toast(`Removed "${task.title}"`, 'info', { silent: true })
    return removeRaw(task)
  }
  const moveTask = (task, day) => {
    toast(day ? `📅 "${task.title}" planned for ${fmtDay(new Date(day + 'T00:00:00'))}` : `"${task.title}" moved back to To plan`, 'info', { silent: true })
    return moveRaw(task, day)
  }

  const workedToday = (task, key) => {
    if (!(task.plan_done ?? []).includes(key)) toast(`✓ Nice. You did your work on "${task.title}"`, 'info', { silent: true })
    return markWorked(task, key)
  }

  return (
    <div className="todo">
      {error && <p className="warn todo-error">{error}</p>}
      <Inbox tasks={tasks} add={addTask} toggle={toggleTask} remove={removeTask} move={moveTask}
        onOpen={t => setOpenId(t.id)} />
      <WeekPlanner tasks={tasks} add={addTask} toggle={toggleTask} remove={removeTask} move={moveTask} worked={workedToday}
        onOpen={t => setOpenId(t.id)} />
      {openTask && (
        <TaskModal
          key={openTask.id}
          task={openTask}
          courses={classesFrom(tasks)}
          repeat={repeats.find(r => r.id === openTask.repeat_id) ?? null}
          onRepeat={async (change, patch) => {
            const rep = repeats.find(r => r.id === openTask.repeat_id)
            if (change.stop) { if (rep && await stopRepeat(rep)) toast('Stopped repeating. Future copies were removed.', 'info', { silent: true }) }
            else if (rep) { if (await changeRepeat(rep, change.weekdays, change.endsOn)) toast('✓ Repeat updated', 'info', { silent: true }) }
            else if (await makeRepeat({ ...openTask, ...patch }, change.weekdays, change.endsOn)) toast('✓ Repeats every week. Copies appear on your calendar.', 'info', { silent: true })
          }}
          onSave={patch => saveTask(openTask, patch)}
          onDelete={() => removeTask(openTask)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
