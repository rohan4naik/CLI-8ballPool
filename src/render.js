// Terminal renderer. Maps table units to a character grid, paints a green
// felt background with ANSI colour, and stamps balls, pockets and an
// optional aim guide line.

import { TABLE, POCKETS, BALL_RADIUS } from "./table.js";
import { add, scale, fromAngle } from "./vector.js";

const COLS = 76;
const ROWS = 19;

// Plain foreground colours — used for text (scoreboard, guide).
const C = {
  reset: "\x1b[0m",
  felt: "\x1b[48;5;22m", // dark-green felt background
  rail: "\x1b[48;5;94m\x1b[38;5;179m", // wooden rail
  cue: "\x1b[1m\x1b[97m",
  solid: "\x1b[1m\x1b[93m",
  stripe: "\x1b[1m\x1b[96m",
  eight: "\x1b[1m\x1b[95m",
  pocket: "\x1b[38;5;16m",
  guide: "\x1b[38;5;250m",
};

// Balls are drawn as filled discs (background = group colour) so the group
// reads at a glance: orange = solids, bright cyan = stripes, magenta = 8,
// white = cue.
const BLACK = "\x1b[38;5;16m";
const BALL = {
  cue: `\x1b[1m${BLACK}\x1b[48;5;255m`, // white disc
  solid: `\x1b[1m${BLACK}\x1b[48;5;208m`, // orange/gold disc
  stripe: `\x1b[1m${BLACK}\x1b[48;5;51m`, // bright-cyan disc
  eight: `\x1b[1m\x1b[38;5;231m\x1b[48;5;90m`, // dark-magenta disc, white text
};

const colorFor = (b) => BALL[b.group];

const toCol = (x) => Math.round((x / TABLE.L) * (COLS - 1));
const toRow = (y) => Math.round((y / TABLE.W) * (ROWS - 1));

function blankGrid() {
  const ch = Array.from({ length: ROWS }, () => Array(COLS).fill(" "));
  const col = Array.from({ length: ROWS }, () => Array(COLS).fill(C.felt));
  return { ch, col };
}

function stamp(grid, row, col, text, color) {
  for (let i = 0; i < text.length; i++) {
    const c = col + i;
    if (row < 0 || row >= ROWS || c < 0 || c >= COLS) continue;
    grid.ch[row][c] = text[i];
    grid.col[row][c] = color;
  }
}

// Cast the aim guide from the cue ball until it nears a cushion or a ball.
function drawGuide(grid, cue, angleDeg, balls) {
  const dir = fromAngle(angleDeg, 1);
  const stepLen = BALL_RADIUS * 0.9;
  let p = { ...cue.pos };
  for (let i = 0; i < 120; i++) {
    p = add(p, scale(dir, stepLen));
    if (p.x < 0 || p.x > TABLE.L || p.y < 0 || p.y > TABLE.W) break;
    let blocked = false;
    for (const b of balls) {
      if (b.pocketed || b.number === 0) continue;
      const dx = b.pos.x - p.x;
      const dy = b.pos.y - p.y;
      if (dx * dx + dy * dy < (BALL_RADIUS * 1.6) ** 2) {
        blocked = true;
        break;
      }
    }
    if (blocked) break;
    const r = toRow(p.y);
    const c = toCol(p.x);
    if (grid.ch[r]?.[c] === " ") stamp(grid, r, c, "·", C.guide);
  }
}

export function renderTable(balls, { aim = null } = {}) {
  const grid = blankGrid();

  if (aim) {
    const cue = balls.find((b) => b.number === 0 && !b.pocketed);
    if (cue) drawGuide(grid, cue, aim, balls);
  }

  // Dark ring pockets — distinct from the white cue disc.
  for (const p of POCKETS) {
    let c = toCol(p.x);
    if (c > COLS - 1) c = COLS - 1;
    stamp(grid, toRow(p.y), c, "◯", "\x1b[1m\x1b[38;5;235m");
  }

  for (const b of balls) {
    if (b.pocketed) continue;
    const label = String(b.number);
    let c = toCol(b.pos.x);
    if (label.length === 2 && c > COLS - 2) c = COLS - 2;
    stamp(grid, toRow(b.pos.y), c, label, colorFor(b));
  }

  const railH = C.rail + "+" + "-".repeat(COLS) + "+" + C.reset;
  const lines = [railH];
  for (let r = 0; r < ROWS; r++) {
    let line = C.rail + "|" + C.reset;
    let cur = null;
    for (let c = 0; c < COLS; c++) {
      const color = grid.col[r][c];
      if (color !== cur) {
        line += color;
        cur = color;
      }
      line += grid.ch[r][c];
    }
    line += C.reset + C.rail + "|" + C.reset;
    lines.push(line);
  }
  lines.push(railH);
  return lines.join("\n");
}

export const COLORS = C;

// Swatch legend for the scoreboard, using the real ball styles.
export const LEGEND =
  `${BALL.solid} 1 ${C.reset} solids   ` +
  `${BALL.stripe} 9 ${C.reset} stripes   ` +
  `${BALL.eight} 8 ${C.reset} eight   ` +
  `${BALL.cue} O ${C.reset} cue`;
