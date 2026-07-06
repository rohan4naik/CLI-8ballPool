// Rigid-body pool physics: rolling friction, elastic ball collisions,
// cushion bounces, and pocket capture. Deterministic, fixed sub-steps.

import { add, sub, scale, dot, len, lenSq, normalized } from "./vector.js";
import { TABLE, BALL_RADIUS, POCKETS, POCKET_RADIUS, groupOf } from "./table.js";

const R = BALL_RADIUS;
const RESTITUTION = 0.96; // energy kept on cushion bounces
const FRICTION = 42; // linear deceleration (units / s^2)
const STOP_SPEED = 2.5; // below this a ball is treated as stopped
const DT = 1 / 240; // physics sub-step
const MAX_STEPS = 240 * 30; // 30 s safety cap per shot

export function makeBall(number, x, y) {
  return {
    number,
    group: groupOf(number),
    pos: { x, y },
    vel: { x: 0, y: 0 },
    pocketed: false,
  };
}

const moving = (b) => !b.pocketed && lenSq(b.vel) > 1e-6;

// Advance the whole table until every ball has come to rest.
// Returns an ordered event log the game layer uses for rules.
const RECORD_EVERY = 8; // snapshot cadence for playback (~30 fps)

const snapshot = (balls) =>
  balls.map((b) => ({
    number: b.number,
    group: b.group,
    pos: { x: b.pos.x, y: b.pos.y },
    pocketed: b.pocketed,
  }));

export function simulate(balls) {
  const events = [];
  const frames = [];
  let firstHit = null; // number of first object ball the cue struck
  let cushionAfterHit = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    let anyMoving = false;

    for (const b of balls) {
      if (!moving(b)) continue;
      anyMoving = true;

      // integrate position
      b.pos = add(b.pos, scale(b.vel, DT));

      // rolling friction
      const speed = len(b.vel);
      const newSpeed = speed - FRICTION * DT;
      if (newSpeed <= STOP_SPEED) {
        b.vel = { x: 0, y: 0 };
      } else {
        b.vel = scale(b.vel, newSpeed / speed);
      }
    }

    // cushions
    for (const b of balls) {
      if (b.pocketed) continue;
      let bounced = false;
      if (b.pos.x < R) {
        b.pos.x = R;
        b.vel.x = -b.vel.x * RESTITUTION;
        bounced = true;
      } else if (b.pos.x > TABLE.L - R) {
        b.pos.x = TABLE.L - R;
        b.vel.x = -b.vel.x * RESTITUTION;
        bounced = true;
      }
      if (b.pos.y < R) {
        b.pos.y = R;
        b.vel.y = -b.vel.y * RESTITUTION;
        bounced = true;
      } else if (b.pos.y > TABLE.W - R) {
        b.pos.y = TABLE.W - R;
        b.vel.y = -b.vel.y * RESTITUTION;
        bounced = true;
      }
      if (bounced && firstHit !== null) cushionAfterHit = true;
    }

    // ball-ball collisions
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j];
        if (c.pocketed) continue;

        const d = sub(c.pos, a.pos);
        const dist = len(d);
        if (dist === 0 || dist >= 2 * R) continue;

        const n = normalized(d);

        // positional de-overlap, split evenly
        const overlap = 2 * R - dist;
        a.pos = sub(a.pos, scale(n, overlap / 2));
        c.pos = add(c.pos, scale(n, overlap / 2));

        // exchange normal velocity components (equal mass, elastic)
        const va = dot(a.vel, n);
        const vc = dot(c.vel, n);
        const diff = va - vc;
        if (diff > 0) {
          a.vel = sub(a.vel, scale(n, diff));
          c.vel = add(c.vel, scale(n, diff));

          // record first contact made by the cue ball
          if (firstHit === null && (a.number === 0 || c.number === 0)) {
            firstHit = a.number === 0 ? c.number : a.number;
            cushionAfterHit = false;
          }
        }
      }
    }

    // pockets
    for (const b of balls) {
      if (b.pocketed) continue;
      for (const p of POCKETS) {
        if (len(sub(b.pos, p)) <= POCKET_RADIUS) {
          b.pocketed = true;
          b.vel = { x: 0, y: 0 };
          events.push({ type: "pocket", number: b.number });
          break;
        }
      }
    }

    if (step % RECORD_EVERY === 0) frames.push(snapshot(balls));
    if (!anyMoving) break;
  }

  frames.push(snapshot(balls));
  return { events, firstHit, cushionAfterHit, frames };
}
