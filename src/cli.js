// Interactive terminal driver. Aim live with the arrow keys — the guide
// line moves as you turn, so you see the cue path before you shoot.

import readline from "node:readline";
import { PoolGame } from "./game.js";
import { renderTable, setSize, getSize, COLORS, LEGEND } from "./render.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HOME = "\x1b[H"; // move cursor to top-left
const ERASE_BELOW = "\x1b[0J"; // clear from cursor to end of screen
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";
const ALT_ON = "\x1b[?1049h"; // enter alternate screen (no scrollback)
const ALT_OFF = "\x1b[?1049l"; // leave it, restoring the shell

// Lines used above/around the table on the tallest (aim) frame:
//   2 scoreboard + 3 aim bar + 2 table rails = 7. One extra for safety.
const CHROME_LINES = 8;

// Grow the table to fill the current window while keeping a ~2:1 table shape
// (character cells are about twice as tall as wide, so cols ≈ 4 × rows).
// rows is hard-capped to what fits so a frame can never exceed the window
// height (which would scroll and misalign — the "ghost" rows).
function fitTable() {
  const termCols = process.stdout.columns || 80;
  const termRows = process.stdout.rows || 24;
  const availCols = Math.max(20, termCols - 2); // side rails
  const availRows = Math.max(4, termRows - CHROME_LINES);
  let rows = Math.min(availRows, Math.floor(availCols / 4));
  rows = Math.min(Math.max(rows, 7), availRows); // playable, but never overflow
  const cols = Math.min(availCols, rows * 4);
  setSize(cols, rows);
}

// Repaint in place: home the cursor, write the frame, then erase anything
// left below. Avoids the scroll-into-scrollback stacking that a full 2J
// clear causes on some terminals (e.g. Apple Terminal).
function paint(text) {
  // No trailing newline: leaving the cursor on the last written line avoids a
  // one-line scroll. ERASE_BELOW wipes anything the previous (taller) frame
  // left underneath.
  process.stdout.write(HOME + text + ERASE_BELOW);
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
function clip(s) {
  const width = getSize().COLS;
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

// Redraws the current aim frame; the resize handler calls this after
// recomputing the table size.
let repaintCurrent = () => {};

// Resolve to {angle, power} when the player shoots, or null if they quit.
function aimPhase(game, state, note) {
  return new Promise((resolve) => {
    const redraw = () =>
      draw(game, { aim: state.angle, extra: aimHelp(state.angle, state.power, note) });
    repaintCurrent = redraw;

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

  const rows0 = process.stdout.rows || 24;
  const cols0 = process.stdout.columns || 80;
  if (rows0 < 12 || cols0 < 40) {
    console.log(
      `Terminal is ${cols0}×${rows0}. Please enlarge the window to at least 40×12 and run again.`,
    );
    return;
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  // Enter the alternate screen: a separate, non-scrolling buffer. Nothing we
  // print can spill into the shell's scrollback, so ghost frames are
  // impossible even if the board is taller than the window.
  process.stdout.write(ALT_ON + HIDE + HOME);

  let torn = false;
  const teardown = () => {
    if (torn) return;
    torn = true;
    process.stdout.write(SHOW + ALT_OFF);
    try {
      process.stdin.setRawMode(false);
    } catch {}
    process.stdin.pause();
  };
  process.on("exit", teardown);
  process.on("SIGINT", () => {
    teardown();
    process.exit(0);
  });

  // Size the table to the window now and whenever it is resized.
  fitTable();
  process.stdout.on("resize", () => {
    fitTable();
    repaintCurrent();
  });

  const state = { angle: 0, power: 60 }; // aim toward the rack to start
  let note = `${COLORS.guide}Break! Turn toward the rack and hit hard.${COLORS.reset}`;

  while (!game.gameOver) {
    const shot = await aimPhase(game, state, note);
    if (!shot) break;

    const res = game.shoot(shot.angle, shot.power);
    await playShot(game, res.frames);
    note = res.message;
  }

  // Back to the normal screen, then print the final board + result there so
  // it stays visible after the game closes.
  teardown();
  console.log(scoreboard(game) + "\n" + renderTable(game.balls, {}));
  if (game.gameOver) {
    console.log(`\n${COLORS.solid}=== Player ${game.winner + 1} wins! ===${COLORS.reset}\n`);
  } else {
    console.log("\nThanks for playing.\n");
  }
}
