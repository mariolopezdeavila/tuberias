# Tuberías 2.0

A collaborative Continuous Delivery pipeline design game with an **AI Engineering extension**.
Based on *Pipeline: the game that delivers* by Eficode (https://github.com/eficode/pipeline-the-game).
Core card and scenario texts come from that project. Licence: GNU GPL v3 (see `LICENSE`).

**This repository is the single source of truth.** Change the files in `src/` (and `supabase/`), then run `python3 build.py`.
`index.html` at the root is generated and is what GitHub Pages serves: do not edit it by hand. Changes: see `CHANGELOG.md`.

## Use
- **Online rooms**: anyone creates a room and becomes its editor; others join with the 6-character code and watch live (read-only). Rooms can be listed in a lobby. Setup: see `GUIA-INSTALACION.md` (Spanish).
- **Offline**: open `index.html`. Without Supabase configuration (or with "Work offline"), everything stays in this browser.
- **Published app**: https://mariolopezdeavila.github.io/tuberias/

## Build
`python3 build.py` bundles `src/` (+ `vendor/supabase.js`) into `index.html` (root, served by GitHub Pages) and `dist/`.
`config.json` holds the Supabase project URL and **publishable** key (`sb_publishable_...`). Both are public by design: they end up inside the web page,
and security comes from the locked table and the functions in `supabase/setup.sql`. Never put a secret or service_role key there.
Without `config.json` the build is offline-only.

## Test
- `node test/engine.test.js` — evaluation engine
- `python3 test/ui_test.py` — offline UI (Playwright; skips the rooms screen if Supabase is configured)
- `python3 test/rooms_test.py` — rooms with the mock backend (`?backend=mock`)
- `python3 test/spoof_test.py` — fake broadcasts are ignored
- `python3 test/supabase_adapter_test.py` — Supabase adapter against a PostgREST-shaped stub
- `supabase/test_setup.sql` — SQL functions on a local PostgreSQL

## Architecture
- Pipeline model: DAG of stages; parallel or sequential cards; lead time = critical path; bottleneck in red.
- Online: one Supabase table, locked (RLS, no policies). Access only through `security definer` functions
  (`tuberias_create_room`, `get_room`, `save_room`, `check_key`, `list_rooms`). The edit key is stored hashed.
- Realtime broadcast only announces new versions; clients always read state from the database,
  so a participant without the edit key cannot push a fake board.

## Files
- `src/data.js` cards, rules, scenarios · `src/engine.js` evaluation · `src/sync.js` backends
- `src/ui1-4.js`, `src/ui_end.js`, `src/style.css`, `src/index.html` UI
- `index.html` generated app (GitHub Pages) · `dist/` same file, for tests · `config.json` Supabase URL + publishable key
- `supabase/setup.sql` database setup · `vendor/supabase.js` @supabase/supabase-js (MIT, see `vendor/LICENSE-supabase-js`)
