// A tiny in-memory stand-in for Supabase, used only by the preview build (npm run build:wip).
// It talks to nothing: no server, no real accounts, no real data. It understands just the calls this app makes
// (select / insert / update / delete / upsert with eq, in, gte, ..., or, order, limit, single), keeps rows in
// memory (and in this browser's localStorage, so a refresh keeps them), and signs in one fixed fake account.
import seed from './fakeSeed.json'

export const FAKE_EMAIL = 'preview@lock-in.test'
export const FAKE_PASSWORD = 'lockin-preview'
const ME = '00000000-0000-4000-8000-000000000001'
const KEY = 'lock-in-fake-db'
const SESSION_KEY = 'lock-in-fake-session'

const iso = d => d.toISOString().slice(0, 10)
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now())

function freshDb() {
  const today = new Date()
  const plus = n => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d) }
  const t = (title, day, extra = {}) => ({
    id: uid(), user_id: ME, title, day, done: false, color: 'blue', course: null, category: null, due_date: null,
    notes: null, created_at: new Date().toISOString(), ...extra,
  })
  return {
    profiles: [{
      id: ME, display_name: 'Preview Admin', username: 'preview.admin', college: 'Gordon College', bio: 'Trying out LOCK IN.',
      color: 'blue', avatar_path: null, frame: 'frame-none', banner: 'banner-solid', theme: 'default', starter_chosen: true,
      created_at: new Date().toISOString(),
    }],
    cosmetics: seed.cosmetics,
    shop_items: seed.shop_items,
    purchases: [],
    achievements: seed.achievements ?? [],
    shop_bundles: seed.bundles ?? [],
    user_achievements: [],
    tasks: [
      t('Review lecture notes', plus(0), { course: 'BIO 101', category: 'Study' }),
      t('Email professor about the essay', plus(0), { course: 'ENG 101', category: 'Personal' }),
      t('Lab report: first draft', plus(1), { course: 'CHE 121', category: 'Homework', color: 'green' }),
      t('Read chapter 5', plus(2), { course: 'HIS 210', category: 'Reading', color: 'amber' }),
      t('Plan group project', null, { course: 'COM 150', category: 'Project' }),
    ],
    // three weeks of focus sessions so the charts, streak and leaderboard look lived in
    study_sessions: Array.from({ length: 21 }, (_, i) => i).flatMap(back => {
      const mins = [50, 25, 75, 0, 45, 90, 30, 60, 0, 40, 25, 70, 35, 55, 0, 80, 45, 30, 65, 25, 50][back]
      if (!mins) return []
      const d = new Date(today); d.setDate(d.getDate() - back); d.setHours(16, 30, 0, 0)
      return [{ id: uid(), user_id: ME, minutes: mins, created_at: d.toISOString() }]
    }),
    posts: [], comments: [], reactions: [], study_queue: [], canvas_feeds: [],
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fresh */ }
  return freshDb()
}
const db = load()
// shop rows always come from the seed so new items appear after a rebuild
db.cosmetics = seed.cosmetics
db.shop_items = seed.shop_items
db.achievements = seed.achievements ?? []
db.shop_bundles = seed.bundles ?? []
db.announcements ??= [{ id: 'demo-a1', title: 'Welcome to the LOCK IN alpha', body: 'Thanks for testing! The mail button at the top holds announcements and the version history.', major: true, created_at: new Date().toISOString(), expires_at: null }]
db.user_achievements ??= []
// two other members so tagging has someone to pick, and a few things that "happened" to the preview account
for (const [id, name, color] of [['demo-m1', 'Priya Shah', 'pink'], ['demo-m2', 'Alex Rivera', 'green']]) {
  if (!db.profiles.some(p => p.id === id)) db.profiles.push({ id, display_name: name, username: null, college: null, bio: '', color, avatar_path: null, frame: 'frame-none', banner: 'banner-solid', theme: 'default', created_at: new Date().toISOString() })
}
// the posts those notifications point at, so tapping one in the mail shows a real post
db.posts ??= []
for (const r of [
  { id: 'demo-p1', user_id: ME, body: 'Finished chapter 6 problem set!', kind: 'win', minsAgo: 90 },
  { id: 'demo-p2', user_id: ME, body: 'Chem notes done', kind: 'study', minsAgo: 150 },
  { id: 'demo-p3', user_id: 'demo-m2', body: 'Study group at 7, @Preview Admin you in?', kind: 'question', minsAgo: 360, mentions: [ME] },
]) {
  if (db.posts.some(x => x.id === r.id)) continue
  db.posts.push({ id: r.id, user_id: r.user_id, body: r.body, image_path: null, kind: r.kind, edited_at: null, pinned: false, share_kind: null, share_data: null,
    mentions: r.mentions ?? [], created_at: new Date(Date.now() - r.minsAgo * 60000).toISOString() })
}
db.comments ??= []
if (!db.comments.some(c => c.id === 'demo-c1')) db.comments.push({ id: 'demo-c1', post_id: 'demo-p1', user_id: 'demo-m1', body: 'Great work, which chapter was it?', created_at: new Date(Date.now() - 12 * 60000).toISOString() })
db.reactions ??= []
for (const [id, u] of [['demo-r1', 'demo-m1'], ['demo-r2', 'demo-m2']]) {
  if (!db.reactions.some(x => x.id === id)) db.reactions.push({ id, post_id: 'demo-p2', user_id: u, kind: 'like' })
}
db.notifications ??= [
  { id: 'demo-n1', user_id: ME, actor_id: 'demo-m1', kind: 'comment', post_id: 'demo-p1', detail: 'Great work, which chapter was it?', read: false, created_at: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: 'demo-n2', user_id: ME, actor_id: 'demo-m1', kind: 'reaction', post_id: 'demo-p2', detail: 'Chem notes done', read: false, created_at: new Date(Date.now() - 50 * 60000).toISOString() },
  { id: 'demo-n3', user_id: ME, actor_id: 'demo-m2', kind: 'reaction', post_id: 'demo-p2', detail: 'Chem notes done', read: false, created_at: new Date(Date.now() - 55 * 60000).toISOString() },
  { id: 'demo-n4', user_id: ME, actor_id: 'demo-m2', kind: 'mention_post', post_id: 'demo-p3', detail: 'Study group at 7, @Preview Admin you in?', read: true, created_at: new Date(Date.now() - 5 * 3600000).toISOString() },
]
// a couple of friends who are open to study, so the Study page has someone to show
if (!db.study_queue?.length) {
  const until = new Date(Date.now() + 2 * 3600000).toISOString()
  db.study_queue = [
    { user_id: 'demo-m1', role: 'have_room', room: 'Jenks 421', room_until: until, note: 'Organic chemistry problem set', matched_with: null, joined_at: new Date().toISOString() },
    { user_id: 'demo-m2', role: 'need_room', room: '', room_until: null, note: '', matched_with: null, joined_at: new Date().toISOString() },
  ]
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ } }

// ---- filters --------------------------------------------------------------------------------
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const OPS = {
  eq: (v, x) => v === x || String(v) === String(x),
  neq: (v, x) => !(v === x || String(v) === String(x)),
  gt: (v, x) => v != null && cmp(v, x) > 0,
  gte: (v, x) => v != null && cmp(v, x) >= 0,
  lt: (v, x) => v != null && cmp(v, x) < 0,
  lte: (v, x) => v != null && cmp(v, x) <= 0,
  is: (v, x) => (x === 'null' || x === null ? v == null : String(v) === String(x)),
  in: (v, x) => (Array.isArray(x) ? x : String(x).replace(/[()]/g, '').split(',')).map(String).includes(String(v)),
  contains: (v, x) => Array.isArray(v) && (Array.isArray(x) ? x : [x]).every(i => v.includes(i)),
}

// parses PostgREST's or=(a.is.null,and(b.gte.1,b.lte.2)) into a predicate
function splitTop(s) {
  const parts = []; let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  if (cur) parts.push(cur)
  return parts
}
function orPredicate(expr) {
  const term = s => {
    const and = /^and\((.*)\)$/.exec(s)
    if (and) { const ps = splitTop(and[1]).map(term); return r => ps.every(p => p(r)) }
    const m = /^([^.]+)\.([^.]+)\.(.*)$/.exec(s)
    if (!m) return () => true
    const [, col, op, val] = m
    return r => (OPS[op] ?? OPS.eq)(r[col], val)
  }
  const ps = splitTop(expr).map(term)
  return r => ps.some(p => p(r))
}

// ---- joins in select("*, profiles(display_name), reactions(kind), comments(count)") ----------------
function embeds(sel) {
  const out = []
  const re = /(\w+)(?:!\w+)?\(([^)]*)\)/g
  let m
  while ((m = re.exec(sel || ''))) out.push({ rel: m[1], cols: m[2].split(',').map(c => c.trim()).filter(Boolean) })
  return out
}
const pick = (row, cols) => (!row ? row : Object.fromEntries(cols.map(c => [c, row[c]])))

function shape(row, table, sel) {
  let r = { ...row }
  for (const { rel, cols } of embeds(sel)) {
    if (rel === 'profiles') {
      const p = db.profiles.find(x => x.id === (r.user_id ?? r.id))
      r.profiles = p ? pick(p, cols.includes('*') ? Object.keys(p) : cols) : null
    } else if (cols.length === 1 && cols[0] === 'count') {
      r[rel] = [{ count: (db[rel] ?? []).filter(x => x[table.replace(/s$/, '') + '_id'] === r.id).length }]
    } else if (db[rel]) {
      const fk = table.replace(/s$/, '') + '_id'
      r[rel] = db[rel].filter(x => x[fk] === r.id).map(x => pick(x, cols))
    }
  }
  const plain = (sel || '*').replace(/\w+(?:!\w+)?\([^)]*\)/g, '').split(',').map(s => s.trim()).filter(Boolean)
  if (plain.length && !plain.includes('*')) {
    const keep = new Set([...plain, ...embeds(sel).map(e => e.rel)])
    r = Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k)))
  }
  return r
}

class Query {
  constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.orders = []; this.max = null; this.want = 'many'; this.sel = '*' }
  select(s = '*', opts = {}) { this.sel = s; this.returning = true; if (opts.head) this.head = true; return this }
  insert(v) { this.op = 'insert'; this.payload = v; return this }
  update(v) { this.op = 'update'; this.payload = v; return this }
  upsert(v) { this.op = 'upsert'; this.payload = v; return this }
  delete() { this.op = 'delete'; return this }
  eq(c, v) { return this.f(c, 'eq', v) }
  neq(c, v) { return this.f(c, 'neq', v) }
  gt(c, v) { return this.f(c, 'gt', v) }
  gte(c, v) { return this.f(c, 'gte', v) }
  lt(c, v) { return this.f(c, 'lt', v) }
  lte(c, v) { return this.f(c, 'lte', v) }
  in(c, v) { return this.f(c, 'in', v) }
  is(c, v) { return this.f(c, 'is', v) }
  not(c, op, v) { this.filters.push(r => !OPS[op](r[c], v)); return this }
  contains(c, v) { return this.f(c, 'contains', v) }
  or(expr) { this.filters.push(orPredicate(expr)); return this }
  f(c, op, v) { this.filters.push(r => OPS[op](r[c], v)); return this }
  order(c, o = {}) { this.orders.push([c, o.ascending !== false]); return this }
  limit(n) { this.max = n; return this }
  range(a, b) { this.off = a; this.max = b + 1; return this }
  single() { this.want = 'single'; return this }
  maybeSingle() { this.want = 'maybe'; return this }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej) }

  run() {
    const rows = (db[this.table] ??= [])
    const match = r => this.filters.every(p => p(r))
    let hit = []
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload]
      for (const v of list) {
        const row = { id: uid(), created_at: new Date().toISOString(), ...v }
        const key = this.table === 'canvas_feeds' ? 'user_id' : null
        const i = key ? rows.findIndex(r => r[key] === row[key]) : -1
        if (this.op === 'upsert' && i >= 0) { rows[i] = { ...rows[i], ...v }; hit.push(rows[i]) } else { rows.push(row); hit.push(row) }
      }
      save()
    } else if (this.op === 'update') {
      for (const r of rows) if (match(r)) { Object.assign(r, this.payload); hit.push(r) }
      save()
    } else if (this.op === 'delete') {
      db[this.table] = rows.filter(r => { const m = match(r); if (m) hit.push(r); return !m })
      save()
    } else hit = rows.filter(match)

    if (this.op !== 'select' && !this.returning) return { data: null, error: null }
    hit = hit.map(r => shape(r, this.table, this.sel))
    for (const [c, asc] of [...this.orders].reverse()) hit.sort((a, b) => (asc ? 1 : -1) * cmp(a[c] ?? '', b[c] ?? ''))
    if (this.head) return { data: null, count: hit.length, error: null }
    if (this.max != null) hit = hit.slice(this.off ?? 0, this.max)
    if (this.want === 'single') return hit.length === 1 ? { data: hit[0], error: null } : { data: null, error: { message: 'No row found' } }
    if (this.want === 'maybe') return { data: hit[0] ?? null, error: null }
    return { data: hit, error: null }
  }
}

// ---- rpc -------------------------------------------------------------------------------------
const FAKE_XP = 20000   // a high level, so the preview feels fully unlocked
const FAKE_STATS = {
  tasks_done: 28, sessions: 9, focus_minutes: 1320, longest_session: 75, streak_days: 5, weekly_minutes_best: 640,
  posts: 1, comments: 4, reactions_received: 7, level: 6, purchases: 2, profile_complete: 1,
}
const FAKE_PEOPLE = () => [
  ...db.profiles.map(p => ({ id: p.id, display_name: p.display_name, username: p.username, college: p.college, email: 'preview@lock-in.test', created_at: p.created_at, last_sign_in: new Date().toISOString(), xp: FAKE_XP, level: 20, coins: 9999, posts: 0, comments: 0, status: 'active', mod_reason: null, mod_until: null, tos_version: 1 })),
  { id: 'demo-u1', display_name: 'Priya S.', username: 'priya.s', college: 'Gordon College', email: 'priya@example.edu', created_at: new Date(Date.now() - 9 * 864e5).toISOString(), last_sign_in: new Date().toISOString(), xp: 1640, level: 6, coins: 410, posts: 5, comments: 12, status: 'active', mod_reason: null, mod_until: null, tos_version: 1 },
  { id: 'demo-u2', display_name: 'Alex R.', username: 'alex.r', college: 'Gordon College', email: 'alex@example.edu', created_at: new Date(Date.now() - 4 * 864e5).toISOString(), last_sign_in: new Date().toISOString(), xp: 380, level: 3, coins: 90, posts: 1, comments: 3, status: 'muted', mod_reason: 'Spam in comments', mod_until: new Date(Date.now() + 2 * 864e5).toISOString(), tos_version: 1 },
]
const rpcs = {
  is_admin: () => true,
  owner_ids: () => [ME],
  admin_post_announcement: args => { db.announcements.unshift({ id: 'a-' + Date.now(), title: args?.head, body: args?.msg ?? '', major: !!args?.is_major, created_at: new Date().toISOString(), expires_at: null }); save(); return null },
  streak_status: args => {
    const day = args?.local_day ?? new Date().toISOString().slice(0, 10)
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() - (6 - i))
      const done = i !== 2
      return { day: d.toISOString().slice(0, 10), mins: done ? 25 + i * 5 : 0, done }
    })
    const claimed = !!db.streak_claimed_today
    return { streak: 12, best: 12, today_minutes: 40, today_done: true, claimed_today: claimed, week }
  },
  claim_streak_bonus: () => { db.streak_claimed_today = true; save(); return { streak: 12, amount: 30, milestone: 0 } },
  weekly_winners: () => [
    { week_start: '2026-10-05', rank: 1, user_id: 'demo-m1', display_name: 'Priya Shah', avatar_path: null, color: 'pink', frame: 'frame-none', minutes: 410, coins: 150 },
    { week_start: '2026-10-05', rank: 2, user_id: 'demo-m2', display_name: 'Alex Rivera', avatar_path: null, color: 'green', frame: 'frame-none', minutes: 305, coins: 100 },
  ],
  my_new_prizes: () => [],
  boost_status: () => ({ ready: true }),
  boost_news: () => [],
  accept_terms: args => { if (db.profiles[0]) db.profiles[0].tos_version = args?.v ?? 1; save(); return null },
  admin_overview: () => ({ users: 3, new_7d: 2, active_7d: 3, focus_hours_7d: 31.5, posts: 6, posts_7d: 4, comments: 15, reports_open: 1, muted: 1, banned: 0, tasks_done_7d: 22 }),
  admin_list_users: () => FAKE_PEOPLE(),
  admin_recent_posts: () => [{ id: 'demo-p1', user_id: 'demo-u1', author: 'Priya S.', body: 'Finished the whole problem set!', image_path: 'x', created_at: new Date().toISOString(), comments: 3, reports: 0 }],
  admin_list_reports: () => [{ id: 'demo-r1', reason: 'Spam or ads', status: 'open', created_at: new Date().toISOString(), reporter: 'Priya S.', target_user: 'demo-u2', target: 'Alex R.', post_id: null, comment_id: 'demo-c1', content: 'check out my store!!', image_path: null }],
  admin_recent_log: () => [{ created_at: new Date().toISOString(), action: 'set muted', detail: 'Spam in comments (3 days)', admin: 'Preview Admin', target: 'Alex R.' }],
  user_xp: () => FAKE_XP,
  coin_balance: () => 9999,
  my_achievement_stats: () => FAKE_STATS,
  check_achievements: () => {
    const fresh = []
    for (const a of db.achievements) {
      if (db.user_achievements.some(r => r.achievement_id === a.id)) continue
      if ((FAKE_STATS[a.stat] ?? 0) >= a.goal) {
        db.user_achievements.push({ user_id: ME, achievement_id: a.id, earned_at: new Date().toISOString(), coins_paid: a.reward_coins, pinned: false })
        fresh.push({ ach_id: a.id, ach_name: a.name, ach_coins: a.reward_coins, ach_item: a.reward_item })
      }
    }
    if (fresh.length) save()
    return fresh
  },
  set_pinned_achievements: args => {
    const ids = args?.ids ?? []
    db.user_achievements.forEach(r => { r.pinned = ids.includes(r.achievement_id) })
    save()
    return null
  },
  share_to_feed: args => {
    const d = new Date().toISOString()
    const base = { id: 'fake-share-' + Date.now(), user_id: ME, image_path: null, created_at: d, pinned: false, edited_at: null }
    if (args?.card === 'achievement') {
      const a = db.achievements.find(x => x.id === args.ref)
      db.posts.unshift({ ...base, body: 'Unlocked the "' + (a?.name ?? 'badge') + '" badge', kind: 'win', share_kind: 'achievement',
        share_data: { id: a?.id, name: a?.name, icon: a?.icon, tier: a?.tier, description: a?.description } })
    } else {
      db.posts.unshift({ ...base, body: 'Studied', kind: 'study', share_kind: args?.card,
        share_data: { minutes: args?.card === 'study_week' ? 640 : 95, sessions: args?.card === 'study_week' ? 9 : 3 } })
    }
    save()
    return base.id
  },
  admin_pin_post: args => {
    const p = db.posts.find(x => x.id === args?.pid)
    if (p) { p.pinned = !!args?.pin; save() }
    return null
  },
  mark_notifications_read: () => { db.notifications.forEach(n => { n.read = true }); save(); return null },
  username_available: () => true,
  weekly_leaderboard: () => [],
}

// ---- auth ------------------------------------------------------------------------------------
const fakeUser = () => ({
  id: ME, email: FAKE_EMAIL, created_at: new Date().toISOString(),
  user_metadata: { display_name: 'Preview Admin' },
})
const listeners = new Set()
const readSession = () => { try { return localStorage.getItem(SESSION_KEY) === '1' ? { user: fakeUser() } : null } catch { return null } }
const setSession = on => {
  try { on ? localStorage.setItem(SESSION_KEY, '1') : localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  const s = on ? { user: fakeUser() } : null
  listeners.forEach(fn => fn(on ? 'SIGNED_IN' : 'SIGNED_OUT', s))
}

const uploaded = {}

export const fakeSupabase = {
  from: table => new Query(table),
  rpc: async (name, args) => ({ data: rpcs[name] ? rpcs[name](args) : null, error: null }),
  auth: {
    getSession: async () => ({ data: { session: readSession() } }),
    onAuthStateChange: fn => {
      listeners.add(fn)
      return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }
    },
    signInWithPassword: async ({ email, password }) => {
      if (String(email).trim().toLowerCase() !== FAKE_EMAIL || password !== FAKE_PASSWORD) {
        return { data: null, error: { message: 'Use the preview login shown on this card.' } }
      }
      setSession(true)
      return { data: { session: readSession() }, error: null }
    },
    signUp: async () => ({ data: null, error: { message: 'Sign-up is switched off in the preview. Use the preview login.' } }),
    signOut: async () => { setSession(false); return { error: null } },
  },
  storage: {
    from: () => ({
      upload: async (path, blob) => { try { uploaded[path] = URL.createObjectURL(blob) } catch { /* ignore */ } return { error: null } },
      remove: async () => ({ error: null }),
      getPublicUrl: path => ({ data: { publicUrl: uploaded[path] ?? '' } }),
    }),
  },
  functions: {
    // the preview pretends a school calendar is connected, with a few assignments this week and next
    invoke: async name => {
      if (name !== 'canvas-feed') return { data: { ok: true }, error: null }
      const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
      const mk = (i, title, course, n) => ({ uid: 'fake-canvas-' + i, title, course, due: day(n), allDay: true, url: '', description: '' })
      return { data: { connected: true, provider: 'canvas', assignments: [
        mk(1, 'Problem Set 6', 'MAT 212', 1), mk(2, 'Lab report: titration', 'CHE 121', 2), mk(3, 'Reading response 4', 'ENG 101', 2),
        mk(4, 'Discussion post', 'HIS 110', 4), mk(5, 'Midterm study guide', 'BIO 101', 8), mk(6, 'Essay outline', 'ENG 101', 10),
      ] }, error: null }
    },
  },
  channel() { const c = { on: () => c, subscribe: () => c }; return c },
  removeChannel() {},
}
