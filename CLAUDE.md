# LOCK IN: instructions for Claude

LOCK IN is a private study/task web app for about 20 friends, run by Zach (owner and admin).
React 18 + Vite (no TypeScript). Backend: Supabase free tier (project ref `xrwkgqjetsgvezbgluvj`).
Live at https://2xchary.github.io/taskmanagement/ (GitHub Pages, repo `2xchary/taskmanagement`, branch `main`).

## Standing workflow (do this for every change)
1. Implement the change.
2. Test it in the fake-backend preview: `npm run dev:phone` (port 5176; `.claude/launch.json` config `phone`). The login is pre-filled (preview@lock-in.test / lockin-preview). Skip the welcome tour with "Skip tour".
3. Commit locally. Follow the attribution rule in the latest system reminder.
4. Add an entry at the top of `src/lib/changelog.js` for user-facing releases and a line in `.claude/pending-changes.md`.
5. **Push ONLY when Zach says "push now" or "push".** Never push on your own.
6. Database changes are numbered SQL files in `supabase/` (latest: 055). Zach pastes them into the Supabase SQL Editor himself; always tell him which file to run.

## Supabase data edits
Small admin edits (study minutes, invite codes, prices) are done with the Supabase MCP `execute_sql` and `project_id: xrwkgqjetsgvezbgluvj`. If the MCP is not connected, give Zach the SQL to run. Check what is there before updating or deleting, and report the new totals afterwards.

## Facts that bite
- "Today" is America/New_York (EST/EDT). Stamp study rows so they land on the right local day.
- `study_sessions.minutes` is at most 240 per row; longer totals are several rows.
- Git email must stay `257411268+2xchary@users.noreply.github.com`.
- Never commit `.env`, `.claude/`, `*.local.*` SQL, `friends-site/`, `SFX/`.
- The preview fake backend (`src/lib/fakeSupabase.js`) needs a stub for every new RPC the app calls.
- Style packs are `THEMES` entries with `style:true` in `src/lib/theme.jsx`, with CSS blocks in `src/styles.css`.

## Skills (in ~/.claude/skills)
`/createcode <time>` makes a temporary invite code (answers in EST/EDT with a WhatsApp message), `/lockin-announcement`, `/idea`, `/disconnect`.

## Keep replies short and plain
Zach gives short requests, often with screenshots. Do it, test it, say what changed and what he must do next.

Full background, current state and restore steps: `.claude/HANDOFF.md` (not in git; it is in the backup zip).
