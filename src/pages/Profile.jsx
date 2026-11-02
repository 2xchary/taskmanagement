import { useEffect, useRef, useState } from 'react'
import Coin from '../components/Coin.jsx'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { DAY_NAMES, fmtMinutes, startOfWeek } from '../lib/dates.js'
import { levelFromXp, useCosmetics, useXp } from '../lib/levels.js'
import { publicUrl, removeImage, thumbUrl, uploadImage } from '../lib/storage.js'
import { downloadMyPosts } from '../lib/exportPosts.js'
import { DEMO, demoProfile, isDemoId } from '../lib/demo.js' // DEMO
import { colorHex } from '../lib/colors.js'
import Avatar, { FramePreview } from '../components/Avatar.jsx'
import FancyName from '../components/FancyName.jsx'
import PickerModal from '../components/PickerModal.jsx'
import ThemePreview from '../components/ThemePreview.jsx'
import BadgeStrip from '../components/BadgeStrip.jsx'
import { usernameProblem } from '../lib/username.js'
import { COLLEGES } from '../lib/colleges.js'
import ColorPicker from '../components/ColorPicker.jsx'
import LevelCard from '../components/LevelCard.jsx'
import DayBars from '../components/DayBars.jsx'
import { THEMES, useTheme } from '../lib/theme.jsx'
import { useShop } from '../lib/shop.jsx'
import { useToast } from '../lib/toast.jsx'
import { IS_ADMIN } from '../lib/env.js'

// One row per customization: shows what you have now; click to open the choices.
function CustomizeRow({ label, name, preview, onClick }) {
  return (
    <button type="button" className="customize-row" onClick={onClick}>
      <span className="customize-preview">{preview}</span>
      <span className="customize-text">
        <small>{label}</small>
        <strong>{name}</strong>
      </span>
      <span className="customize-go">Change ›</span>
    </button>
  )
}

function StylePicker({ title, items, value, level, shopIds, exclusiveIds, owned, onChange }) {
  // Shop styles show up here only once you own them, and aren't gated by level.
  const visible = items.filter(c => !shopIds.has(c.id) || owned.has(c.id))
  return (
    <div>
      {title && <div className="muted small">{title}</div>}
      <div className="styles">
        {visible.map(c => {
          const locked = !shopIds.has(c.id) && c.min_level > level
          return (
            <button
              key={c.id}
              type="button"
              disabled={locked}
              className={'style-opt' + (value === c.id ? ' on' : '')}
              onClick={() => onChange(c.id)}
              title={locked ? `Unlocks at level ${c.min_level}` : c.name}
            >
              {c.kind === 'frame' ? <FramePreview id={c.id} size={44} /> : <span className={'swatch-preview ' + c.id} />}
              <span>{c.name}</span>
              <small>{exclusiveIds?.has(c.id) ? '✦ Earned' : shopIds.has(c.id) ? 'From the Shop' : locked ? `🔒 Lv ${c.min_level}` : `Lv ${c.min_level}`}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const { id } = useParams()
  const userId = id ?? user.id
  const mine = userId === user.id
  const { theme, setTheme } = useTheme()
  const shop = useShop()
  const toast = useToast()
  const baseline = useRef(null)    // picture / frame / banner as last saved, to tell what changed
  const pendingBanner = useRef(null)   // same for a banner picture
  const pendingAvatar = useRef(null)   // a picture uploaded but not saved yet (deleted if you pick another or leave)

  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [days, setDays] = useState(Array(7).fill(0)) // study minutes Mon..Sun this week
  const [msg, setMsg] = useState('')
  const demo = DEMO && isDemoId(userId) ? demoProfile(userId) : null // DEMO: filler friend's profile
  const realXp = useXp(demo ? user.id : userId) // DEMO: was `const xp = useXp(userId)`
  const xp = demo ? demo.xp : realXp // DEMO
  const cosmetics = useCosmetics()
  const level = levelFromXp(xp ?? 0)
  const shopIds = new Set(shop.items.map(i => i.id))
  const exclusiveIds = new Set(shop.items.filter(i => i.exclusive).map(i => i.id))
  const [lockedAtLoad, setLockedAtLoad] = useState(false)     // had a username when the page loaded
  const lockedUsername = lockedAtLoad && mine
  const [tab, setTab] = useState('details')   // edit form tab: details | style
  const [picker, setPicker] = useState(null) // which customization pop-up is open: 'theme' | 'frame' | 'banner'
  const currentTheme = THEMES.find(t => t.id === theme) ?? THEMES[0]

  useEffect(() => {
    if (demo) { // DEMO
      setProfile(demo.profile); setPosts(demo.posts); setDays(demo.days)
      return
    }
    setProfile(null)
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        setProfile(data ?? false); setLockedAtLoad(!!data?.username)
        baseline.current = data ? { avatar_path: data.avatar_path, frame: data.frame, banner: data.banner, banner_path: data.banner_path ?? null } : null
      })
    supabase.from('posts').select('id, image_path, body, created_at').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setPosts(data ?? []))
    supabase.from('study_sessions').select('minutes, created_at').eq('user_id', userId)
      .gte('created_at', startOfWeek().toISOString())
      .then(({ data }) => {
        const week = Array(7).fill(0)
        for (const s of data ?? []) week[(new Date(s.created_at).getDay() + 6) % 7] += s.minutes
        setDays(week)
      })
  }, [userId])

  if (profile === null) return <p>Loading…</p>
  if (profile === false) return <p>Profile not found.</p>

  const edit = patch => setProfile(p => ({ ...p, ...patch }))
  const total = days.reduce((a, b) => a + b, 0)
  const best = Math.max(...days)
  const todayIdx = (new Date().getDay() + 6) % 7

  async function save(e) {
    e.preventDefault()
    const { display_name, bio, color, avatar_path, frame, banner } = profile
    const banner_path = profile.banner_path ?? null
    const username = (profile.username ?? '').trim()
    if (username) {
      const problem = usernameProblem(username)
      if (problem) return setMsg(problem)
    }
    const { error } = await supabase.from('profiles')
      .update({ display_name: display_name.trim() || 'Friend', ...(lockedUsername ? {} : { username: username || null }), college: (profile.college ?? '').trim() || null, bio, color, avatar_path, frame, banner, ...(banner_path !== (baseline.current?.banner_path ?? null) ? { banner_path } : {}) })   // banner_path is only sent when changed, so saving works before the database has it
      .eq('id', user.id)
    setMsg(error
      ? (IS_ADMIN && /reach level/i.test(error.message)
        ? 'Admin preview only: that style is above your real level, so it was not saved.'
        : /gif/i.test(error.message) ? 'Admin preview only: the GIF picture perk is not bought on this account, so it was not saved.'
        : error.code === '23505' ? 'That username is already taken. Add a number or a middle initial.' : error.message)
      : 'Saved!')
    if (!error && username) setLockedAtLoad(true)
    if (!error) window.dispatchEvent(new Event('lock-in:profile-saved'))   // the top bar card and the Me button re-read your picture and banner
    if (!error && baseline.current) {
      const was = baseline.current
      const nameOf = id => cosmetics.find(c => c.id === id)?.name
      const changes = []
      if (avatar_path !== was.avatar_path) changes.push('profile picture')
      if (frame !== was.frame) changes.push(nameOf(frame) ? `frame (${nameOf(frame)})` : 'frame')
      if (banner !== was.banner) changes.push(nameOf(banner) ? `banner (${nameOf(banner)})` : 'banner')
      if (changes.length) {
        const list = changes.length > 1 ? changes.slice(0, -1).join(', ') + ' and ' + changes.at(-1) : changes[0]
        toast(`✓ Your ${list} ${changes.length > 1 ? 'were' : 'was'} updated`, 'xp')
      }
      // the picture you replaced is no longer used by anything: remove the file (only ever your own folder)
      if (was.avatar_path && was.avatar_path !== avatar_path && was.avatar_path.startsWith(user.id + '/')) removeImage(was.avatar_path).catch(() => {})
      pendingAvatar.current = null
      if (was.banner_path && was.banner_path !== banner_path && was.banner_path.startsWith(user.id + '/')) removeImage(was.banner_path).catch(() => {})
      pendingBanner.current = null
      baseline.current = { avatar_path, frame, banner, banner_path }
    }
  }

  const canGif = IS_ADMIN || shop.owned.has('perk-gif')
  const canBannerPic = IS_ADMIN || shop.owned.has('perk-gif-banner')

  async function onBanner(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const path = await uploadImage(file, user.id, { allowGif: canBannerPic, kind: 'banner' })
      if (pendingBanner.current && pendingBanner.current !== baseline.current?.banner_path) removeImage(pendingBanner.current).catch(() => {})
      pendingBanner.current = path
      edit({ banner_path: path })
      toast(`🖼️ Banner picture chosen: ${file.name}. Press Save profile to keep it.`, 'info', { silent: true })
    } catch (err) { setMsg(err.message) }
  }
  const removeBanner = () => { edit({ banner_path: null }); toast('Banner picture removed. Press Save profile to keep that.', 'info', { silent: true }) }

  async function onAvatar(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const gif = file.type === 'image/gif'
      const path = await uploadImage(file, user.id, { allowGif: canGif, kind: 'avatar' })
      if (pendingAvatar.current && pendingAvatar.current !== baseline.current?.avatar_path) removeImage(pendingAvatar.current).catch(() => {})
      pendingAvatar.current = path
      edit({ avatar_path: path })
      toast(`📷 Picture chosen: ${file.name}. Press Save profile to keep it.`, 'info', { silent: true })
      if (gif && !canGif) setMsg('Animated GIFs are a Shop perk, so this one was saved as a still picture.')
    }
    catch (err) { setMsg(err.message) }
  }

  return (
    <div className={'dash overview profile-fit' + (mine ? '' : ' solo')}>
      <div className="col">
        {/* Who this is */}
        <section className="card profile-head">
          <div className={'banner ' + profile.banner + (profile.banner_path ? ' banner-pic' : '')} style={{ '--mc': colorHex(profile.color), ...(profile.banner_path ? { '--pic': `url("${publicUrl(profile.banner_path)}")` } : {}) }} />
          <div className="profile-id">
            <Avatar name={profile.display_name} path={profile.avatar_path} color={profile.color}
              frame={profile.frame} size={88} />
            <div>
              <h1><FancyName name={profile.display_name} /></h1>
              {profile.username && <p className="profile-username">@{profile.username}</p>}
              {profile.college && <p className="profile-username">🎓 {profile.college}</p>}
              <p className="muted">{mine ? 'This is how friends see you' : 'Friend profile'}</p>
            </div>
            {mine && (
              <Link to="/shop" className="shop-link">
                <button type="button">Shop <small><Coin /> {shop.balance.toLocaleString()}</small></button>
              </Link>
            )}
          </div>
          <LevelCard xp={xp} />
          <BadgeStrip userId={userId} mine={mine} />
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          {!profile.bio && !mine && <p className="muted">No bio yet.</p>}
        </section>

        {/* The numbers, each labelled (under who this is) */}
        <div className="tiles">
          <div className="tile"><strong>{fmtMinutes(total)}</strong><span>studied this week</span></div>
          <div className="tile">
            <strong>{best ? fmtMinutes(best) : '–'}</strong>
            <span>best day{best ? ` (${DAY_NAMES[days.indexOf(best)]})` : ''}</span>
          </div>
          <div className="tile"><strong>{posts.length}</strong><span>posts shared</span></div>
          <div className="tile"><strong>Lv {level}</strong><span>{(xp ?? 0).toLocaleString()} XP total</span></div>
        </div>
      </div>

      <div className="col">
        {/* Their posts: a short strip you scroll sideways, so the page never has to scroll */}
        <section className="card posts-strip">
          <h2>Posts <small>{posts.length} shared</small>
            {mine && posts.length > 0 && (
              <button type="button" className="link" style={{ marginLeft: 'auto' }}
                title="Posts disappear after 14 days. This saves them, with their photos, as one file you keep."
                onClick={async () => { try { const n = await downloadMyPosts(user.id); toast(`✓ Saved ${n} post${n === 1 ? '' : 's'}`) } catch (err) { toast(err.message || 'Could not save your posts', 'info') } }}>
                Download my posts
              </button>
            )}
          </h2>
          {posts.length === 0 && <p className="muted">No posts yet.</p>}
          <div className="post-list strip">
            {posts.map(p => (
              <article key={p.id} className="post-tile">
                {(p.image_url || p.image_path) && (
                  <img src={p.image_url ?? thumbUrl(p.image_path) ?? publicUrl(p.image_path)} alt={p.body} loading="lazy"
                    onError={e => { const full = p.image_url ?? publicUrl(p.image_path); if (e.currentTarget.src !== full) e.currentTarget.src = full }} />
                )}
                {p.body && <p>{p.body}</p>}
                {p.created_at && <small className="muted">{new Date(p.created_at).toLocaleDateString()}</small>}
              </article>
            ))}
          </div>
        </section>

        {/* Hours each day */}
        <section className="card week-bars-card">
          <h2>Study time each day <small>this week, Monday to Sunday</small></h2>
          <DayBars minutes={days} start={startOfWeek()} highlight={todayIdx} />
        </section>
      </div>

      {mine && (
        <form className="card stack profile-edit" onSubmit={save}>
          <h2>Edit your profile</h2>
          <div className="tabs" role="tablist">
            {[['details', 'You'], ['style', 'Style']].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id}
                className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          {tab === 'details' && (<>
          <div className="details-grid">
          <label>Display name
            <input value={profile.display_name} maxLength={40} onChange={e => edit({ display_name: e.target.value })} />
          </label>
          <label>Username <span className="muted small">(your first and last name)</span>
            <input value={profile.username ?? ''} maxLength={40} placeholder="e.g. Jane Doe or jane.doe"
              readOnly={lockedUsername} disabled={lockedUsername}
              onChange={e => edit({ username: e.target.value })} />
            {lockedUsername
              ? <small className="muted">🔒 Locked. Ask the group admin to change it.</small>
              : <small className="muted">Set once. Only the group admin can change it after.</small>}
          </label>
          <label>College
            <input list="college-list" value={profile.college ?? ''} maxLength={80} placeholder="Where do you go?"
              onChange={e => edit({ college: e.target.value })} />
            <datalist id="college-list">{COLLEGES.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label>Profile picture
            <input type="file" accept="image/*" onChange={onAvatar} />
            <small className="muted">{canGif ? 'Animated GIFs work for you (up to 3 MB).' : <>Want it to move? <Link to="/shop">Animated pictures are in the Shop</Link>.</>}</small>
          </label>
          </div>
          <label>Bio
            <textarea value={profile.bio} maxLength={200} rows={3} onChange={e => edit({ bio: e.target.value })} />
          </label>
          <label>Your color
            <ColorPicker value={profile.color} onChange={color => edit({ color })} />
          </label>
          </>)}
          {tab === 'style' && (
          <div className="stack customize">
            <div className="muted small">
              Customize <span>(tap one to see all the choices)</span>
              {' · '}<Link to="/shop">Get more in the Shop</Link>
            </div>
            <CustomizeRow label="Page theme" name={currentTheme.name} onClick={() => setPicker('theme')}
              preview={<span className="theme-swatch mini" aria-hidden="true">{currentTheme.preview.map((c, i) => <i key={i} style={{ background: c }} />)}</span>} />
            <CustomizeRow label="Picture frame" name={cosmetics.find(c => c.id === profile.frame)?.name ?? 'No frame'}
              onClick={() => setPicker('frame')}
              preview={<FramePreview id={profile.frame} size={42} />} />
            <CustomizeRow label="Banner" name={cosmetics.find(c => c.id === profile.banner)?.name ?? 'Checker'}
              onClick={() => setPicker('banner')}
              preview={<span className={'swatch-preview ' + profile.banner} style={{ '--mc': colorHex(profile.color) }} aria-hidden="true" />} />
            <div className="banner-pic-row">
              <strong>Banner picture</strong>
              {canBannerPic ? (
                <>
                  <input type="file" accept="image/*" onChange={onBanner} aria-label="Choose a banner picture or GIF" />
                  <small className="muted">A wide picture or an animated GIF (up to 3 MB). It sits over the banner above.</small>
                  {profile.banner_path && <button type="button" className="secondary" onClick={removeBanner}>Remove banner picture</button>}
                </>
              ) : (
                <small className="muted">Put a picture or an animated GIF across your profile. <Link to="/shop">Get the animated banner in the Shop</Link>.</small>
              )}
            </div>
          </div>
          )}
          {picker === 'theme' && (
            <PickerModal title="Page theme" hint="Changes how the whole site looks for you." onClose={() => setPicker(null)}>
              <div className="themes">
                {THEMES.filter(t => t.id === 'default' || t.free || shop.owned.has(t.id)).map(t => (
                  <button key={t.id} type="button" data-t={t.id} className={'theme-opt' + (theme === t.id ? ' on' : '')}
                    onClick={() => { setTheme(t.id); setPicker(null) }} aria-pressed={theme === t.id}>
                    <ThemePreview id={t.id} colors={t.preview} />
                    <strong>{t.name}</strong>
                    <small>{t.blurb}</small>
                  </button>
                ))}
              </div>
            </PickerModal>
          )}
          {picker === 'frame' && (
            <PickerModal title="Picture frame" hint="Press Save profile afterwards to keep it." onClose={() => setPicker(null)}>
              <StylePicker level={IS_ADMIN ? 999 : level} shopIds={shopIds} exclusiveIds={exclusiveIds} owned={shop.owned} value={profile.frame}
                items={cosmetics.filter(c => c.kind === 'frame')} onChange={frame => { edit({ frame }); setPicker(null) }} />
            </PickerModal>
          )}
          {picker === 'banner' && (
            <PickerModal title="Banner" hint="Press Save profile afterwards to keep it." onClose={() => setPicker(null)}>
              <StylePicker level={IS_ADMIN ? 999 : level} shopIds={shopIds} exclusiveIds={exclusiveIds} owned={shop.owned} value={profile.banner}
                items={cosmetics.filter(c => c.kind === 'banner')} onChange={banner => { edit({ banner }); setPicker(null) }} />
            </PickerModal>
          )}
          <button type="submit">Save profile</button>
          {msg && <p className="muted">{msg}</p>}
          <small className="muted">
            Earn XP: 1 per focus minute, 10 per finished task, 25 per post, 2 per reaction you receive. Sounds, motion and notifications are in Settings (top left).
          </small>
        </form>
      )}
    </div>
  )
}
