# Shatterline

A sci-fi hex-board card game about **breaking the enemy's will**. You place cards hidden and
at the same time as your opponent, Hive-style touching your army. Combat then resolves on
its own: advance, ranged volley, melee clash, routs. Morale, flanks, high ground and
encirclement decide the battle.

- Rules and design rationale: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)
- Art direction and faction visual bibles: [`docs/ART_DIRECTION.md`](docs/ART_DIRECTION.md)

## Run locally

```bash
npm install
```

```bash
npm run dev
```

This serves the client on http://localhost:5173 and the game server on :8080, with `/ws` proxied.

Production build:

```bash
npm run build && npm start
```

This builds and serves everything on :8080.

## Balance simulator

```bash
npm run sim -- 40
```

```bash
npm run sim -- 16 --arch
```

The first runs faction-level win rates with balanced decks. The second runs all 9
archetype decks against each other. The sim uses the same shared rules engine and AI as the game.

## Deploy to Fly.io

```bash
fly launch --no-deploy --copy-config
```

```bash
fly deploy
```

`fly.toml` runs a single `shared-cpu-1x` / 256 MB machine that auto-stops when idle. Game rooms
live in memory, so keep it to one machine.

## Layout

```
src/shared   rules engine, cards, hex math, map, AI, protocol (used by client, server and sim)
src/client   Vite + Three.js client (board, shaders, HUD, playback)
src/server   Node HTTP + WebSocket server (static files + 1v1 rooms)
src/sim      headless AI-vs-AI balance runner
docs         design + art direction
```

## Card art

Card art is not generated yet; it waits until the card list is final. The client already
loads `public/art/<card_id>.png` when the file exists and falls back to a placeholder.
The OpenRouter key goes in `.env` (gitignored) as `OPENROUTER_API_KEY`.
