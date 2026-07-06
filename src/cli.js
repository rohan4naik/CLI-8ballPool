// Interactive terminal driver. Aim live with the arrow keys — the guide
// line moves as you turn, so you see the cue path before you shoot.

import readline from "node:readline";
import { PoolGame } from "./game.js";
import { renderTable, COLORS, LEGEND } from "./render.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HOME = "\x1b[H"; // move cursor to top-left
const ERASE_BELOW = "\x1b[0J"; // clear from cursor to end of screen
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";

// Repaint in place: home the cursor, write the frame, then erase anything
// left below. Avoids the scroll-into-scrollback stacking that a full 2J
// clear causes on some terminals (e.g. Apple Terminal).
function paint(text) {
  process.stdout.write(HOME + text + "\n" + ERASE_BELOW);
}

function groupLabel(g) {
  return g === "solid" ? "SOLIDS (1-7)" : g === "stripe" ? "STRIPES (9-15)" : "open";
}

function scoreboard(game, extra = []) {
  const turn = game.current;
  const mark = (i) => (turn === i && !game.gameOver ? "▶ " : "  ");
  const remain = (g) => (g ? game.onTable(g).length : "-");
  const lines = [
    `${mark(0)}P1 ${groupLabel(game.groups[0]).padEnd(14)} left:${remain(game.groups[0])}    ${mark(1)}P2 ${groupLabel(game.groups[1]).padEnd(14)} left:${remain(game.groups[1])}`,
    LEGEND,
  ];
  return lines.concat(extra).join("\n");
}

function draw(game, { aim = null, extra = [] } = {}) {
  paint(scoreboard(game, extra) + "\n" + renderTable(game.balls, { aim }));
}

function drawFrame(game, frame, note) {
  paint(scoreboard(game, [note]) + "\n" + renderTable(frame, {}));
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

// Strip ANSI, hard-cap to the table width so a long message can't wrap and
// change the frame height (which would reintroduce ghost rows).
function clip(s, width = 76) {
  const plain = s.replace(/\x1b\[[0-9;]*m/g, "");
  return plain.length > width ? plain.slice(0, width - 1) + "…" : plain;
}

function aimHelp(angle, power, note) {
  const a = (((angle % 360) + 360) % 360).toFixed(0).padStart(3);
  return [
    `${COLORS.guide}Aim ${arrowFor(angle)} ${a}°  power ${String(Math.round(power)).padStart(3)} [${powerBar(power)}]${COLORS.reset}`,
    `${COLORS.guide}←/→ turn  ,/. fine  ↑/↓ power  Enter shoot  q quit${COLORS.reset}`,
    `${COLORS.guide}${clip(note)}${COLORS.reset}`,
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

  // The frame is ~22 lines tall; a shorter window forces the terminal to
  // scroll and leaves ghost rows. Warn instead of glitching silently.
  if (process.stdout.rows && process.stdout.rows < 22) {
    console.log(
      `Terminal is ${process.stdout.rows} rows tall — please make the window at least 22 rows for a clean board, then restart.`,
    );
  }

  // One full clear + hide cursor; every frame after repaints in place.
  process.stdout.write("\x1b[2J\x1b[3J\x1b[H" + HIDE);

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

  process.stdout.write(SHOW);
  try {
    process.stdin.setRawMode(false);
  } catch {}
  process.stdin.pause();
}
