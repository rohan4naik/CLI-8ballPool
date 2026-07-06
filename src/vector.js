// Minimal 2D vector helpers for the physics engine.

export const vec = (x = 0, y = 0) => ({ x, y });

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const lenSq = (a) => a.x * a.x + a.y * a.y;
export const len = (a) => Math.hypot(a.x, a.y);

export const normalized = (a) => {
  const n = len(a);
  return n === 0 ? { x: 0, y: 0 } : { x: a.x / n, y: a.y / n };
};

// Unit vector from an angle in degrees (0 = +x, counter-clockwise positive).
export const fromAngle = (deg, mag = 1) => {
  const r = (deg * Math.PI) / 180;
  return { x: Math.cos(r) * mag, y: Math.sin(r) * mag };
};
