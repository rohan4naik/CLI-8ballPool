// Interactive terminal driver. Aim live with the arrow keys — the guide
// line moves as you turn, so you see the cue path before you shoot.

import readline from "node:readline";
import { PoolGame } from "./game.js";
import { renderTable, COLORS, LEGEND } from "./render.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CLEAR = "\x1b[2J\x1b[H";

function groupLabel(g) {
  return g === "solid" ? "SOLIDS (1-7)" : g === "stripe" ? "STRIPES (9-15)" : "open";
}

function scoreboard(game, extra = []) {
  const turn = game.current;
  const mark = (i) => (turn === i && !game.gameOver ? "▶ " : "  ");
  const remain = (g) => (g ? game.onTable(g).length : "-");
  const lines = [
    `${COLORS.solid}8-BALL POOL${COLORS.reset}`,
    `${mark(0)}Player 1  ${groupLabel(game.groups[0]).padEnd(14)} left:${remain(game.groups[0])}`,
    `${mark(1)}Player 2  ${groupLabel(game.groups[1]).padEnd(14)} left:${remain(game.groups[1])}`,
    LEGEND,
  ];
  return lines.concat(extra).join("\n");
}

function draw(game, { aim = null, extra = [] } = {}) {
  process.stdout.write(CLEAR);
  console.log(scoreboard(game, extra));
  console.log(renderTable(game.balls, { aim }));
}

function drawFrame(game, frame, note) {
  process.stdout.write(CLEAR);
  console.log(scoreboard(game, [note]));
  console.log(renderTable(frame, {}));
}

async function playShot(game, frames) {
  for (const f of frames) {
    drawFrame(game, f, `${COLORS.guide}...balls rolling...${COLORS.reset}`);
    await sleep(45);
  }
}

// Compass arrow for the current heading (table space: 0=right, 90=down).
function arrowFor(deg) {
  const a = ((deg % 360) + 360) % 360;
  const dirs = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
  return dirs[Math.round(a / 45) % 8];
}

function powerBar(p) {
  const n = Math.round(p / 5);
  return "█".repeat(n) + "░".repeat(20 - n);
}

function aimHelp(angle, power, note) {
  const a = (((angle % 360) + 360) % 360).toFixed(0).padStart(3);
  return [
    `${COLORS.guide}Aim ${arrowFor(angle)}  angle ${a}°   power ${String(Math.round(power)).padStart(3)} [${powerBar(power)}]${COLORS.reset}`,
    `${COLORS.guide}←/→ turn   ,/. fine   ↑/↓ power   Enter = shoot   q = quit${COLORS.reset}`,
    note,
  ];
}

// Resolve to {angle, power} when the player shoots, or null if they quit.
function aimPhase(game, state, note) {
  return new Promise((resolve) => {
    const redraw = () =>
      draw(game, { aim: state.angle, extra: aimHelp(state.angle, state.power, note) });

    const onKey = (_str, key) => {
      if (!key) return;
      if (key.name === "q" || (key.ctrl && key.name === "c")) return finish(null);
      switch (key.name) {
        case "left": state.angle -= 3; break;
        case "right": state.angle += 3; break;
        case "comma": state.angle -= 0.5; break;
        case "period": state.angle += 0.5; break;
        case "up": state.power = Math.min(100, state.power + 4); break;
        case "down": state.power = Math.max(5, state.power - 4); break;
        case "return":
        case "enter": return finish({ angle: state.angle, power: state.power });
        default: return;
      }
      redraw();
    };

    const finish = (val) => {
      process.stdin.removeListener("keypress", onKey);
      resolve(val);
    };

    process.stdin.on("keypress", onKey);
    redraw();
  });
}

export async function run() {
  const game = new PoolGame();

  if (!process.stdin.isTTY) {
    console.log("8ball-pool needs an interactive terminal. Run it directly in your shell.");
    return;
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  const state = { angle: 0, power: 60 }; // aim toward the rack to start
  let note = `${COLORS.guide}Break! Turn toward the rack and hit hard.${COLORS.reset}`;

  while (!game.gameOver) {
    const shot = await aimPhase(game, state, note);
    if (!shot) break;

    const res = game.shoot(shot.angle, shot.power);
    await playShot(game, res.frames);
    note = res.message;
  }

  draw(game, { extra: [note] });
  if (game.gameOver) {
    console.log(`\n${COLORS.solid}=== Player ${game.winner + 1} wins! ===${COLORS.reset}\n`);
  } else {
    console.log("\nThanks for playing.\n");
  }

  try {
    process.stdin.setRawMode(false);
  } catch {}
  process.stdin.pause();
}
