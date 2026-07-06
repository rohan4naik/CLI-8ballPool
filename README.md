# 🎱 8ball-pool

**Play 8-ball pool in your terminal** — real ball physics, live arrow-key
aiming, animated shots, and full bar rules. Zero dependencies, pure Node.js.

```bash
npx 8ball-pool
```

---

## Install

Run it instantly with no install:

```bash
npx 8ball-pool
```

Or install globally:

```bash
npm install -g 8ball-pool
8ball-pool     # or the short alias: 8ball
```

Requires **Node.js 18+** and a real terminal at least **40×12** (bigger = bigger
table).

---

## How to play

Two players share one terminal, hot-seat style. You **aim live with the
keyboard** — a grey dotted guide line shows the cue path and moves as you turn,
so you always see where the ball will go before you shoot.

| Key       | Action                     |
|-----------|----------------------------|
| `←` / `→` | turn the cue (3°)          |
| `,` / `.` | fine turn (0.5°)           |
| `↑` / `↓` | more / less power          |
| `Enter`   | take the shot              |
| `q`       | quit                       |

The scoreboard shows a **bold highlighted badge** for whose turn it is, each
player's group, and how many balls they have left. A power bar shows shot
strength.

### The board

- 🟧 **Solids** `1-7` — orange discs
- 🟦 **Stripes** `9-15` — cyan discs
- 🟪 **8 ball** — magenta
- ⬜ **Cue** — white
- Dark rings are the six pockets

The table **scales to your window** and repaints live when you resize it.

---

## Rules (simplified 8-ball)

1. **Break** the rack, then the table is *open* — no groups assigned yet.
2. Legally pot a ball and you **claim that group** (solids or stripes); your
   opponent gets the other.
3. Pot one of **your own** balls on a legal shot and you **shoot again**.
4. **Fouls** pass the turn and give your opponent *ball in hand* (the cue is
   respotted):
   - scratching the cue ball,
   - hitting nothing,
   - hitting the wrong group first,
   - no rail contact after the hit.
5. Clear all your group, then sink the **8 ball** to **win**. Sink the 8 early
   — or scratch while sinking it — and you **lose**.

---

## The physics

A fixed-timestep engine ([`src/physics.js`](src/physics.js)) drives everything:

- rolling friction that brings balls smoothly to rest,
- elastic, equal-mass ball-to-ball collisions resolved along the line of
  centres,
- cushion bounces with restitution,
- pocket capture by radius.

Every shot is fully simulated up front and recorded as animation frames, which
the CLI replays so you watch the balls roll.

---

## Development

```bash
git clone https://github.com/rohan4naik/CLI-8ballPool.git
cd CLI-8ballPool
npm start      # play
npm test       # headless engine + rules checks
```

### Project structure

```
src/
  vector.js    2D vector math
  table.js     geometry, pockets, ball groups
  physics.js   simulation loop (friction, collisions, pockets)
  render.js    ANSI terminal renderer (adaptive size)
  game.js      8-ball state + rules
  cli.js       interactive loop (live aiming, animation)
bin/cli.js     executable entry point
test/smoke.js  sanity tests
```

---

## License

[MIT](LICENSE)
