// Table geometry: play-surface dimensions, pocket layout, ball metrics.
// Units are abstract "table units"; the renderer maps them to characters.

export const TABLE = {
  L: 200, // length  (long rails run along x)
  W: 100, // width   (short rails run along y)
};

export const BALL_RADIUS = 2.7;

// Pocket capture radius — a ball whose centre falls inside this of a pocket
// mouth drops. Slightly larger than a ball so near-misses rattle out.
export const POCKET_RADIUS = 5.0;

// Six pockets: four corners + two side pockets on the long rails.
export const POCKETS = [
  { x: 0, y: 0 },
  { x: TABLE.L / 2, y: 0 },
  { x: TABLE.L, y: 0 },
  { x: 0, y: TABLE.W },
  { x: TABLE.L / 2, y: TABLE.W },
  { x: TABLE.L, y: TABLE.W },
];

export const HEAD_SPOT = { x: TABLE.L * 0.25, y: TABLE.W / 2 };
export const FOOT_SPOT = { x: TABLE.L * 0.75, y: TABLE.W / 2 };

// Ball groups. 0 = cue, 1-7 = solids, 8 = eight ball, 9-15 = stripes.
export const groupOf = (n) => {
  if (n === 0) return "cue";
  if (n === 8) return "eight";
  return n < 8 ? "solid" : "stripe";
};
