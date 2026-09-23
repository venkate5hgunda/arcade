// Small, shared helpers used by board games. Kept dependency-free so any game
// module can import just what it needs.

// Rotate a player id between 1..count. `startAt` defaults to 1.
export function nextPlayer(current, count = 2, startAt = 1) {
  return ((current - startAt + 1) % count) + startAt;
}

// Check a 1-D win line: all equal and non-empty (not 0, '', null, undefined).
export function lineComplete(cells, ...indices) {
  const first = cells[indices[0]];
  if (!first) return false; // 0, '', null, undefined all falsy
  return indices.every((i) => cells[i] === first);
}

// All winning line index-triples for an n×n board (rows, cols, both diagonals).
export function winLines(n) {
  const lines = [];
  for (let r = 0; r < n; r++) {
    const row = [], col = [];
    for (let c = 0; c < n; c++) { row.push(r * n + c); col.push(c * n + r); }
    lines.push(row, col);
  }
  const d1 = [], d2 = [];
  for (let i = 0; i < n; i++) { d1.push(i * n + i); d2.push(i * n + (n - 1 - i)); }
  lines.push(d1, d2);
  return lines;
}

// Find the first winning line; returns the triple or null.
export function findWin(cells, n) {
  for (const line of winLines(n)) {
    if (lineComplete(cells, ...line)) return line;
  }
  return null;
}

// Draw a board filled with `fill` (default 0 for empty).
export function emptyBoard(n, fill = 0) { return Array.from({ length: n * n }, () => fill); }
