# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Arcade Vault — a platform for playing games online and competing for the highest score ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos"). The repo is currently a fresh `create-next-app` scaffold (Next.js 16.2.10, App Router, TypeScript, Tailwind CSS v4, ESLint) — `app/page.tsx` and `app/layout.tsx` still contain the default boilerplate, no game/vault features exist yet.

## Critical: this Next.js version has breaking changes vs. your training data

`AGENTS.md` (loaded above) is not optional context — before writing or editing any Next.js code, read the relevant page under `node_modules/next/dist/docs/` (organized as `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`). Do not assume APIs/conventions from training data are still correct. Confirmed differences already found in this version:

- `next build` no longer runs ESLint automatically — lint is a separate, explicit step (`npm run lint`).
- The `lint` script invokes the ESLint CLI directly (`"lint": "eslint"`), not `next lint`.
- Turbopack is the default bundler for both `next dev` and `next build` (pass `--webpack` to opt out).

## Commands

```bash
npm run dev     # start dev server (Turbopack) at http://localhost:3000
npm run build   # production build (Turbopack; does NOT run lint)
npm run start   # serve the production build
npm run lint    # run ESLint (flat config in eslint.config.mjs)
```

There is no test runner configured in `package.json` yet.

## Architecture notes

- **App Router only**, no `src/` directory — routes live directly under `app/`.
- **Import alias**: `@/*` maps to the repo root (`tsconfig.json`).
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`); theme tokens (colors, fonts) are declared with `@theme inline` in `app/globals.css`, not a `tailwind.config.js`.
- **Fonts**: Geist Sans/Mono loaded via `next/font/google` in `app/layout.tsx` and exposed as CSS variables consumed by the Tailwind theme.
- **Linting**: flat config (`eslint.config.mjs`) composing `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

## Spec Driven Design workflow

This project intends to follow spec-driven development using `/spec` and `/spec-impl` commands, per the practices at https://github.com/Klerith/fernando-skills. Those skills are not yet installed in this repo (no `.claude/` directory present) — install with:

```bash
npx skills@latest add Klerith/fernando-skills
```

If `/spec` or `/spec-impl` are invoked and the skills aren't present, install them first rather than improvising an equivalent workflow.
