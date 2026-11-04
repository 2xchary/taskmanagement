import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { CHANGELOG } from '../lib/changelog.js'
import { VERSION_LABEL } from '../lib/version.js'
import { useSound } from '../lib/sfx.jsx'
import { useMembers } from '../lib/members.js'
import PickerModal from './PickerModal.jsx'

// The mail button at the top. Three things live behind it: what happened to you (comments, reactions, tags),
// announcements from the admin, and the version history. A small dot says something is new. Big ("major")
// announcements also pop up once when the app opens; closing the pop-up keeps the dot until the mail is opened.
const SEEN_KEY = 'lock-in-mail-seen'          // announcement ids and the newest version already looked at
const POP_KEY = 'lock-in-mail-popup-closed'   // major announcements whose pop-up was closed
const readList = k => { try { return JSON.parse(localStorage.getItem(k) ?? '[]') } catch { return [] } }
const writeList = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v.slice(-80))) } catch { /* ignore */ } }
const fmtDate = d => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
const POLL_MS = 90 * 1000

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function useMail() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [notifs, setNotifs] = useState([])
  const [seen, setSeen] = useState(() => readList(SEEN_KEY))
  const [closed, setClosed] = useState(() => readList(POP_KEY))

  useEffect(() => {
    if (!user || !supabase) return
    let live = true
    supabase.from('announcements').select('id, title, body, major, created_at, expires_at').order('created_at', { ascending: false }).limit(30).then(({ data }) => {
      if (!live) return
      const now = Date.now()
      setItems((data ?? []).filter(a => !a.expires_at || new Date(a.expires_at).getTime() > now))
    })
    return () => { live = false }
  }, [user?.id])

  // what happened to you: loaded now and every minute and a half while the page is showing
  const loadNotifs = useCallback(async () => {
    if (!user || !supabase) return
    const { data, error } = await supabase.from('notifications')
      .select('id, actor_id, kind, post_id, detail, read, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(40)
    if (!error) setNotifs(data ?? [])      // if the table is not there yet the list simply stays empty
  }, [user?.id]) // eslint-disable-line
  useEffect(() => {
    if (!user) { setNotifs([]); return }
    loadNotifs()
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadNotifs() }, POLL_MS)
    return () => clearInterval(t)
  }, [user?.id, loadNotifs]) // eslint-disable-line

  const newest = CHANGELOG[0].version
  const unreadNotifs = notifs.filter(n => !n.read).length
  const unread = useMemo(
    () => unreadNotifs > 0 || items.some(a => !seen.includes(a.id)) || !seen.includes('v' + newest),
    [unreadNotifs, items, seen, newest],
  )
  const markRead = useCallback(() => {
    const next = [...new Set([...seen, ...items.map(a => a.id), 'v' + newest])]
    setSeen(next); writeList(SEEN_KEY, next)
  }, [seen, items, newest])
  const markNotifsRead = useCallback(async () => {
    if (!notifs.some(n => !n.read) || !supabase) return
    setNotifs(list => list.map(n => ({ ...n, read: true })))
    await supabase.rpc('mark_notifications_read')
  }, [notifs])
  const popup = items.find(a => a.major && !closed.includes(a.id)) ?? null
  const closePopup = id => { const next = [...closed, id]; setClosed(next); writeList(POP_KEY, next) }
  // the admin's decision on a study clock that may have been left on: shown once as a pop-up until closed
  const checkPopup = notifs.find(n => n.kind === 'study_check' && !n.read && !closed.includes(n.id)) ?? null
  return { items, notifs, unreadNotifs, unread, markRead, markNotifsRead, loadNotifs, popup, closePopup, checkPopup }
}

const fmtMin = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m` }
// detail is 'keep|claimed|final', 'void|claimed|0' or 'adjust|claimed|final'
function studyCheckText(detail) {
  const [how, c, f] = String(detail ?? '').split('|')
  const claimed = Number(c) || 0, final = Number(f) || 0
  if (how === 'keep') return { title: 'Your study time was kept', body: `Your study clock ran for a long stretch (${fmtMin(claimed)}), so the admin checked it. They kept all of it. Nothing changed.` }
  if (how === 'void') return { title: 'Your study time was removed', body: `Your study clock ran for a long stretch (${fmtMin(claimed)}), so the admin checked it. They decided it was left running, so those ${fmtMin(claimed)} were removed.` }
  return { title: 'Your study time was changed', body: `Your study clock ran for a long stretch (${fmtMin(claimed)}), so the admin checked it. They changed it to ${fmtMin(final)}, which is what you actually studied.` }
}

// "Sam commented on your post", "Priya, Alex and 2 others reacted to your post"
function describe(g, nameOf) {
  const who = g.actors.map(nameOf)
  const first = who.slice(0, 2)
  const rest = who.length - first.length
  const names = rest > 0 ? `${first.join(', ')} and ${rest} other${rest === 1 ? '' : 's'}` : first.join(' and ')
  switch (g.kind) {
    case 'comment': return { icon: '💬', text: `${names} commented on your post` }
    case 'reaction': return { icon: '❤️', text: `${names} reacted to your post` }
    case 'mention_post': return { icon: '🏷️', text: `${names} tagged you in a post` }
    case 'mention_comment': return { icon: '🏷️', text: `${names} tagged you in a comment` }
    case 'study_check': return { icon: '⏱️', text: studyCheckText(g.detail).title }
    default: return { icon: '🔔', text: names }
  }
}

// reactions to the same post become one line; everything else stays as it is
function groupNotifs(notifs) {
  const out = []
  const byPost = new Map()
  for (const n of notifs) {
    if (n.kind === 'reaction') {
      const g = byPost.get(n.post_id)
      if (g) { g.actors.push(n.actor_id); g.ids.push(n.id); continue }
      const first = { key: 'r' + n.post_id, kind: 'reaction', post_id: n.post_id, actors: [n.actor_id], detail: n.detail, created_at: n.created_at, ids: [n.id] }
      byPost.set(n.post_id, first); out.push(first)
    } else {
      out.push({ key: n.id, kind: n.kind, post_id: n.post_id, actors: [n.actor_id], detail: n.detail, created_at: n.created_at, ids: [n.id] })
    }
  }
  return out
}

export default function MailButton() {
  const { user } = useAuth()
  const { play } = useSound()
  const mail = useMail()
  const members = useMembers()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('news')   // inbox | news | history
  const [fresh, setFresh] = useState(() => new Set())   // notification ids that were unread when the mail was opened

  const nameOf = useMemo(() => {
    const m = new Map(members.map(p => [p.id, p.display_name]))
    return id => m.get(id) ?? 'Someone'
  }, [members])
  const groups = useMemo(() => groupNotifs(mail.notifs), [mail.notifs])

  if (!user) return null

  const openMail = startTab => {
    const t = startTab ?? (mail.unreadNotifs > 0 ? 'inbox' : tab)
    setTab(t)
    setFresh(new Set(mail.notifs.filter(n => !n.read).map(n => n.id)))
    setOpen(true); play('open'); mail.markRead()
    mail.loadNotifs()
    if (t === 'inbox') mail.markNotifsRead()
  }
  const pickTab = t => {
    setTab(t)
    if (t === 'inbox') mail.markNotifsRead()
  }

  return (
    <>
      <button type="button" className="mail-btn" onClick={() => openMail()}
        aria-label={mail.unread ? 'Mail, something new' : 'Mail'} title="What happened to you, announcements and version history">
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7.5 8 6 8-6" />
        </svg>
        {mail.unread && <span className="mail-dot" aria-hidden="true" />}
      </button>

      {open && (
        <PickerModal title="Mail" hint="What happened to you, announcements, and what has changed in LOCK IN." onClose={() => setOpen(false)}>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'inbox'} className={tab === 'inbox' ? 'active' : ''} onClick={() => pickTab('inbox')}>
              For you{mail.unreadNotifs ? ` (${mail.unreadNotifs})` : ''}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'news'} className={tab === 'news' ? 'active' : ''} onClick={() => pickTab('news')}>
              Announcements{mail.items.length ? ` (${mail.items.length})` : ''}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => pickTab('history')}>
              What's new
            </button>
          </div>

          {tab === 'inbox' && (
            <div className="mail-list">
              {groups.length === 0 && <p className="muted">Nothing yet. Comments on your posts, reactions and tags show up here.</p>}
              {groups.map(g => {
                const d = describe(g, nameOf)
                const isFresh = g.ids.some(id => fresh.has(id))
                if (g.kind === 'study_check') {
                  return (
                    <div key={g.key} className={'notif-item' + (isFresh ? ' fresh' : '')}>
                      <span className="notif-icon" aria-hidden="true">{d.icon}</span>
                      <span>
                        <p>{d.text}</p>
                        <p className="notif-snippet">{studyCheckText(g.detail).body}</p>
                        <small className="muted">{ago(g.created_at)}</small>
                      </span>
                    </div>
                  )
                }
                return (
                  <Link key={g.key} to={g.post_id ? '/feed?post=' + g.post_id : '/feed'} className={'notif-item' + (isFresh ? ' fresh' : '')} onClick={() => setOpen(false)}>
                    <span className="notif-icon" aria-hidden="true">{d.icon}</span>
                    <span>
                      <p>{d.text}</p>
                      {g.detail && <p className="notif-snippet">“{g.detail}”</p>}
                      <small className="muted">{ago(g.created_at)}</small>
                    </span>
                  </Link>
                )
              })}
            </div>
          )}

          {tab === 'news' && (
            <div className="mail-list">
              {mail.items.length === 0 && <p className="muted">No announcements right now.</p>}
              {mail.items.map(a => (
                <article key={a.id} className="mail-item">
                  <div className="row between">
                    <strong>{a.title}</strong>
                    {a.major && <span className="mail-tag">Big update</span>}
                  </div>
                  {a.body && <p className="small">{a.body}</p>}
                  <small className="muted">{fmtDate(a.created_at)}</small>
                </article>
              ))}
            </div>
          )}

          {tab === 'history' && (
            <div className="mail-list">
              {CHANGELOG.map(v => (
                <article key={v.version} className="mail-item">
                  <div className="row between">
                    <strong>{v.title}</strong>
                    <span className="mail-tag version">{v.version}</span>
                  </div>
                  <ul className="mail-points">{v.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  <small className="muted">{fmtDate(v.date + 'T12:00:00')}</small>
                </article>
              ))}
            </div>
          )}
          <p className="muted small mail-version">LOCK IN {VERSION_LABEL}</p>
        </PickerModal>
      )}

      {mail.checkPopup && !open && (
        <div className="modal-backdrop update-popup">
          <div className="modal card stack" role="dialog" aria-modal="true" aria-label="Study time check">
            <span className="mail-tag">Study time check</span>
            <h2>{studyCheckText(mail.checkPopup.detail).title}</h2>
            <p>{studyCheckText(mail.checkPopup.detail).body}</p>
            <div className="row between">
              <button type="button" onClick={() => { mail.closePopup(mail.checkPopup.id); mail.markNotifsRead() }}>Got it</button>
            </div>
            <small className="muted">You can read this again any time in your mail, under For you.</small>
          </div>
        </div>
      )}

      {mail.popup && !open && !mail.checkPopup && (
        <div className="modal-backdrop update-popup">
          <div className="modal card stack" role="dialog" aria-modal="true" aria-label="Big update">
            <span className="mail-tag">Big update</span>
            <h2>{mail.popup.title}</h2>
            {mail.popup.body && <p>{mail.popup.body}</p>}
            <div className="row between">
              <button type="button" className="secondary" onClick={() => { mail.closePopup(mail.popup.id) }}>Close</button>
              <button type="button" onClick={() => { mail.closePopup(mail.popup.id); openMail('history') }}>See what's new</button>
            </div>
            <small className="muted">You can read this again any time from the mail button.</small>
          </div>
        </div>
      )}
    </>
  )
}
