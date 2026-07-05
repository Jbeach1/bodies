# Bodies

A neutral moderator for **Bodies** — a live-action social-deduction party game
(Mafia/Werewolf × Among Us) played in person. The app removes friction at three
points — role assignment, alive/dead tracking, and voting — and otherwise
disappears into the background.

See [`docs/PRD.md`](docs/PRD.md) for the spec and [`docs/issues/`](docs/issues)
for the build slices.

## Stack

- **Vite + React + React Router** SPA (static deploy).
- **Supabase** (Postgres + Realtime) backend; mutations via Postgres RPCs.
- **Identity:** localStorage UUID, no auth (PRD §2/§7).
- **Theme:** restrained noir, dark-only — monochrome + a single red accent.

## Getting started

```sh
npm install
cp .env.example .env      # then fill in your Supabase URL + anon key
npm run dev
```

Open the printed local URL. Without Supabase env vars the shell still boots
(the Home screen shows a "backend not configured" notice); fill `.env` to enable
the connectivity round-trip.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Copy the project URL + `anon` public key into `.env`
   (Project → Settings → API).
3. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.

## Scripts

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Start the dev server.                 |
| `npm run build`   | Production build to `dist/`.          |
| `npm run preview` | Serve the production build locally.   |

## Deploy (Vercel)

Zero-config for Vite. Import the repo, set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as environment variables, deploy. `vercel.json`
rewrites all paths to `index.html` for client-side routing.
