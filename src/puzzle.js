export const PUZZLE_SIZE = 9;

export function isPuzzleSolved(tiles) {
  return tiles.length === PUZZLE_SIZE && tiles.every((tile, index) => tile === index);
}

export function countPlacedTiles(tiles) {
  return tiles.reduce((count, tile, index) => count + Number(tile === index), 0);
}

export function swapPuzzleTiles(tiles, first, second) {
  const next = [...tiles];
  [next[first], next[second]] = [next[second], next[first]];
  return next;
}

export function createScrambledPuzzle(random = Math.random) {
  for (let attempt = 0; attempt < 40; attempt++) {
    let tiles = Array.from({ length: PUZZLE_SIZE }, (_, index) => index);
    let previousPair = "";
    for (let turn = 0; turn < 6; turn++) {
      const first = Math.floor(random() * PUZZLE_SIZE);
      let second = Math.floor(random() * (PUZZLE_SIZE - 1));
      if (second >= first) second++;
      const pair = [first, second].sort((a, b) => a - b).join("-");
      if (pair === previousPair) continue;
      tiles = swapPuzzleTiles(tiles, first, second);
      previousPair = pair;
    }
    if (countPlacedTiles(tiles) <= 3) return tiles;
  }
  return [4, 7, 2, 8, 0, 6, 3, 1, 5];
}
