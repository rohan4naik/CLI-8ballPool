# 8ball-pool

Play **8-ball pool in your terminal** — real ball physics, an aim guide, and
full bar rules. Zero dependencies, pure Node.js.

```
npx 8ball-pool
```

or install it:

```bash
npm install -g 8ball-pool
8ball-pool     # or: 8ball
```

## How to play

Two players share one terminal, hot-seat style. Aim live with the keyboard —
the grey dotted **guide line** moves as you turn, so you see the cue path
before you shoot.

| Key | Action |
|-----|--------|
| `←` / `→` | turn the cue (3°) |
| `,` / `.` | fine turn (0.5°) |
| `↑` / `↓` | more / less power |
| `Enter` | shoot |
| `q` | quit |

The scoreboard shows whose turn it is, each player's group, current angle and
a power bar.

### Rules (simplified 8-ball)

- **Break**, then the table is *open* — no groups assigned yet.
- Legally pot a ball and you claim that group (**solids 1-7** or
  **stripes 9-15**); your opponent gets the other.
- Pot one of **your** balls on a legal shot and you shoot again.
- **Fouls** (scratch the cue, hit nothing, hit the wrong group first, or no
  rail after contact) pass the turn and give your opponent *ball in hand*
  (the cue is respotted for them).
- Clear your group, then sink the **8 ball** to win. Sink the 8 early — or
  scratch while sinking it — and you lose.

## The physics

A fixed-timestep engine (`src/physics.js`) integrates rolling friction,
resolves elastic equal-mass ball collisions along the line of centres,
bounces balls off cushions with restitution, and drops them into pockets by
capture radius. Every shot is recorded as animation frames the CLI replays.

## Development

```bash
npm start      # run the game
npm test       # headless engine + rules checks
```

```
src/
  vector.js    2D vector math
  table.js     geometry, pockets, ball groups
  physics.js   simulation loop
  render.js    ANSI terminal renderer
  game.js      8-ball state + rules
  cli.js       interactive loop
bin/cli.js     executable entry point
```

## License

MIT
