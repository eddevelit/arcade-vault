# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Arcade Vault — a platform for playing games online and competing for the highest score ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos"). Next.js 16.2.10 (App Router, TypeScript, Tailwind CSS v4), Supabase for the game catalog + leaderboards, Resend for the contact form.

Built spec by spec (`specs/01` … `specs/10`). Current state: 5 public routes, 4 real playable canvas games (Asteroides, Tetris, Arkanoid, Serpiente) with real score persistence, plus a simulated player (`GamePlayer`) as the fallback for any catalog entry without an engine.

**All user-facing copy, game ids, and spec documents are in Spanish.** Keep it that way.

## Critical: this Next.js version has breaking changes vs. your training data

`AGENTS.md` (loaded above) is not optional context — before writing or editing any Next.js code, read the relevant page under `node_modules/next/dist/docs/` (organized as `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`). Do not assume APIs/conventions from training data are still correct. Confirmed differences already found in this version:

- `next build` no longer runs ESLint automatically — lint is a separate, explicit step (`npm run lint`).
- The `lint` script invokes the ESLint CLI directly (`"lint": "eslint"`), not `next lint`.
- Turbopack is the default bundler for both `next dev` and `next build` (pass `--webpack` to opt out).
- Route `params` are a `Promise` and must be awaited (see `app/juego/[id]/page.tsx`).

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build — does NOT lint
npm run lint     # eslint (flat config)
npm run format   # prettier --write .
```

There is no test runner configured. Verification is done by `npm run build` + `npm run lint` + manual/Playwright-MCP checks in the browser.

## Architecture

- **App Router only**, no `src/` directory — routes live directly under `app/`.
- **Import alias**: `@/*` maps to the repo root (`tsconfig.json`).
- **Routes**: `/` (home), `/biblioteca`, `/juego/[id]` (detail + leaderboard), `/juego/[id]/jugar` (player), `/salon-de-la-fama`, `/acerca-de`, `/login`, and `POST /api/contacto`.
- **Server/Client split**: pages are Server Components that fetch from Supabase and pass data down to a `*Client` component (`HomeClient`, `BibliotecaClient`, `HallOfFameClient`) for interactivity.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss`; theme tokens declared with `@theme inline` in `app/globals.css`, not a `tailwind.config.js`. In practice most of the retro UI lives in ~2900 lines of hand-written CSS in `globals.css` (`.av-*`, `.card`, `.cover-*`, `.crt*`, `.modal*`) driven by the CSS variables `--cyan` / `--magenta` / `--yellow` / `--green`. New UI should reuse those classes, not reinvent them in Tailwind utilities.
- **Fonts**: Press Start 2P (pixel), JetBrains Mono + Courier Prime (mono) via `next/font/google` in `app/layout.tsx`, exposed as `--pixel` / `--mono`.
- **Auth is simulated**: `lib/session.ts` stores `{ name }` under `av_user` in `localStorage` and exposes it via `useSyncExternalStore` (`useStoredUser`). There is no Supabase Auth yet.
- **`lib/data.ts`**: still exports the legacy `GAMES` array — **it has no consumers**; the catalog comes from Supabase. Only the `Game`/`ScoreRow` types and `CATS` are live. Don't add games there.
- **Linting**: flat config (`eslint.config.mjs`) composing `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. Prettier formats everything.

### Data layer (Supabase)

Remote project only — no local Supabase stack, no versioned DDL in the repo. Schema changes go through the `supabase` MCP server (`apply_migration`).

| Object                 | Purpose                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `games`                | Catalog: `id, title, short, long, cat, cover, color, best, plays, sort_order`. `cat` and `color` are CHECK-constrained. |
| `scores`               | `game_id → games.id` (FK), `player_name`, `score`, `created_at`.                                                        |
| `best_scores` (view)   | Best score per player per game.                                                                                         |
| `ranked_scores` (view) | Scores with a `rank` per game.                                                                                          |

Access modules — all generic by `game_id`, nothing game-specific:

- `lib/supabase/server.ts` / `lib/supabase/client.ts` — `@supabase/ssr` clients.
- `lib/games.ts` — `getGames()`, `getGame(id)` (server).
- `lib/scores.ts` — `getTopScores`, `getAllTopScores`, `getGameStats` (server-only).
- `lib/scores-client.ts` — `saveScore` (browser).

### Game architecture

Adding a playable game touches six integration points; the `/nuevo-juego` skill (`.claude/skills/nuevo-juego/SKILL.md`) documents them in full and is the source of truth. Summary:

1. **Engine** — `lib/games/<slug>.ts`: pure canvas 2D, no React, exposed as a factory `create<Nombre>Game(canvas, onGameOver) → { destroy, restart }`. All state lives in the closure (never module globals); `destroy()` cancels the RAF and removes every listener; `onGameOver(score)` fires exactly once. `lib/games/asteroids.ts` is the canonical reference.
2. **Client component** — `components/<Nombre>Game.tsx`: clone of `AsteroidsGame.tsx` (same props `{ game }`, same `over/finalScore/saved/saving/saveError` states, same `.crt` frame and `.modal` save flow).
3. **Registry** — add an entry to `GAME_COMPONENTS` in `lib/games/registry.ts` (`dynamic(..., { ssr: false })`). `GameLauncher` resolves `GAME_COMPONENTS[game.id] ?? GamePlayer`; the dispatcher itself is done — don't touch it.
4. **Row in `games`** — via `apply_migration` on the Supabase MCP server.
5. **Cover art** — a `.cover-<slug>` rule in `app/globals.css`, visually distinct from the existing covers.
6. **Leaderboard** — automatic. Once the `games` row exists, `/juego/<slug>` and `/salon-de-la-fama` show real scores through the FK. Never re-implement `lib/scores.ts` / `lib/scores-client.ts`.

Game assets live in `public/games/<slug>/` (e.g. the Arkanoid spritesheet, the Serpiente fruit atlas).

`references/implemented-games.md` is the living reference for the four real games — per-game categoría, color, cover class, engine, controls, assets and leaderboard state. Read it before touching the catalog, and update it when a new game ships.

## Environment

`.env.template` lists what `.env.local` must define: `RESEND_API_KEY`, `SUPABASE_DB_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Tooling in this repo

- **MCP servers** (`.mcp.json` + `.claude/settings.local.json`): `supabase` (schema, migrations, SQL) and `playwright` (browser verification). Playwright artifacts go to `.playwright-mcp/` and `.playwright-screenshots/`, both gitignored except their `.gitkeep`.
- **Hook** (`.claude/settings.json`): a `PostToolUse` hook runs `eslint --fix` + `prettier --write` on every file written or edited. Don't manually format after editing — it is already handled.

## Agentes

- **`game-planner`** (`.claude/agents/game-planner.md`) — decide _qué_ juego agregar después. Lee el catálogo (`references/implemented-games.md`, `lib/games/`, `specs/`), diagnostica los huecos (categorías/colores/mecánicas sin cubrir) y propone 3 candidatos rankeados con uno recomendado. Registra cada sugerencia y su veredicto en `references/game-suggestions-todo.md` para no repetir propuestas entre corridas. Corre **antes** de `/nuevo-juego`; no escribe specs ni código, y el único archivo que modifica es su bitácora.
- **`game-jam`** (`.claude/agents/game-jam.md`) — recibe un **tema** y escribe **tres specs de juego completos** en `specs/game-jam/<game-id>/spec.md`, con la misma forma y densidad que los specs 08/09/10 (los 6 puntos de integración incluidos). Corre de punta a punta **sin preguntar nada** y deja los tres en `Draft`. Es el modo exploratorio, paralelo a `game-planner` (que entrega una shortlist) y a `/nuevo-juego` (que conversa un solo spec). Los specs de jam viven fuera de la numeración oficial: para implementar uno hay que moverlo a `specs/NN-<slug>.md`, aprobarlo, y recién ahí correr `/spec-impl`. No escribe código, no toca Supabase, y no modifica la bitácora de `game-planner`.
- **`skin-designer`** (`.claude/agents/skin-designer.md`) — recibe un `game-id` **ya implementado** y garantiza que su motor tenga las tres skins de canvas: `clasico` (default, réplica exacta de los colores actuales), `neon` y `retro`. Audita primero, implementa sólo lo que falte y verifica con `npm run build` + `npm run lint` + Playwright. Su alcance es estrictamente cosmético y acotado: `lib/games/skins.ts` (tipo `SkinId` + persistencia en `localStorage` bajo `av_skin_<gameId>`), el motor `lib/games/<slug>.ts`, su componente (selector reusando `.btn ghost`/`.btn yellow`) y la fila del juego en `references/implemented-games.md`. No abre `app/globals.css`, no toca el registry, scores, Supabase, specs ni otros juegos, y una skin nunca cambia gameplay.
- **`mobile-porter`** (`.claude/agents/mobile-porter.md`) — recibe un `game-id` de un juego **recién implementado** y garantiza que `/juego/<id>` y `/juego/<id>/jugar` luzcan y funcionen bien en desktop y en mobile: sin overflow horizontal, canvas/`.crt` escalando bien, y `TouchControls` integrado según el patrón de [Spec 11](specs/11-controles-tactiles-mobile.md). Audita con Playwright en una matriz de viewports (mobile chico/grande, tablet, desktop) y corrige sólo dentro de su carril: el componente y el motor de ESE juego, más reglas de `app/globals.css` exclusivas de ese juego (`.cover-<slug>`); bugs en `TouchControls.tsx`, en CSS compartido o en otros juegos se reportan, no se arreglan. Corre después de `/spec-impl` de un juego nuevo; los 4 juegos originales y el resto del sitio (nav, home, biblioteca, salón de la fama, formularios) quedan fuera de su alcance por defecto.

## Skills

- **`/frontend-design`** — usar siempre para diseñar o rediseñar interfaz de usuario.
- **`/spec`** — design a spec (questions first, then section by section). Output only, no code.
- **`/spec-impl NN-<slug>`** — implement an approved spec; creates its own `spec-NN-<slug>` branch.
- **`/nuevo-juego`** — project-local skill (`.claude/skills/nuevo-juego/`): a specialized `/spec` that designs the spec for a new playable game + leaderboard, with the six integration points above baked in. Use it instead of plain `/spec` for any new game.

`/spec` and `/spec-impl` come from https://github.com/Klerith/fernando-skills (installed globally). If they're missing, install with `npx skills@latest add Klerith/fernando-skills` rather than improvising an equivalent workflow.

## Spec Driven Design workflow

Every feature starts as `specs/NN-<slug>.md` and follows this loop:

1. `/spec` (or `/nuevo-juego` for games) → writes the spec in `Draft`.
2. The **user** reviews it and flips the state to `Aprobado`. Claude never self-approves.
3. `/spec-impl NN-<slug>` → creates branch `spec-NN-<slug>` (auto, per `AutoCreateBranch: true` in `specs/.spec-config.yml`), implements it, and the branch is merged via PR into `main`.
4. The spec's state becomes `Implementado`.

Spec documents are in Spanish and share a fixed shape: header bullets (`Estado` / `Dependencias` / `Fecha` / `Objetivo`), `## Alcance` (Incluye / No incluye), `## Modelo de datos`, `## Plan de implementación`, `## Criterios de aceptación`, `## Decisiones tomadas y descartadas`, `## Riesgos identificados`. Match that shape and level of detail — `05-asteroides.md`, `06-tabla-juegos-supabase.md` and `07-leaderboard-real.md` are the gold standard.

Specs so far: 01 pantallas MVP · 02 homepage · 03 acerca-de + contacto (Resend) · 04 setup Supabase · 05 Asteroides · 06 tabla `games` · 07 leaderboard real · 08 Tetris (introdujo el registry) · 09 Arkanoid · 10 Serpiente.
