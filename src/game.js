// 8-ball game state and rules built on top of the physics engine.
// Simplified bar rules: open table after break, group assignment on a
// legal pot, fouls give opponent ball-in-hand (auto-respotted).

import { makeBall, simulate } from "./physics.js";
import {
  TABLE,
  BALL_RADIUS,
  HEAD_SPOT,
  FOOT_SPOT,
  groupOf,
} from "./table.js";
import { fromAngle, len, sub } from "./vector.js";

const MAX_SPEED = 520; // speed at power 100

// Canonical-ish rack: apex = 1, eight in the centre, back corners a
// solid and a stripe.
const RACK_ROWS = [
  [1],
  [9, 2],
  [10, 8, 3],
  [11, 4, 12, 5],
  [6, 13, 7, 14, 15],
];

function buildRack() {
  const balls = [makeBall(0, HEAD_SPOT.x, HEAD_SPOT.y)];
  const dx = BALL_RADIUS * Math.sqrt(3) + 0.05;
  const dy = 2 * BALL_RADIUS + 0.05;
  RACK_ROWS.forEach((row, i) => {
    row.forEach((num, k) => {
      const x = FOOT_SPOT.x + i * dx;
      const y = TABLE.W / 2 + (k - i / 2) * dy;
      balls.push(makeBall(num, x, y));
    });
  });
  return balls;
}

export class PoolGame {
  constructor() {
    this.balls = buildRack();
    this.current = 0; // player index 0 / 1
    this.groups = [null, null]; // 'solid' | 'stripe' per player
    this.broken = false;
    this.gameOver = false;
    this.winner = null;
    this.ballInHand = false;
  }

  cue() {
    return this.balls.find((b) => b.number === 0);
  }

  onTable(group) {
    return this.balls.filter((b) => !b.pocketed && b.group === group);
  }

  groupCleared(group) {
    return group ? this.onTable(group).length === 0 : false;
  }

  currentGroup() {
    return this.groups[this.current];
  }

  // Auto-place the cue ball for break / ball-in-hand at the head spot,
  // nudging along the head string if the spot is occupied.
  respotCue() {
    const cue = this.cue();
    cue.pocketed = false;
    cue.vel = { x: 0, y: 0 };
    let y = HEAD_SPOT.y;
    for (let off = 0; off <= TABLE.W; off += BALL_RADIUS) {
      for (const cand of [HEAD_SPOT.y + off, HEAD_SPOT.y - off]) {
        if (cand < BALL_RADIUS || cand > TABLE.W - BALL_RADIUS) continue;
        const clash = this.balls.some(
          (b) =>
            b.number !== 0 &&
            !b.pocketed &&
            len(sub(b.pos, { x: HEAD_SPOT.x, y: cand })) < 2 * BALL_RADIUS,
        );
        if (!clash) {
          cue.pos = { x: HEAD_SPOT.x, y: cand };
          return;
        }
      }
    }
    cue.pos = { x: HEAD_SPOT.x, y };
  }

  // angle in degrees, power 0-100.
  shoot(angle, power) {
    if (this.gameOver) return { message: "Game already over." };

    const cue = this.cue();
    const speed = (Math.max(0, Math.min(100, power)) / 100) * MAX_SPEED;
    cue.vel = fromAngle(angle, speed);

    const shooter = this.current;
    const wasOpen = this.groups[0] === null && this.groups[1] === null;
    const { events, firstHit, cushionAfterHit, frames } = simulate(this.balls);
    this._lastFrames = frames;

    const potted = events
      .filter((e) => e.type === "pocket")
      .map((e) => e.number);
    const cueScratch = potted.includes(0);
    const eightPotted = potted.includes(8);
    const objectPotted = potted.filter((n) => n !== 0 && n !== 8);

    let foul = false;
    const reasons = [];

    if (cueScratch) {
      foul = true;
      reasons.push("cue ball scratched");
    }
    if (firstHit === null) {
      foul = true;
      reasons.push("no ball contacted");
    } else {
      // must first strike a ball of your group (once assigned)
      const grp = this.groups[shooter];
      if (grp) {
        const legalFirst = this.groupCleared(grp) ? "eight" : grp;
        const hitGroup = groupOf(firstHit);
        if (hitGroup !== legalFirst) {
          foul = true;
          reasons.push(`first hit must be ${legalFirst}`);
        }
      }
    }
    // no rail after contact and nothing potted = table foul
    if (
      !foul &&
      firstHit !== null &&
      !cushionAfterHit &&
      potted.length === 0
    ) {
      foul = true;
      reasons.push("no rail after contact");
    }

    // --- eight ball resolves the game ---
    if (eightPotted) {
      const grp = this.groups[shooter];
      const clearedBefore = grp && this.onTable(grp).length === 0;
      // group considered cleared if, ignoring the 8, shooter's balls gone
      const legalWin = grp && clearedBefore && !cueScratch && !foul;
      this.gameOver = true;
      this.winner = legalWin ? shooter : 1 - shooter;
      return this._summary(shooter, {
        potted,
        foul,
        reasons,
        message: legalWin
          ? `Player ${shooter + 1} sinks the 8 — WINS!`
          : `8 ball down illegally — Player ${this.winner + 1} WINS.`,
      });
    }

    // --- group assignment on an open table ---
    if (wasOpen && this.broken && !foul && objectPotted.length > 0) {
      const groupsPotted = new Set(objectPotted.map(groupOf));
      if (groupsPotted.size === 1) {
        const g = [...groupsPotted][0];
        this.groups[shooter] = g;
        this.groups[1 - shooter] = g === "solid" ? "stripe" : "solid";
      }
    }

    if (!this.broken) this.broken = true;

    // --- turn continuation ---
    const grp = this.groups[shooter];
    const pottedOwn = grp
      ? objectPotted.some((n) => groupOf(n) === grp)
      : objectPotted.length > 0; // open table: any pot keeps the turn
    const keepTurn = !foul && pottedOwn;

    if (cueScratch) {
      this.respotCue();
      this.ballInHand = true;
    } else {
      this.ballInHand = false;
    }

    if (!keepTurn) {
      this.current = 1 - shooter;
      if (foul) this.ballInHand = true; // opponent gets ball in hand
      if (this.ballInHand && !cueScratch) this.respotCue();
    }

    let message;
    if (foul) message = `Foul: ${reasons.join(", ")}. Turn passes.`;
    else if (keepTurn) message = `Nice pot — shoot again.`;
    else if (objectPotted.length) message = `Potted, but turn passes.`;
    else message = `No pot. Turn passes.`;

    return this._summary(shooter, { potted, foul, reasons, message });
  }

  _summary(shooter, extra) {
    return {
      shooter,
      current: this.current,
      groups: this.groups,
      gameOver: this.gameOver,
      winner: this.winner,
      ballInHand: this.ballInHand,
      frames: this._lastFrames,
      ...extra,
    };
  }
}
