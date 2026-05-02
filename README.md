# Aim

Cross-platform (iOS + Android) ballistics calculator and hunt-planning app for precision long-range **hunters**. V1 is **zero-backend, on-device-only**: Expo, React Native, TypeScript, local SQLite, MapLibre, Open-Meteo.

## Docs in this repo

| File | Purpose |
|------|---------|
| [`Initial_Build_Plan.md`](Initial_Build_Plan.md) | Product direction, stack, phased roadmap, costs, AI-agent workflow |
| [`Claude.md`](Claude.md) | Authoritative conventions for engineers and AI coding agents — read before implementing |

## Cursor

Persistent agent instructions live in [`.cursor/rules/`](.cursor/rules/) (always-on context for this repo). [AGENTS.md](AGENTS.md) is a short index of the same docs.

The Expo app (`app/`), workspace packages (`packages/`), and `landing/` are not scaffolded yet; add them following the build plan.

## Legacy note

This Git repository was previously a Unity/Godot project. Those trees are gone; ignore any older bookmarks or paths that pointed there.
