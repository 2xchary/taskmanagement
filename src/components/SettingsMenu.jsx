import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useIsAdmin } from '../lib/moderation.js'
import { useSound, PACK_LABELS, SOUND_PACKS, SIGNATURE } from '../lib/sfx.jsx'
import { useMusic, TRACKS } from '../lib/music.jsx'
import { useNotify } from '../lib/notify.jsx'
import { useReducedMotion, useDockAnimated } from '../lib/motion.js'
import { useInstall, platform } from '../lib/install.js'
import { useTheme } from '../lib/theme.jsx'
import { replayTour } from './Tour.jsx'
import { introEnabled, setIntroEnabled } from '../lib/introPref.js'
import { remindersOn, setRemindersOn } from '../lib/dueReminders.js'
import { overlayOn, setOverlayOn } from './TimerOverlay.jsx'
import PickerModal from './PickerModal.jsx'
import { VERSION_LABEL } from '../lib/version.js'

// The settings button (top left) and its pop-up: sounds and music, notifications, and animations, in one place.
export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const sound = useSound()
  const music = useMusic()
  const notify = useNotify()
  const { theme } = useTheme()
  const [calm, setCalm] = useReducedMotion()
  const [dockOn, setDockOn] = useDockAnimated()
  const inst = useInstall()
  const isAdmin = useIsAdmin()
  const [installMsg, setInstallMsg] = useState('')
  const [intro, setIntro] = useState(introEnabled)
  const [remind, setRemind] = useState(remindersOn)
  const [overlay, setOverlay] = useState(overlayOn)
  const os = platform()
  const mac = /Mac/.test(navigator.platform)
  const ua = navigator.userAgent || ''
  const safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua)
  const firefox = /Firefox/.test(ua)

  async function installApp() {
    const r = await inst.install()
    setInstallMsg(r === 'accepted' ? 'Installed. Look for LOCK IN on your device.' : r === 'unavailable' ? '' : 'No problem. You can install it any time from here.')
  }

  return (
    <>
      <button type="button" className="settings-btn" onClick={() => { setOpen(true); sound.play('open') }}
        aria-label="Settings" title="Settings">
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </button>

      {open && (
        <PickerModal title="Settings" hint="Saved on this device." onClose={() => setOpen(false)}>
          <section className="settings-group">
            <h3>Sound</h3>
            <label className="row">
              <input type="checkbox" checked={sound.enabled} onChange={e => sound.setEnabled(e.target.checked)} />
              Interface sounds
            </label>
            <label className="row">
              <input type="checkbox" checked={music.musicOn} disabled={!sound.enabled}
                onChange={e => music.setMusicOn(e.target.checked)} />
              Quiet background music <span className="muted small">(pauses while the timer runs)</span>
            </label>
            <label>Music
              <select value={music.track} disabled={!sound.enabled || !music.musicOn} onChange={e => music.setTrack(e.target.value)}>
                {TRACKS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label>Volume
              <input type="range" min="0" max="1" step="0.05" value={sound.volume} disabled={!sound.enabled}
                onChange={e => sound.setVolume(Number(e.target.value))}
                onPointerUp={() => sound.play('press')} />
            </label>
            <label>Sound style
              <select value={sound.override} disabled={!sound.enabled} onChange={e => sound.setOverride(e.target.value)}>
                <option value="">{SIGNATURE ? 'LOCK IN sounds (default)' : `Match my theme (${PACK_LABELS[SOUND_PACKS[theme]] ?? 'Minimal'})`}</option>
                {SIGNATURE && <option value="theme">Match my theme ({PACK_LABELS[SOUND_PACKS[theme]] ?? 'Minimal'})</option>}
                {Object.entries(PACK_LABELS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          </section>

          <section className="settings-group">
            <h3>Animations</h3>
            <label className="row">
              <input type="checkbox" checked={calm} onChange={e => setCalm(e.target.checked)} />
              Calm mode <span className="muted small">(stills the moving backgrounds, glows and bouncing, and drops the frosted blur. Best for older phones.)</span>
            </label>
            <label className="row">
              <input type="checkbox" checked={dockOn} onChange={e => setDockOn(e.target.checked)} />
              Animate the side bar <span className="muted small">(the bobbing, swaying and glowing buttons on the left, and the liquid on the phone tab bar)</span>
            </label>
            <label className="row">
              <input type="checkbox" checked={intro} onChange={e => { setIntro(e.target.checked); setIntroEnabled(e.target.checked) }} />
              Show the welcome globe when the app opens <span className="muted small">(on this device. Turn it off if it gets in the way.)</span>
            </label>
          </section>

          <section className="settings-group">
            <h3>Notifications</h3>
            <label className="row">
              <input type="checkbox" checked={remind} onChange={e => { setRemind(e.target.checked); setRemindersOn(e.target.checked) }} />
              Remind me about tasks that are due <span className="muted small">(a sound and a pop-up the day before, the day of, an hour before and when it is due. On this device.)</span>
            </label>
            <label className="row">
              <input type="checkbox" checked={overlay} onChange={e => { setOverlay(e.target.checked); setOverlayOn(e.target.checked) }} />
              Show the timer in the corner <span className="muted small">(a faint clock on every page while the timer runs, so you can move around and still see it. On this device.)</span>
            </label>
            {!notify.supported && (
              <p className="muted small">This browser can't show notifications. On iPhone, add LOCK IN to your Home Screen first.</p>
            )}
            {notify.supported && notify.permission === 'denied' && (
              <p className="muted small">Notifications are blocked for this site. Allow them in your browser's site settings, then come back.</p>
            )}
            {notify.supported && notify.permission !== 'denied' && (
              <label className="row">
                <input type="checkbox" checked={!!notify.enabled}
                  onChange={e => (e.target.checked ? notify.enable() : notify.disable())} />
                Alert me when a study buddy matches with me
              </label>
            )}
          </section>

          <section className="settings-group">
            <h3>Install the app</h3>
            {inst.standalone ? (
              <p className="small">✓ LOCK IN is installed on this device. You're using the app version.</p>
            ) : inst.canPrompt ? (
              <>
                <p className="muted small">Install LOCK IN so it opens in its own window with its own icon, on your {os === 'desktop' ? 'computer' : 'phone'}.</p>
                <div className="row"><button type="button" onClick={installApp}>Install LOCK IN</button></div>
              </>
            ) : (
              <>
                <p className="muted small">Your browser doesn't offer a one-tap install here, but you can add it by hand:</p>
                <ul className="install-steps small">
                  {os === 'ios' && <li>Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.</li>}
                  {os === 'android' && <li>Open the browser menu <strong>⋮</strong>, then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>}
                  {os === 'desktop' && safari && <li>In Safari, choose <strong>File</strong>, then <strong>Add to Dock</strong>.</li>}
                  {os === 'desktop' && firefox && <li>Firefox on a computer can't install web apps. Open LOCK IN in Chrome or Edge to install it, or bookmark it with <strong>{mac ? '⌘ D' : 'Ctrl + D'}</strong>.</li>}
                  {os === 'desktop' && !safari && !firefox && <li>In Chrome or Edge, click the <strong>install icon</strong> at the right of the address bar, or open the menu <strong>⋮</strong> and choose <strong>Install LOCK IN</strong>.</li>}
                </ul>
              </>
            )}
            {installMsg && <p className="small" role="status">{installMsg}</p>}
          </section>

          <section className="settings-group">
            <h3>Help</h3>
            <div className="row">
              <button type="button" className="secondary" onClick={() => { setOpen(false); replayTour() }}>Replay the welcome tour</button>
              <Link to="/terms" onClick={() => setOpen(false)}><button type="button" className="secondary">Community rules</button></Link>
              <Link to="/terms-of-service" onClick={() => setOpen(false)}><button type="button" className="secondary">Terms of Service</button></Link>
              <Link to="/privacy" onClick={() => setOpen(false)}><button type="button" className="secondary">Privacy Policy</button></Link>
              {isAdmin && <Link to="/admin" onClick={() => setOpen(false)}><button type="button">Admin dashboard</button></Link>}
            </div>
          </section>
          <p className="muted small settings-version">LOCK IN {VERSION_LABEL}</p>
        </PickerModal>
      )}
    </>
  )
}
