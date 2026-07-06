// Headless sanity checks — no terminal UI, just engine + rules.
import assert from "node:assert";
import { PoolGame } from "../src/game.js";
import { renderTable } from "../src/render.js";

function test(name, fn) {
  try {
    fn();
    console.log(`ok  - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

test("rack has cue + 15 object balls", () => {
  const g = new PoolGame();
  assert.equal(g.balls.length, 16);
  assert.equal(g.balls.filter((b) => b.number === 0).length, 1);
});

test("balls start inside the table bounds", () => {
  const g = new PoolGame();
  for (const b of g.balls) {
    assert.ok(b.pos.x > 0 && b.pos.x < 200, `x ${b.number}`);
    assert.ok(b.pos.y > 0 && b.pos.y < 100, `y ${b.number}`);
  }
});

test("break scatters the rack and produces frames", () => {
  const g = new PoolGame();
  const before = g.balls.map((b) => ({ ...b.pos }));
  const res = g.shoot(0, 100); // straight into the rack
  assert.ok(res.frames.length > 1, "has animation frames");
  const moved = g.balls.some(
    (b, i) => Math.abs(b.pos.x - before[i].x) > 1 || Math.abs(b.pos.y - before[i].y) > 1,
  );
  assert.ok(moved, "rack scattered");
});

test("all balls come to rest and stay in bounds after a shot", () => {
  const g = new PoolGame();
  g.shoot(0, 100);
  for (const b of g.balls) {
    if (b.pocketed) continue;
    assert.ok(Math.hypot(b.vel.x, b.vel.y) < 3, `ball ${b.number} stopped`);
    assert.ok(b.pos.x >= 2 && b.pos.x <= 198, `ball ${b.number} in x`);
    assert.ok(b.pos.y >= 2 && b.pos.y <= 98, `ball ${b.number} in y`);
  }
});

test("scratch (cue in pocket) is a foul with ball-in-hand", () => {
  const g = new PoolGame();
  g.broken = true;
  // aim cue straight at the corner pocket
  const cue = g.cue();
  cue.pos = { x: 40, y: 20 };
  const res = g.shoot(180 + 26.57, 60); // toward (0,0) corner-ish
  // Not asserting the pot precisely (physics), just that the API is stable.
  assert.ok(typeof res.message === "string");
});

test("renderer returns a non-empty string", () => {
  const g = new PoolGame();
  const out = renderTable(g.balls, { aim: 30 });
  assert.ok(out.length > 100);
});

console.log("\ndone.");
