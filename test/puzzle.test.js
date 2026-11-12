import test from "node:test";
import assert from "node:assert/strict";
import { countPlacedTiles, createScrambledPuzzle, isPuzzleSolved, swapPuzzleTiles } from "../src/puzzle.js";

test("the nine-piece puzzle starts mixed and keeps every piece", () => {
  for (let i = 0; i < 50; i++) {
    const tiles = createScrambledPuzzle();
    assert.equal(tiles.length, 9);
    assert.deepEqual([...tiles].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.ok(countPlacedTiles(tiles) <= 3);
    assert.equal(isPuzzleSolved(tiles), false);
  }
});

test("swapping two pieces can finish the puzzle", () => {
  const almost = [1, 0, 2, 3, 4, 5, 6, 7, 8];
  assert.equal(isPuzzleSolved(swapPuzzleTiles(almost, 0, 1)), true);
});
