import { useEffect, useState } from 'react'
import Coin from './components/Coin.jsx'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import { usePomodoro, mmss } from './lib/pomodoro.jsx'
import { useMyXp } from './lib/xp.jsx'
import { useShop } from './lib/shop.jsx'
import { supabase, isConfigured } from './lib/supabase.js'
import Overview from './pages/Overview.jsx'
import Feed from './pages/Feed.jsx'
import Todo from './pages/Todo.jsx'
import Pomodoro from './pages/Pomodoro.jsx'
import Profile from './pages/Profile.jsx'
import Shop from './pages/Shop.jsx'
import Achievements from './pages/Achievements.jsx'
import Terms from './pages/Terms.jsx'
import Legal from './pages/Legal.jsx'
import Admin from './pages/Admin.jsx'
import TermsGate from './components/TermsGate.jsx'
import MailButton from './components/MailButton.jsx'
import Login, { AuthSplash, StartupIntro } from './pages/Login.jsx'
import DueReminders from './components/DueReminders.jsx'
import PrizeNews from './components/PrizeNews.jsx'
import { PostBoostWatcher } from './components/PostBoost.jsx'
import { colorHex } from './lib/colors.js'
import Logo from './components/Logo.jsx'
import SettingsMenu from './components/SettingsMenu.jsx'
import PageHelp from './components/PageHelp.jsx'
import { xpForLevel } from './lib/levels.js'
import InstallButton from './components/InstallButton.jsx'
import Icon from './components/Icon.jsx'
import Avatar from './components/Avatar.jsx'
import Scene from './components/Scene.jsx'
import Tour from './components/Tour.jsx'
import LookPicker from './components/LookPicker.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import { useSound } from './lib/sfx.jsx'
import DevPanel from './components/DevPanel.jsx'
import TimerOverlay from './components/TimerOverlay.jsx'
import UpdateNotice from './components/UpdateNotice.jsx'
import PipTimer from './components/PipTimer.jsx'
import StillStudying from './components/StillStudying.jsx'
import StudyFlagAlert from './components/StudyFlags.jsx'
import { publicUrl } from './lib/storage.js'
import { APP_TITLE, IS_ADMIN, IS_DEV_BUILD, IS_FAKE } from './lib/env.js'
import { DEMO } from './lib/demo.js' // DEMO

// The six main pages. On a PC they live in the side dock; on a phone, in the bottom bar.
// "Me" shows your own profile photo instead of an icon.
const TABS = [
  { to: '/', label: 'Overview', short: 'Home', icon: 'overview', end: true },
  { to: '/todo', label: 'To Do', short: 'To Do', icon: 'todo' },
  { to: '/feed', label: 'Feed', short: 'Feed', icon: 'feed' },
  { to: '/study', label: 'Study', short: 'Study', icon: 'timer' },
  { to: '/profile', label: 'My Profile', short: 'Me', profile: true, end: true },
]

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthSplash />
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { user } = useAuth()
  const timer = usePomodoro()
  const { xp, level } = useMyXp()
  const { balance } = useShop()
  const sound = useSound()
  const { pathname } = useLocation()
  const [me, setMe] = useState(null)
  const [pressed, setPressed] = useState(null) // tab being pressed right now (moves the liquid blob at once)

  // Overview fits the window with no page scrolling; To Do gets extra width for its day columns.
  const pageClass = 'page' + (pathname === '/' || pathname === '/study' || pathname.startsWith('/profile') ? ' wide fit' : pathname === '/todo' ? ' wide stretch' : '')

  // Your own photo/frame for the "Me" button. Re-check on page change so it updates after you edit it.
  const [profileTick, setProfileTick] = useState(0)
  useEffect(() => {
    const bump = () => setProfileTick(n => n + 1)
    window.addEventListener('lock-in:profile-saved', bump)
    return () => window.removeEventListener('lock-in:profile-saved', bump)
  }, [])
  useEffect(() => {
    if (!user || !supabase) { setMe(null); return }
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data }) => setMe(data))
  }, [user?.id, pathname, profileTick]) // eslint-disable-line

  // your chosen colour tints the default banner everywhere (the top bar card, your profile, the banner picker)
  useEffect(() => {
    document.documentElement.style.setProperty('--my-color', colorHex(me?.color))
  }, [me?.color])

  // about once a day per device: ask the server to tidy away what has expired (old posts and their photo files).
  // Harmless if it is not set up yet, and it only ever removes what was already due.
  useEffect(() => {
    if (!user || !supabase || IS_FAKE) return
    try {
      const last = Number(localStorage.getItem('lock-in-cleanup-at') ?? 0)
      if (Date.now() - last < 20 * 3600 * 1000) return
      localStorage.setItem('lock-in-cleanup-at', String(Date.now()))
    } catch { /* storage blocked: just run it */ }
    supabase.functions.invoke('cleanup-files').catch(() => {})
  }, [user?.id]) // eslint-disable-line

  useEffect(() => { setPressed(null) }, [pathname])
  useEffect(() => { document.title = APP_TITLE }, [])   // tells the dev builds apart in the tab strip

  const activeIdx = TABS.findIndex(t =>
    pathname === t.to || (t.profile && pathname === '/shop'))
  const blobIdx = pressed ?? activeIdx

  const tabClass = (t, isActive) =>
    (isActive || (t.profile && pathname === '/shop') ? 'active' : '')

  const tabFace = (t, size) => t.profile
    ? <Avatar name={me?.display_name ?? 'Me'} path={me?.avatar_path} color={me?.color} frame={me?.frame} size={size} />
    : <Icon name={t.icon} size={size} />

  return (
    <div className="shell">
      <Scene />
      {user && <LookPicker />}
      {user && pathname !== '/login' && <StartupIntro />}
      {user && <DueReminders />}
      {user && <TimerOverlay />}
      {user && <StillStudying />}
      {user && <StudyFlagAlert />}
      <UpdateNotice />
      {user && <PipTimer />}
      {user && <PrizeNews />}
      {user && <PostBoostWatcher />}
      {user && <Tour />}
      {user && !IS_DEV_BUILD && <TermsGate />}   {/* the rules pop-up is skipped on localhost (npm run dev:*) so testing is not interrupted; the live site always shows it */}
      {user && <InstallPrompt />}
      {IS_ADMIN && !IS_FAKE && user && <DevPanel />}   {/* hidden in the shareable preview */}
      {/* PC: icon dock down the side. Icons are dim until you hover them. */}
      {user && (
        <aside className="dock-wrap">
          <nav className="dock" aria-label="Main">
            {TABS.map(t => (
              <NavLink key={t.to} to={t.to} end={t.end} data-label={t.label} aria-label={t.label}
                className={({ isActive }) => tabClass(t, isActive)}>
                {tabFace(t, t.profile ? 38 : 26)}
              </NavLink>
            ))}
          </nav>
        </aside>
      )}

      <div className="content">
        <nav className="nav">
          <SettingsMenu />
          <MailButton />
          <PageHelp />
          <Link to="/" className="brand" aria-label="LOCK IN"><Logo size={24} /><span className="brand-text">LOCK IN</span></Link>
          <span className="spacer" />
          {user && timer.running && (
            <Link to="/study" className="timer-chip">
              {timer.mode === 'focus' ? '🎯' : '☕'} {mmss(timer.left)}
            </Link>
          )}
          {user && (
            // one small "you" card instead of separate level and coin chips: your banner behind your picture, level and coins
            <div className={'me-chip ' + (me?.banner || 'banner-solid') + (me?.banner_path ? ' banner-pic' : '')} aria-label="You"
              style={me?.banner_path ? { '--pic': `url("${publicUrl(me.banner_path)}")` } : undefined}>
              <Link to="/profile" title="Your profile. Finish tasks and focus sessions to earn XP.">
                <Avatar name={me?.display_name ?? 'Me'} path={me?.avatar_path} color={me?.color} frame={me?.frame} size={26} />
                <span className="me-plate">Lv {xp !== null ? level : '–'}</span>
              </Link>
              <Link to="/shop" title="Your coins. Spend them in the Shop."><span className="me-plate"><Coin /> {balance.toLocaleString()}</span></Link>
              {xp !== null && (
                <span className="me-xp" aria-hidden="true"
                  style={{ width: `${Math.round(Math.min(1, Math.max(0, (xp - xpForLevel(level)) / Math.max(1, xpForLevel(level + 1) - xpForLevel(level)))) * 100)}%` }} />
              )}
            </div>
          )}
          {IS_DEV_BUILD && (
            <span className={'mode-chip ' + (IS_ADMIN ? 'admin' : 'basic')}>{IS_ADMIN ? 'Admin dev' : 'Basic'}</span>
          )}
          {DEMO && <span className="demo-chip" title="Filler data is switched on (VITE_DEMO_DATA)">Demo data</span>} {/* DEMO */}
          <button type="button" className="sound-chip" onClick={() => sound.setEnabled(!sound.enabled)}
            aria-pressed={sound.enabled} title={sound.enabled ? 'Sounds on. Click to mute.' : 'Sounds off. Click to turn on.'}>
            {sound.enabled ? '🔈' : '🔇'}<span className="sr-only">{sound.enabled ? 'Mute sounds' : 'Turn sounds on'}</span>
          </button>
          <InstallButton />
          {user ? (
            <button className="secondary" onClick={() => supabase.auth.signOut()}>Log out</button>
          ) : (
            <Link to="/login">Log in</Link>
          )}
        </nav>

        <main className={pageClass}>
          {!isConfigured && (
            <p className="warn">
              Supabase isn't configured yet. Copy <code>.env.example</code> to <code>.env</code> and fill it in.
            </p>
          )}
          <Routes>
            <Route path="/" element={<RequireAuth><Overview /></RequireAuth>} />
            <Route path="/todo" element={<RequireAuth><Todo /></RequireAuth>} />
            <Route path="/feed" element={<RequireAuth><Feed /></RequireAuth>} />
            <Route path="/study" element={<RequireAuth><Pomodoro /></RequireAuth>} />
            <Route path="/pomodoro" element={<Navigate to="/study" replace />} />
            <Route path="/buddy" element={<Navigate to="/study" replace />} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/profile/:id" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/shop" element={<RequireAuth><Shop /></RequireAuth>} />
            <Route path="/achievements" element={<RequireAuth><Achievements /></RequireAuth>} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/terms-of-service" element={<Legal page="tos" />} />
            <Route path="/privacy" element={<Legal page="privacy" />} />
            <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
            <Route path="/achievements/:id" element={<RequireAuth><Achievements /></RequireAuth>} />
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
            {IS_DEV_BUILD && <Route path="/preview/login" element={<Login preview />} />}
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        </main>

        {/* Phone: bottom bar with a liquid blob that slides to whichever button you press. */}
        {user && (
          <nav className="tabbar" aria-label="Main" style={{ '--i': Math.max(0, blobIdx) }}>
            <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
              <defs>
                <filter id="goo">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
                  <feColorMatrix in="blur" mode="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11" result="goo" />
                  <feBlend in="SourceGraphic" in2="goo" />
                </filter>
              </defs>
            </svg>
            <div className={'liquid' + (blobIdx < 0 ? ' hidden' : '')} aria-hidden="true">
              <span className="blob" />
              <span className="blob trail" />
            </div>
            {TABS.map((t, i) => (
              <NavLink key={t.to} to={t.to} end={t.end} aria-label={t.label}
                className={({ isActive }) => tabClass(t, isActive)}
                onPointerDown={() => setPressed(i)}
                onPointerCancel={() => setPressed(null)}>
                {tabFace(t, t.profile ? 30 : 25)}
                <span>{t.short}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
