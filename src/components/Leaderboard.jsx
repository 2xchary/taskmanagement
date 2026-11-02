import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { fmtMinutes, startOfWeek } from '../lib/dates.js'
import { DEMO, demoLeaderboard, demoSessions } from '../lib/demo.js' // DEMO
import Avatar from './Avatar.jsx'
import MiniBadges from './MiniBadges.jsx'
import { useTopBadges } from '../lib/achievements.jsx'

const MEDAL = ['🥇', '🥈', '🥉']
const PRIZE = [150, 100, 50]          // coins for 1st, 2nd and 3rd place when the week ends (matches award_weekly_prizes)

// Weekly study ranking: your own place on top with how far the next person is, a podium for the top three, and
// everyone else below with a bar showing how they compare to the leader.
export default function Leaderboard({ version }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [winners, setWinners] = useState([])   // last week's top three
  const [tick, setTick] = useState(0)          // bumps every minute so the board stays current
  useEffect(() => {
    const bump = () => { if (document.visibilityState === 'visible') setTick(t => t + 1) }
    const id = setInterval(bump, 60000)
    document.addEventListener('visibilitychange', bump)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', bump) }
  }, [])

  useEffect(() => {
    supabase.rpc('weekly_winners').then(({ data }) => setWinners(data ?? []))
  }, [])

  useEffect(() => {
    const since = startOfWeek()
    supabase.rpc('weekly_leaderboard', { since: since.toISOString() }).then(({ data }) => {
      let list = data ?? []
      if (DEMO) { // DEMO: add the filler friends, and count your own filler study time
        const mine = demoSessions()
          .filter(s => new Date(s.created_at) >= since)
          .reduce((n, s) => n + s.minutes, 0)
        const me = list.find(r => r.user_id === user.id)
        if (me) list = list.map(r => (r === me ? { ...r, minutes: r.minutes + mine } : r))
        else if (mine > 0) {
          list = [...list, {
            user_id: user.id, display_name: user.user_metadata?.display_name ?? 'You',
            avatar_path: null, color: 'blue', frame: 'frame-none', minutes: mine,
          }]
        }
        list = [...list, ...demoLeaderboard()].sort((a, b) => b.minutes - a.minutes)
      }
      setRows(list)
    })
  }, [version, user.id, tick])

  const rank = rows.findIndex(r => r.user_id === user.id)
  const badges = useTopBadges(rows.map(r => r.user_id))
  const top = rows[0]?.minutes || 1
  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)
  // the podium shows 2nd, 1st, 3rd so the winner stands in the middle
  const podiumOrder = podium.length === 3 ? [1, 0, 2] : podium.map((_, i) => i)

  const mine = rank >= 0 ? rows[rank] : null
  const above = rank > 0 ? rows[rank - 1] : null
  const below = rank >= 0 && rank < rows.length - 1 ? rows[rank + 1] : null
  const chase = above ? Math.min(100, Math.round((mine.minutes / Math.max(1, above.minutes)) * 100)) : 100

  return (
    <section className="card fill lb-card">
      <h2>Study leaderboard <small>this week, resets Sunday night</small></h2>
      <p className="lb-prizes small muted">
        Top 3 win coins when the week ends: 🥇 {PRIZE[0]} · 🥈 {PRIZE[1]} · 🥉 {PRIZE[2]} <span>(30 focus minutes to qualify)</span>
      </p>

      {mine ? (
        <div className="lb-me">
          <div className="lb-me-top">
            <span className="lb-me-rank">#{rank + 1}</span>
            <div>
              <strong>{fmtMinutes(mine.minutes)} this week</strong>
              <small className="muted">of {rows.length} studying</small>
            </div>
          </div>
          <div className="lb-chase" role="progressbar" aria-valuenow={chase} aria-valuemin="0" aria-valuemax="100">
            <span style={{ width: chase + '%' }} />
          </div>
          <small className="muted">
            {above
              ? `${fmtMinutes(above.minutes - mine.minutes)} to pass ${above.display_name} (#${rank})`
              : below
                ? `Leading by ${fmtMinutes(mine.minutes - below.minutes)}. Keep it up!`
                : 'You are the only one on the board so far.'}
          </small>
        </div>
      ) : (
        <p className="placement muted">Finish a focus session to get on the board.</p>
      )}

      {rows.length === 0 && <p className="muted">No focus time logged yet this week. Start a focus session!</p>}

      {podium.length > 0 && (
        <div className={'lb-podium n' + podium.length}>
          {podiumOrder.map(i => {
            const r = podium[i]
            return (
              <Link key={r.user_id} to={`/profile/${r.user_id}`} className={'lb-spot place-' + (i + 1) + (r.user_id === user.id ? ' me' : '')}>
                <span className="lb-medal" aria-hidden="true">{MEDAL[i]}</span>
                {r.minutes >= 30 && <small className="lb-prize">+{PRIZE[i]} coins</small>}
                <Avatar name={r.display_name} path={r.avatar_path} color={r.color} frame={r.frame} size={i === 0 ? 56 : 46} />
                <span className="lb-name">{r.display_name}{r.user_id === user.id ? ' (you)' : ''}</span>
                <strong>{fmtMinutes(r.minutes)}</strong>
                <span className="lb-step" style={{ height: `${Math.max(18, Math.round((r.minutes / top) * 64))}px` }} />
              </Link>
            )
          })}
        </div>
      )}

      {rest.length > 0 && (
        <ol className="board scroll lb-rest" start={4}>
          {rest.map((r, i) => (
            <li key={r.user_id} className={r.user_id === user.id ? 'me' : ''}>
              <span className="rank">{i + 4}</span>
              <Avatar name={r.display_name} path={r.avatar_path} color={r.color} frame={r.frame} size={34} />
              <div className="lb-row-main">
                <div className="lb-row-line">
                  <Link to={`/profile/${r.user_id}`}>{r.display_name}{r.user_id === user.id ? ' (you)' : ''}</Link>
                  <MiniBadges userId={r.user_id} list={badges.get(r.user_id)} />
                  <span className="spacer" />
                  <strong>{fmtMinutes(r.minutes)}</strong>
                </div>
                <span className="lb-bar"><span style={{ width: Math.max(3, Math.round((r.minutes / top) * 100)) + '%' }} /></span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {winners.length > 0 && (
        <details className="lb-last">
          <summary>Last week's winners</summary>
          <ol>
            {winners.map(w => (
              <li key={w.user_id}>
                <span aria-hidden="true">{MEDAL[w.rank - 1]}</span>
                <Link to={`/profile/${w.user_id}`}>{w.display_name}{w.user_id === user.id ? ' (you)' : ''}</Link>
                <span className="spacer" />
                <small className="muted">{fmtMinutes(w.minutes)} · +{w.coins} coins</small>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}
