import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useIsAdmin } from '../lib/moderation.js'
import { useToast } from '../lib/toast.jsx'
import { removeImage } from '../lib/storage.js'
import PickerModal from '../components/PickerModal.jsx'
import { FLAGS_CHANGED, StudyFlagCard } from '../components/StudyFlags.jsx'

const TABS = [['overview', 'Overview'], ['users', 'People'], ['reports', 'Reports'], ['study', 'Study checks'], ['posts', 'Posts'], ['announce', 'Announcements'], ['log', 'Activity']]
const fmtDate = d => (d ? new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '')
const fmtWhen = d => (d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

// The admin dashboard. Only people in the app_admins table can use it: every function it calls checks that on the server,
// so this page showing up (or not) is only a convenience.
export default function Admin() {
  const isAdmin = useIsAdmin()
  const [checked, setChecked] = useState(false)
  useEffect(() => { const t = setTimeout(() => setChecked(true), 1500); return () => clearTimeout(t) }, [])
  const toast = useToast()
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState({ overview: null, users: [], posts: [], reports: [], log: [], announcements: [], flags: [] })
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [dialog, setDialog] = useState(null)      // { type, user }

  const call = useCallback(async (fn, args) => {
    const { data: d, error } = await supabase.rpc(fn, args)
    if (error) { toast(error.message); return { error } }
    return { data: d }
  }, [toast])

  const load = useCallback(async () => {
    setLoading(true)
    const [o, u, p, r, l, a, f] = await Promise.all([
      supabase.rpc('admin_overview'), supabase.rpc('admin_list_users'), supabase.rpc('admin_recent_posts', { n: 60 }),
      supabase.rpc('admin_list_reports'), supabase.rpc('admin_recent_log', { n: 60 }),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.rpc('admin_study_flags'),
    ])
    setData({ overview: o.data, users: u.data ?? [], posts: p.data ?? [], reports: r.data ?? [], log: l.data ?? [], announcements: a.data ?? [], flags: Array.isArray(f.data) ? f.data : [] })
    setLoading(false)
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const users = useMemo(() => {
    const s = q.trim().toLowerCase()
    return !s ? data.users : data.users.filter(u => [u.display_name, u.username, u.email, u.college].some(v => String(v ?? '').toLowerCase().includes(s)))
  }, [data.users, q])

  if (!isAdmin) return checked ? <Navigate to="/" replace /> : <p className="muted">Checking…</p>

  const openReports = data.reports.filter(r => r.status === 'open')
  const openFlags = data.flags.filter(f => f.status === 'open')

  async function resolveFlag(flag, how, true_minutes) {
    const r = await call('admin_resolve_study_flag', { fid: flag.id, how, true_minutes: true_minutes ?? null })
    if (r.error) return
    toast(how === 'keep' ? 'Kept as saved' : how === 'void' ? 'Voided' : 'Changed to the true time', 'info', { silent: true })
    window.dispatchEvent(new Event(FLAGS_CHANGED))
    load()
  }

  async function act(fn, args, ok) {
    const r = await call(fn, args)
    if (!r.error) { toast(ok, 'info', { silent: true }); await load() }
    return r
  }

  async function deletePost(p) {
    if (!confirm('Delete this post?')) return
    const r = await call('admin_delete_post', { pid: p.id })
    if (r.error) return
    if (r.data) { try { await removeImage(r.data) } catch { /* the image may already be gone */ } }
    toast('Post deleted', 'info', { silent: true })
    load()
  }

  return (
    <div className="admin">
      <header className="card admin-head">
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted small">Only you can see this page. Everything here runs through checked server functions and is recorded in the activity log.</p>
        </div>
        <div className="row">
          <button type="button" className="secondary" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          <Link to="/terms"><button type="button" className="secondary">Community rules</button></Link>
        </div>
      </header>

      <div className="tabs admin-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}{id === 'reports' && openReports.length > 0 ? ` (${openReports.length})` : ''}{id === 'study' && openFlags.length > 0 ? ` (${openFlags.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section className="admin-cards">
          {data.overview ? [
            ['People', data.overview.users, `${data.overview.new_7d} new this week`],
            ['Active this week', data.overview.active_7d, 'studied at least once'],
            ['Focus hours (7d)', data.overview.focus_hours_7d, 'across everyone'],
            ['Tasks finished (7d)', data.overview.tasks_done_7d, 'earned XP'],
            ['Posts', data.overview.posts, `${data.overview.posts_7d} this week`],
            ['Comments', data.overview.comments, ''],
            ['Open reports', data.overview.reports_open, data.overview.reports_open ? 'need a look' : 'all clear'],
            ['Muted / banned', `${data.overview.muted} / ${data.overview.banned}`, 'right now'],
          ].map(([label, v, sub]) => (
            <div key={label} className="card admin-stat"><strong>{v}</strong><span>{label}</span><small className="muted">{sub}</small></div>
          )) : <p className="muted">Loading…</p>}
        </section>
      )}

      {tab === 'users' && (
        <section className="card">
          <div className="row between">
            <h2>People <small>{data.users.length}</small></h2>
            <input className="admin-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, username, email…" />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Person</th><th>Lv</th><th>XP</th><th>Coins</th><th>Posts</th><th>Joined</th><th>Status</th><th /></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><Link to={`/profile/${u.id}`}><strong>{u.display_name}</strong></Link>
                      <div className="muted small">{u.username ? '@' + u.username + ' · ' : ''}{u.email}</div></td>
                    <td>{u.level}</td><td>{u.xp}</td><td>{u.coins}</td><td>{u.posts}/{u.comments}</td><td>{fmtDate(u.created_at)}</td>
                    <td><span className={'status-pill ' + u.status}>{u.status}</span>{u.mod_until && u.status !== 'active' ? <div className="muted small">until {fmtDate(u.mod_until)}</div> : null}</td>
                    <td className="admin-actions">
                      <button type="button" className="secondary" onClick={() => setDialog({ type: 'moderate', user: u })}>Moderate</button>
                      <button type="button" className="secondary" onClick={() => setDialog({ type: 'grant', user: u })}>Give</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan="8" className="muted">No one matches.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted small">Posts column shows posts / comments. Muted people can't post or comment until it lifts; banned people can't until you lift it.</p>
        </section>
      )}

      {tab === 'reports' && (
        <section className="stack">
          {data.reports.length === 0 && <p className="muted">No reports. Nice.</p>}
          {data.reports.map(r => (
            <article key={r.id} className={'card admin-report' + (r.status === 'open' ? '' : ' resolved')}>
              <div className="row between">
                <strong>{r.target ?? 'Someone'} <small className="muted">· reported by {r.reporter ?? 'someone'} · {fmtWhen(r.created_at)}</small></strong>
                <span className={'status-pill ' + (r.status === 'open' ? 'muted' : 'active')}>{r.status}</span>
              </div>
              <p className="small"><em>{r.reason}</em></p>
              {r.content && <blockquote className="admin-quote">{r.content}</blockquote>}
              {r.status === 'open' && (
                <div className="row">
                  {r.post_id && <button type="button" className="secondary" onClick={() => deletePost({ id: r.post_id })}>Delete post</button>}
                  {r.comment_id && <button type="button" className="secondary" onClick={async () => { if (confirm('Delete this comment?')) { await act('admin_delete_comment', { cid: r.comment_id }, 'Comment deleted') } }}>Delete comment</button>}
                  {r.target_user && <button type="button" className="secondary" onClick={() => setDialog({ type: 'moderate', user: data.users.find(u => u.id === r.target_user) ?? { id: r.target_user, display_name: r.target ?? 'this person' } })}>Mute / ban…</button>}
                  <button type="button" onClick={() => act('admin_resolve_report', { rid: r.id, outcome: 'dismissed' }, 'Report closed')}>Dismiss</button>
                  <button type="button" onClick={() => act('admin_resolve_report', { rid: r.id, outcome: 'actioned' }, 'Report closed')}>Mark handled</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {tab === 'study' && (
        <section className="stack">
          <p className="muted small">When the count-up timer runs 5 hours and nobody answers “Still studying?” for an hour, the time is saved anyway and lands here for you to keep, change to the true time, or void.</p>
          {data.flags.length === 0 && <p className="muted">Nothing to check. All clear.</p>}
          {data.flags.map(f => <StudyFlagCard key={f.id} flag={f} onResolve={resolveFlag} />)}
        </section>
      )}

      {tab === 'posts' && (
        <section className="stack">
          {data.posts.length === 0 && <p className="muted">No posts yet.</p>}
          {data.posts.map(p => (
            <article key={p.id} className="card admin-post">
              <div className="row between">
                <strong>{p.author ?? 'Someone'} <small className="muted">· {fmtWhen(p.created_at)} · {p.comments} comments{p.reports ? ` · ${p.reports} open report${p.reports === 1 ? '' : 's'}` : ''}</small></strong>
                <button type="button" className="secondary" onClick={() => deletePost(p)}>Delete</button>
              </div>
              {p.body && <p>{p.body}</p>}
              {p.image_path && <small className="muted">📷 has a photo</small>}
            </article>
          ))}
        </section>
      )}

      {tab === 'announce' && (
        <section className="stack">
          <AnnounceForm onSend={(head, msg, days, major) => act('admin_post_announcement', { head, msg, days, is_major: major }, major ? 'Big update sent' : 'Announcement posted')} />
          {data.announcements.map(a => (
            <article key={a.id} className="card">
              <div className="row between">
                <strong>{a.title}{a.major ? ' · big update' : ''}</strong>
                <button type="button" className="link" onClick={() => act('admin_delete_announcement', { aid: a.id }, 'Removed')}>remove</button>
              </div>
              {a.body && <p className="small">{a.body}</p>}
              <small className="muted">Posted {fmtWhen(a.created_at)}{a.expires_at ? ` · until ${fmtDate(a.expires_at)}` : ''}</small>
            </article>
          ))}
        </section>
      )}

      {tab === 'log' && (
        <section className="card">
          <h2>What you did</h2>
          <ul className="list">
            {data.log.length === 0 && <li className="muted">Nothing yet.</li>}
            {data.log.map((l, i) => (
              <li key={i}><span>{fmtWhen(l.created_at)}</span><strong>{l.action}{l.target ? ` · ${l.target}` : ''}</strong><span className="muted small">{l.detail}</span></li>
            ))}
          </ul>
        </section>
      )}

      {dialog?.type === 'moderate' && (
        <ModerateDialog user={dialog.user} onClose={() => setDialog(null)}
          onApply={async (status, why, days) => {
            const r = await act('admin_set_moderation', { uid: dialog.user.id, new_status: status, why, days }, status === 'active' ? 'Restrictions lifted' : status === 'muted' ? 'Muted' : 'Banned from posting')
            if (!r.error) setDialog(null)
          }} />
      )}
      {dialog?.type === 'grant' && (
        <GrantDialog user={dialog.user} onClose={() => setDialog(null)}
          onCoins={async (amount, note) => { const r = await act('admin_grant_coins', { uid: dialog.user.id, amount, note }, `Coins updated (${amount > 0 ? '+' : ''}${amount})`); if (!r.error) setDialog(null) }}
          onItem={async item => { const r = await act('admin_grant_item', { uid: dialog.user.id, item }, 'Item given'); if (!r.error) setDialog(null) }} />
      )}
    </div>
  )
}

function AnnounceForm({ onSend }) {
  const [head, setHead] = useState('')
  const [msg, setMsg] = useState('')
  const [days, setDays] = useState(30)
  const [major, setMajor] = useState(false)
  return (
    <form className="card stack" onSubmit={async e => { e.preventDefault(); if (!head.trim()) return; await onSend(head.trim(), msg.trim(), Number(days), major); setHead(''); setMsg(''); setMajor(false) }}>
      <h2>Send an announcement</h2>
      <p className="muted small">It goes to everyone's mail (the envelope at the top). A small dot appears on it until they open it.</p>
      <input value={head} maxLength={100} onChange={e => setHead(e.target.value)} placeholder="Headline" required />
      <textarea value={msg} maxLength={600} rows={3} onChange={e => setMsg(e.target.value)} placeholder="Details (optional)" />
      <label className="row"><input type="checkbox" checked={major} onChange={e => setMajor(e.target.checked)} /> Big update: also show it as a pop-up when people open the app</label>
      <label className="row">Keep it in the mail for <input type="number" min="1" max="365" value={days} onChange={e => setDays(e.target.value)} style={{ width: '5rem' }} /> days</label>
      <button type="submit">Post announcement</button>
    </form>
  )
}

function ModerateDialog({ user, onClose, onApply }) {
  const [status, setStatus] = useState(user.status === 'active' || !user.status ? 'muted' : user.status)
  const [days, setDays] = useState(user.status === 'banned' ? 0 : 3)
  const [why, setWhy] = useState('')
  return (
    <PickerModal title={`Moderate ${user.display_name}`} hint="A mute or ban only stops posting and commenting. They can still use everything else." onClose={onClose}>
      <div className="stack">
        {[['muted', 'Mute for a set time'], ['banned', 'Ban from posting and commenting']].map(([v, label]) => (
          <label key={v} className="row"><input type="radio" name="mod" checked={status === v} onChange={() => { setStatus(v); setDays(v === 'muted' ? 3 : 0) }} /> {label}</label>
        ))}
        <label className="row">For <input type="number" min="0" max="365" value={days} onChange={e => setDays(e.target.value)} style={{ width: '5rem' }} /> days <small className="muted">(0 = until you lift it)</small></label>
        <input value={why} maxLength={300} onChange={e => setWhy(e.target.value)} placeholder="Reason (they will see this)" />
        <div className="row">
          <button type="button" onClick={() => onApply(status, why, Number(days))}>Apply</button>
          {user.status && user.status !== 'active' && <button type="button" className="secondary" onClick={() => onApply('active', '', null)}>Lift restrictions</button>}
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </PickerModal>
  )
}

function GrantDialog({ user, onClose, onCoins, onItem }) {
  const [amount, setAmount] = useState(100)
  const [note, setNote] = useState('')
  const [items, setItems] = useState([])
  const [item, setItem] = useState('')
  useEffect(() => {
    supabase.from('shop_items').select('id, name, kind').order('kind').order('sort').then(({ data }) => setItems(data ?? []))
  }, [])
  return (
    <PickerModal title={`Give to ${user.display_name}`} hint="Coins can be negative to take some back." onClose={onClose}>
      <div className="stack">
        <div className="row">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '7rem' }} aria-label="Coins" />
          <input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="Note (e.g. thanks for testing)" />
          <button type="button" onClick={() => onCoins(Number(amount), note)} disabled={!Number(amount)}>Give coins</button>
        </div>
        <div className="row">
          <select value={item} onChange={e => setItem(e.target.value)}>
            <option value="">Give a shop item…</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.kind}: {i.name}</option>)}
          </select>
          <button type="button" onClick={() => onItem(item)} disabled={!item}>Give item</button>
        </div>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
    </PickerModal>
  )
}
