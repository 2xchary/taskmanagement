import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { publicUrl, removeImage, thumbUrl, uploadImage } from '../lib/storage.js'
import { useToast } from '../lib/toast.jsx'
import { useTopBadges } from '../lib/achievements.jsx'
import MiniBadges from '../components/MiniBadges.jsx'
import ReportButton from '../components/ReportButton.jsx'
import { useMyModeration, blockedText, useIsAdmin } from '../lib/moderation.js'
import Avatar from '../components/Avatar.jsx'
import { POST_KINDS } from '../lib/postKinds.js'
import ShareButton from '../components/ShareButton.jsx'
import MentionField from '../components/MentionField.jsx'
import PeopleSearch from '../components/PeopleSearch.jsx'
import { badgeIcon } from '../lib/badgeIcon.js'
import { usePhone } from '../lib/phone.js'
import RichText from '../components/RichText.jsx'
import { mentionedIds, useMembers } from '../lib/members.js'
import { DEMO, demoComments, demoPosts } from '../lib/demo.js' // DEMO

const REACTIONS = [
  { kind: 'like', icon: '❤️', word: 'Likes' },
  { kind: 'fire', icon: '🔥', word: 'Fire' },
  { kind: 'clap', icon: '👏', word: 'Claps' },
  { kind: 'strong', icon: '💪', word: 'Strong' },
]
const kindOf = id => POST_KINDS.find(k => k.id === id)

const MAX_CAPTION = 280
const MAX_COMMENT = 200
const PAGE = 20                    // posts shown at a time; "Load more" fetches the next batch
const EDIT_MINUTES = 10            // how long after posting you can change the words
const KEEP_DAYS = 14               // posts are removed from the app and storage after this (supabase/031_save_space.sql)
const POST_COLS = 'id, user_id, body, image_path, kind, edited_at, created_at, pinned, share_kind, share_data, mentions, profiles(display_name, avatar_path, color, frame), reactions(kind, user_id), comments(count)'

// "just now", "5m ago", "2h ago", "3d ago", then a date
function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// whole days until a post is cleared away (it goes on the night after its 14th day)
function daysLeft(iso) {
  const born = new Date(iso); born.setHours(0, 0, 0, 0)
  const gone = born.getTime() + (KEEP_DAYS + 1) * 86400000
  return Math.max(0, Math.floor((gone - Date.now()) / 86400000))
}

function Composer({ onPosted }) {
  const { user } = useAuth()
  const toast = useToast()
  const mod = useMyModeration()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [kind, setKind] = useState(null)
  const [tagged, setTagged] = useState([])        // ids picked with @
  const members = useMembers()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef()
  const cameraInput = useRef()
  // only a touch device (phone or tablet) offers "Take a photo"; a computer just has "Choose a file"
  const hasCamera = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const pickPhoto = e => {
    const f = e.target.files[0] ?? null
    if (!f) return
    setFile(f)
    toast(`📷 Photo chosen: ${f.name}`, 'info', { silent: true })
    e.target.value = ''
  }
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function submit(e) {
    e.preventDefault()
    if (!file && !caption.trim()) return setError('Add a photo or write a few words.')
    setBusy(true); setError('')
    let image_path = null
    try {
      if (file) image_path = await uploadImage(file, user.id)
      const mentions = mentionedIds(caption, tagged, members)
      const { error } = await supabase.from('posts').insert({ user_id: user.id, body: caption.trim(), image_path, kind, mentions })
      if (error) { await removeImage(image_path); throw error }
      setFile(null); setCaption(''); setKind(null); setTagged([]); if (input.current) input.current.value = ''
      setOpen(false)
      toast('✓ Posted to your feed')
      // the post boost (once a day): say so only when it really is ready
      supabase.rpc('boost_status').then(({ data }) => {
        if (data?.ready) setTimeout(() => toast('✨ Post boost: your next focus session earns double coins', 'xp'), 900)
      })
      onPosted()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="composer-bar card" onClick={() => setOpen(true)} disabled={!!mod.status}>
        <span aria-hidden="true">✏️</span> Share your progress…
      </button>
    )
  }

  return (
    <form className="card stack composer" onSubmit={submit}>
      <div className="row between">
        <h2>Share your progress</h2>
        <button type="button" className="link" onClick={() => setOpen(false)}>Close</button>
      </div>
      {mod.status && <p className="warn">{blockedText(mod)}</p>}
      <MentionField multiline value={caption} onChange={setCaption} mentions={tagged} onMentions={setTagged}
        maxLength={MAX_CAPTION} rows={3} ariaLabel="Post text"
        placeholder="What did you get done? A photo is optional. Type @ to tag a friend." />
      <div className="kind-chips" role="group" aria-label="Tag">
        {POST_KINDS.map(k => (
          <button key={k.id} type="button" className={'kind-chip' + (kind === k.id ? ' on' : '')}
            aria-pressed={kind === k.id} onClick={() => setKind(kind === k.id ? null : k.id)}>
            <span aria-hidden="true">{k.icon}</span> {k.label}
          </button>
        ))}
      </div>
      {/* a photo is optional: take one (phones and tablets only) or choose a file */}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden aria-label="Take a photo" onChange={pickPhoto} />
      <input ref={input} type="file" accept="image/*" hidden aria-label="Choose a photo file" onChange={pickPhoto} />
      <div className="photo-actions">
        {hasCamera && (
          <button type="button" className="secondary" onClick={() => cameraInput.current?.click()}>📷 Take a photo</button>
        )}
        <button type="button" className="secondary" onClick={() => input.current?.click()}>🖼️ Choose a file</button>
        {file && <button type="button" className="secondary" onClick={() => { setFile(null); if (input.current) input.current.value = ''; if (cameraInput.current) cameraInput.current.value = '' }}>Remove photo</button>}
      </div>
      {preview && <img className="preview" src={preview} alt="Preview" />}
      <div className="row between">
        <small className="muted">{caption.length}/{MAX_CAPTION} · Posts disappear after {KEEP_DAYS} days · <Link to="/terms">Community rules</Link></small>
        <button disabled={busy || !!mod.status}>{busy ? 'Posting…' : 'Post'}</button>
      </div>
      {error && <p className="warn">{error}</p>}
    </form>
  )
}

function Comments({ post, onCount }) {
  const { user } = useAuth()
  const toast = useToast()
  const mod = useMyModeration()
  const [items, setItems] = useState(null)
  const [body, setBody] = useState('')
  const [tagged, setTagged] = useState([])
  const members = useMembers()
  const [error, setError] = useState('')
  const isPostAuthor = post.user_id === user.id

  const load = useCallback(async () => {
    if (post.demo) { setItems(prev => prev ?? demoComments(post.id)); return } // DEMO
    const { data, error } = await supabase
      .from('comments')
      .select('id, user_id, body, created_at, mentions, profiles(display_name, avatar_path, color, frame)')
      .eq('post_id', post.id)
      .order('created_at')
    if (error) setError(error.message)
    else setItems(data)
  }, [post.id, post.demo])

  useEffect(() => { load() }, [load])
  // new comments show up on their own while this box is open (every 15 s, and when you come back to the tab)
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') load() }
    const id = setInterval(tick, 15000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [load])
  useEffect(() => { if (items) onCount(items.length) }, [items]) // eslint-disable-line

  async function add(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setError('')
    if (post.demo) { // DEMO: comments on filler posts stay in the browser
      setItems(cs => [...cs, {
        id: `demo-c-${Date.now()}`, user_id: user.id, body: text, created_at: new Date().toISOString(),
        profiles: { display_name: user.user_metadata?.display_name ?? 'You', color: 'blue', frame: 'frame-none' },
      }])
      toast('💬 Comment sent')
      return setBody('')
    }
    const mentions = mentionedIds(text, tagged, members)
    const { error } = await supabase.from('comments').insert({ post_id: post.id, user_id: user.id, body: text, mentions })
    if (error) return setError(error.message)
    setBody(''); setTagged([])
    toast('💬 Comment sent')
    load()
  }

  async function remove(c) {
    if (post.demo) { setItems(cs => cs.filter(x => x.id !== c.id)); toast('Comment deleted', 'info', { silent: true }); return } // DEMO
    const { error } = await supabase.from('comments').delete().eq('id', c.id)
    if (error) return setError(error.message)
    toast('Comment deleted', 'info', { silent: true })
    load()
  }

  return (
    <div className="comments">
      {items === null && !error && <p className="muted small">Loading…</p>}
      {items?.length === 0 && <p className="muted small">No comments yet. Be the first to write one.</p>}
      <ul>
        {items?.map(c => (
          <li key={c.id}>
            <Avatar name={c.profiles?.display_name} path={c.profiles?.avatar_path} color={c.profiles?.color}
              frame={c.profiles?.frame} size={30} />
            <div className="comment-body">
              <div>
                <Link to={`/profile/${c.user_id}`}><strong>{c.profiles?.display_name ?? 'Someone'}</strong></Link>
                {' '}<span className="muted small" title={new Date(c.created_at).toLocaleString()}>{timeAgo(c.created_at)}</span>
              </div>
              <span><RichText text={c.body} mentions={c.mentions} members={members} /></span>
            </div>
            {(c.user_id === user.id || isPostAuthor) && (
              <button className="link" aria-label="Delete comment" onClick={() => remove(c)}>×</button>
            )}
            {c.user_id !== user.id && !post.demo && <ReportButton commentId={c.id} className="link report-link" />}
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={add}>
        <MentionField value={body} onChange={setBody} mentions={tagged} onMentions={setTagged}
          maxLength={MAX_COMMENT} placeholder="Write a comment… (@ to tag)" ariaLabel="Write a comment" />
        <button disabled={!body.trim() || !!mod.status}>Comment</button>
      </form>
      {mod.status && <p className="warn small">{blockedText(mod)}</p>}
      {error && <p className="warn">{error}</p>}
    </div>
  )
}

function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose}>
      <img src={src} alt={alt} />
      <button type="button" className="lightbox-close" aria-label="Close photo">×</button>
    </div>
  )
}

function PostCard({ post, onChanged, onEdited, badges, names, isAdmin, focus }) {
  const { user } = useAuth()
  const toast = useToast()
  const author = post.profiles
  const members = useMembers()
  const [open, setOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(null)
  const baseCount = post.demo ? demoComments(post.id).length : (post.comments?.[0]?.count ?? 0)
  const shownCount = commentCount ?? baseCount
  const [reactions, setReactions] = useState(post.reactions ?? [])   // changed on the spot, no reload
  useEffect(() => { setReactions(post.reactions ?? []) }, [post.reactions])
  const [who, setWho] = useState(null)         // which reaction's names are showing
  const [big, setBig] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(post.body ?? '')
  const [kind, setKind] = useState(post.kind ?? null)
  const [err, setErr] = useState('')
  const press = useRef({ timer: null, long: false })
  const mine = post.user_id === user.id
  const canEdit = mine && !post.demo && Date.now() - new Date(post.created_at).getTime() < EDIT_MINUTES * 60000
  const left = daysLeft(post.created_at)

  async function toggle(k) {
    const had = reactions.some(r => r.user_id === user.id && r.kind === k)
    const icon = REACTIONS.find(r => r.kind === k)?.icon ?? ''
    if (!had) toast(`${icon} Reaction sent`, 'info', { silent: true })
    const before = reactions
    setReactions(had
      ? reactions.filter(r => !(r.user_id === user.id && r.kind === k))
      : [...reactions, { kind: k, user_id: user.id }])
    if (post.demo) return // DEMO: demo posts react locally only
    const q = supabase.from('reactions')
    const { error } = had
      ? await q.delete().match({ post_id: post.id, user_id: user.id, kind: k })
      : await q.insert({ post_id: post.id, user_id: user.id, kind: k })
    if (error) setReactions(before)
  }

  // hold a reaction to see who gave it (hovering shows the same list as a tooltip)
  const downOn = k => {
    press.current.long = false
    clearTimeout(press.current.timer)
    press.current.timer = setTimeout(() => { press.current.long = true; setWho(k) }, 500)
  }
  const upOn = () => clearTimeout(press.current.timer)
  const nameList = k => reactions.filter(r => r.kind === k).map(r => (r.user_id === user.id ? 'You' : names.get(r.user_id) ?? 'Someone'))

  // two taps instead of a browser pop-up (those can be blocked), and any problem is shown instead of swallowed
  const [asking, setAsking] = useState(false)
  async function remove() {
    setAsking(false)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) return toast('Could not delete: ' + error.message, 'info')
    try { await removeImage(post.image_path) } catch { /* the nightly cleanup removes a leftover file */ }
    toast('Post deleted')
    onChanged()
  }

  async function saveEdit(e) {
    e.preventDefault()
    setErr('')
    if (!post.image_path && !text.trim()) return setErr('A post without a photo needs some words.')
    const { error } = await supabase.from('posts').update({ body: text.trim(), kind }).eq('id', post.id)
    if (error) return setErr(error.message)
    onEdited(post.id, { body: text.trim(), kind, edited_at: new Date().toISOString() })
    setEditing(false)
    toast('✓ Post updated', 'info', { silent: true })
  }

  async function togglePin() {
    const { error } = await supabase.rpc('admin_pin_post', { pid: post.id, pin: !post.pinned })
    if (error) return toast(error.message, 'info')
    toast(post.pinned ? 'Unpinned' : '📌 Pinned to the top', 'info', { silent: true })
    onChanged()
  }

  const full = post.image_url ?? publicUrl(post.image_path)
  const small = post.image_url ? null : thumbUrl(post.image_path)
  const tag = kindOf(post.kind)

  return (
    <article className={'card post' + (post.pinned ? ' pinned' : '') + (focus ? ' focus-post' : '')}>
      {post.pinned && <span className="pin-flag">📌 Pinned</span>}
      <header className="row">
        <Avatar name={author?.display_name} path={author?.avatar_path} color={author?.color}
          frame={author?.frame} size={40} />
        <Link to={`/profile/${post.user_id}`}>{author?.display_name ?? 'Someone'}</Link>
        <MiniBadges userId={post.user_id} list={badges?.get(post.user_id)} />
        <span className="muted small" title={new Date(post.created_at).toLocaleString()}>{timeAgo(post.created_at)}</span>
        <span className="spacer" />
        {isAdmin && !post.demo && <button className="link" onClick={togglePin}>{post.pinned ? 'unpin' : 'pin'}</button>}
        {canEdit && !editing && !post.share_kind && <button className="link" onClick={() => setEditing(true)}>edit</button>}
        {mine && !asking && <button className="link" onClick={() => setAsking(true)}>delete</button>}
        {mine && asking && (
          <span className="row delete-ask">
            <small>Delete this post?</small>
            <button className="link danger" onClick={remove}>Yes, delete</button>
            <button className="link" onClick={() => setAsking(false)}>Cancel</button>
          </span>
        )}
        {!mine && !post.demo && <ReportButton postId={post.id} className="link report-link" />}
      </header>
      {post.share_kind && <ShareCard post={post} />}
      {tag && !post.share_kind && <span className="kind-tag"><span aria-hidden="true">{tag.icon}</span> {tag.label}</span>}
      {(post.image_url || post.image_path) && (
        <button type="button" className="photo-btn" onClick={() => setBig(true)} aria-label="Enlarge photo">
          <img className="photo" src={small ?? full} alt={post.body} loading="lazy"
            onError={e => { if (small && e.currentTarget.src !== full) e.currentTarget.src = full }} />
        </button>
      )}
      {big && <Lightbox src={full} alt={post.body} onClose={() => setBig(false)} />}
      {editing ? (
        <form className="stack" onSubmit={saveEdit}>
          <textarea value={text} maxLength={MAX_CAPTION} rows={3} aria-label="Edit post text" onChange={e => setText(e.target.value)} />
          <div className="kind-chips" role="group" aria-label="Tag">
            {POST_KINDS.map(k => (
              <button key={k.id} type="button" className={'kind-chip' + (kind === k.id ? ' on' : '')}
                aria-pressed={kind === k.id} onClick={() => setKind(kind === k.id ? null : k.id)}>
                <span aria-hidden="true">{k.icon}</span> {k.label}
              </button>
            ))}
          </div>
          {err && <p className="warn small">{err}</p>}
          <div className="row">
            <button>Save</button>
            <button type="button" className="secondary" onClick={() => { setEditing(false); setText(post.body ?? ''); setKind(post.kind ?? null); setErr('') }}>Cancel</button>
          </div>
        </form>
      ) : (
        post.body && !post.share_kind && <p><RichText text={post.body} mentions={post.mentions} members={members} />{post.edited_at && <small className="muted"> (edited)</small>}</p>
      )}
      <footer className="row reactions" aria-label="Reactions">
        {REACTIONS.map(({ kind: k, icon, word }) => {
          const list = reactions.filter(r => r.kind === k)
          const on = reactions.some(r => r.user_id === user.id && r.kind === k)
          return (
            <button key={k} className={'react' + (on ? ' on' : '')}
              title={list.length ? `${word}: ${nameList(k).join(', ')}` : word}
              onPointerDown={() => downOn(k)} onPointerUp={upOn} onPointerLeave={upOn} onPointerCancel={upOn}
              onContextMenu={e => { if (press.current.long) e.preventDefault() }}
              onClick={() => { if (press.current.long) { press.current.long = false; return } setWho(null); toggle(k) }}>
              {icon} {list.length > 0 && list.length}
            </button>
          )
        })}
      </footer>
      {who && (
        <p className="who small" role="status">
          {REACTIONS.find(r => r.kind === who)?.icon}{' '}
          {nameList(who).length ? nameList(who).join(', ') : 'No one yet'}
          <button type="button" className="link" onClick={() => setWho(null)}> close</button>
        </p>
      )}
      <button type="button" className={'comment-toggle' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span aria-hidden="true">💬</span>
        {shownCount === 0 ? 'Add a comment' : `${shownCount} comment${shownCount === 1 ? '' : 's'}`}
        <span className="chev" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <Comments post={post} onCount={setCommentCount} />}
      {!post.demo && !post.pinned && (
        <small className="muted post-expiry">
          {left <= 0 ? 'Disappears tonight' : `Disappears in ${left} day${left === 1 ? '' : 's'}`}
        </small>
      )}
    </article>
  )
}

// a card made by the Share button: a badge you earned, or your study time
function ShareCard({ post }) {
  const d = post.share_data ?? {}
  if (post.share_kind === 'achievement') {
    return (
      <div className={'share-card ach tier-' + (d.tier ?? 'bronze')}>
        <span className="share-medal" aria-hidden="true">{badgeIcon(d.icon) || '🏆'}</span>
        <div>
          <small className="muted">Badge unlocked</small>
          <h3>{d.name}</h3>
          {d.description && <p className="muted small">{d.description}</p>}
        </div>
      </div>
    )
  }
  const mins = Number(d.minutes) || 0
  return (
    <div className="share-card study">
      <span className="share-medal" aria-hidden="true">⏱️</span>
      <div>
        <small className="muted">{post.share_kind === 'study_week' ? 'Studied this week' : 'Studied today'}</small>
        <h3>{Math.floor(mins / 60)}h {String(mins % 60).padStart(2, '0')}m</h3>
        {d.sessions > 0 && <p className="muted small">{d.sessions} session{d.sessions === 1 ? '' : 's'}</p>}
      </div>
    </div>
  )
}

function Skeletons() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <div key={i} className="card post post-skel" aria-hidden="true">
          <div className="skel-row"><span className="skel skel-avatar" /><span className="skel skel-line" /></div>
          <span className="skel skel-photo" />
          <span className="skel skel-line wide" />
        </div>
      ))}
    </>
  )
}

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'question', label: 'Questions' },
  { id: 'win', label: 'Wins' },
]

export default function Feed() {
  const { user } = useAuth()
  const [posts, setPosts] = useState(null)       // null while the first batch loads
  const [error, setError] = useState('')
  const [tab, setTab] = useState('all')
  const [photoOnly, setPhotoOnly] = useState(false)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [names, setNames] = useState(() => new Map())   // user id -> name, for "who reacted"
  const asked = useRef(new Set())
  const [params, setParams] = useSearchParams()
  const phone = usePhone()
  const [peopleOpen, setPeopleOpen] = useState(false)   // phones: two dropdowns, people closed, posts open
  const [postsOpen, setPostsOpen] = useState(true)
  const focusId = params.get('post')
  const [focusPost, setFocusPost] = useState(null)      // the post a mail notification pointed at
  const [focusGone, setFocusGone] = useState(false)

  // opened from the mail: fetch that one post and show it first, highlighted
  useEffect(() => {
    setFocusPost(null); setFocusGone(false)
    if (!focusId) return
    let alive = true
    ;(async () => {
      let row = null
      if (DEMO && focusId.startsWith('demo-')) row = demoPosts().find(p => p.id === focusId) ?? null // DEMO
      if (!row) {
        const { data } = await supabase.from('posts').select(POST_COLS).eq('id', focusId).maybeSingle()
        row = data ?? null
      }
      if (!alive) return
      if (row) { setFocusPost(row); learnNames([row]) } else setFocusGone(true)
    })()
    return () => { alive = false }
  }, [focusId]) // eslint-disable-line
  useEffect(() => {
    if (focusPost) setTimeout(() => document.querySelector('.post.focus-post')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150)
  }, [focusPost])

  // only names not already known are fetched, then added to what we have
  async function learnNames(rows) {
    const need = [...new Set(rows.flatMap(p => (p.reactions ?? []).map(r => r.user_id)))].filter(id => !asked.current.has(id))
    if (!need.length) return
    need.forEach(id => asked.current.add(id))
    const { data } = await supabase.from('profiles').select('id, display_name').in('id', need)
    if (data?.length) setNames(m => { const n = new Map(m); data.forEach(p => n.set(p.id, p.display_name)); return n })
  }

  const load = useCallback(async (append = false, from = 0) => {
    setBusy(true)
    let q = supabase.from('posts').select(POST_COLS).order('pinned', { ascending: false }).order('created_at', { ascending: false }).range(from, from + PAGE - 1)
    if (tab === 'mine') q = q.eq('user_id', user.id)
    if (tab === 'question' || tab === 'win') q = q.eq('kind', tab)
    if (photoOnly) q = q.not('image_path', 'is', null)
    const { data, error } = await q
    setBusy(false)
    if (error) { setError(error.message); setPosts(p => p ?? []); return }
    setError('')
    let rows = [...(data ?? [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    setMore(rows.length === PAGE)
    if (DEMO && !append && tab === 'all' && !photoOnly) { // DEMO
      rows = [...rows, ...demoPosts()].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.created_at) - new Date(a.created_at))
    }
    setPosts(prev => (append && prev ? [...prev, ...rows.filter(r => !prev.some(p => p.id === r.id))] : rows))
    learnNames(rows)
  }, [tab, photoOnly, user.id]) // eslint-disable-line

  useEffect(() => { setPosts(null); load() }, [load])

  const reload = () => load()

  // The feed keeps itself fresh: every 20 seconds (and when you come back to the tab) it quietly fetches the newest
  // posts. Posts that arrive while you are scrolled down wait behind a "New posts" button instead of shoving the page.
  const [fresh, setFresh] = useState(null)
  const postsRef = useRef(null)
  postsRef.current = posts
  const mergeFirstPage = (prev, rows) => {
    const oldest = rows.reduce((m, r) => (m === null || r.created_at < m ? r.created_at : m), null)
    const ids = new Set(rows.map(r => r.id))
    const kept = (prev ?? []).filter(p => !ids.has(p.id) && (oldest === null || p.created_at < oldest))
    return [...rows, ...kept]
  }
  const quiet = useCallback(async () => {
    if (document.visibilityState !== 'visible' || !postsRef.current) return
    let q = supabase.from('posts').select(POST_COLS).order('pinned', { ascending: false }).order('created_at', { ascending: false }).range(0, PAGE - 1)
    if (tab === 'mine') q = q.eq('user_id', user.id)
    if (tab === 'question' || tab === 'win') q = q.eq('kind', tab)
    if (photoOnly) q = q.not('image_path', 'is', null)
    const { data, error } = await q
    if (error || !data) return
    const rows = [...data].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    const known = new Set((postsRef.current ?? []).map(p => p.id))
    const added = rows.filter(r => !known.has(r.id))
    if (added.length && window.scrollY > 240) { setFresh(rows); return }   // wait behind the button
    setFresh(null)
    setPosts(p => mergeFirstPage(p, rows))
    learnNames(rows)
  }, [tab, photoOnly, user.id]) // eslint-disable-line
  useEffect(() => {
    const id = setInterval(quiet, 20000)
    document.addEventListener('visibilitychange', quiet)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', quiet) }
  }, [quiet])
  const showFresh = () => {
    setPosts(p => mergeFirstPage(p, fresh ?? []))
    learnNames(fresh ?? [])
    setFresh(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const edited = (id, patch) => setPosts(list => list.map(p => (p.id === id ? { ...p, ...patch } : p)))
  const badges = useTopBadges((posts ?? []).map(p => p.user_id))
  const isAdmin = useIsAdmin()

  return (
    <div className="feed-page">
      <h1>Progress feed</h1>
      <div className="feed-grid">
        <section className={'feed-section feed-people card' + (phone && !peopleOpen ? ' closed' : '')}>
          {phone
            ? (
              <button type="button" className="feed-section-head secondary" aria-expanded={peopleOpen}
                onClick={() => setPeopleOpen(o => !o)}>
                <span>Find people</span><span className="caret" aria-hidden="true">{peopleOpen ? '▴' : '▾'}</span>
              </button>
            )
            : <h2 className="feed-section-title">Find people</h2>}
          {(!phone || peopleOpen) && <PeopleSearch />}
        </section>
        <section className={'feed-section feed-main' + (phone && !postsOpen ? ' closed' : '')}>
          {phone
            ? (
              <button type="button" className="feed-section-head secondary" aria-expanded={postsOpen}
                onClick={() => setPostsOpen(o => !o)}>
                <span>Posts</span><span className="caret" aria-hidden="true">{postsOpen ? '▴' : '▾'}</span>
              </button>
            )
            : <h2 className="feed-section-title">Posts</h2>}
          {(!phone || postsOpen) && (
            <div className="feed-body">
          <Composer onPosted={() => { if (tab !== 'all' || photoOnly) { setTab('all'); setPhotoOnly(false) } else reload() }} />
          <div className="feed-filters">
            <div className="tabs" role="tablist" aria-label="Show">
              {TABS.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                  className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>
            <label className="feed-photo-toggle">
              <input type="checkbox" checked={photoOnly} onChange={e => setPhotoOnly(e.target.checked)} /> Has photo
            </label>
          </div>
          {fresh && (
            <button type="button" className="new-posts-pill" onClick={showFresh}>↑ New posts</button>
          )}
          {error && <p className="warn">{error}</p>}
          {posts === null && !error && <Skeletons />}
          {posts?.length === 0 && !error && (
            <div className="card empty-feed">
              <p><strong>{tab === 'all' && !photoOnly ? 'Nothing here yet' : 'No posts match'}</strong></p>
              <p className="muted small">
                {tab === 'all' && !photoOnly
                  ? 'Be the first: share what you finished, a question, or a photo of your notes.'
                  : 'Try another tab, or turn off the photo filter.'}
              </p>
            </div>
          )}
          {focusId && (
            <div className="focus-note">
              <span>{focusGone ? 'That post is gone (posts disappear after 14 days).' : 'The post from your mail'}</span>
              <button type="button" className="secondary" onClick={() => setParams({}, { replace: true })}>Show the whole feed</button>
            </div>
          )}
          {focusPost && <PostCard key={'f' + focusPost.id} post={focusPost} focus onChanged={() => { setParams({}, { replace: true }); reload() }}
            onEdited={(id, patch) => setFocusPost(p => (p ? { ...p, ...patch } : p))} badges={badges} names={names} isAdmin={isAdmin} />}
          {posts?.filter(p => p.id !== focusId).map(p => <PostCard key={p.id} post={p} onChanged={reload} onEdited={edited} badges={badges} names={names} isAdmin={isAdmin} />)}
          {more && (
            <div className="feed-more">
              <button type="button" className="secondary" disabled={busy} onClick={() => load(true, posts.filter(p => !p.demo).length)}>
                {busy ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
