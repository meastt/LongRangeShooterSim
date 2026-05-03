# Aim

Cross-platform (iOS + Android) ballistics calculator and hunt-planning app for precision long-range **hunters**. V1 is **zero-backend, on-device-only**: Expo, React Native, TypeScript, local SQLite, MapLibre, Open-Meteo.

## Docs in this repo

| File | Purpose |
|------|---------|
| [`Initial_Build_Plan.md`](Initial_Build_Plan.md) | Product direction, stack, phased roadmap, costs, AI-agent workflow |
| [`Claude.md`](Claude.md) | Authoritative conventions for engineers and AI coding agents — read before implementing |

## Cursor

Persistent agent instructions live in [`.cursor/rules/`](.cursor/rules/) (always-on context for this repo). [AGENTS.md](AGENTS.md) is a short index of the same docs.

## Repo layout

| Path | Role |
|------|------|
| `app/` | Expo SDK 54+ RN app (“Hello Aim”; EAS-ready) |
| `packages/solver/` | Pure TS ballistics package + Vitest harness (Phase 0 continues with JBM/Berger fixtures) |
| `landing/` | Astro static site for Cloudflare Pages |

From repo root: `npm run app:start`, `npm run test:solver`, `npm run landing:dev`.

## Legacy note

This Git repository was previously a Unity/Godot project. Those trees are gone; ignore any older bookmarks or paths that pointed there.
