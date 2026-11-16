// Pixel-art sprites for the slot machine, drawn as character grids.
// Each character maps to a palette entry in PALETTE_KEYS; "." is transparent.

import type { SlotSymbol } from "./slots";

export const SPRITE_SIZE = 14;

/** Base colours. Index in this list is the palette index. */
export const BASE_PALETTE: Array<[number, number, number]> = [
  [24, 16, 32], //  0 cabinet background
  [246, 240, 226], //  1 reel background
  [20, 20, 24], //  2 outline
  [220, 40, 48], //  3 red
  [140, 16, 32], //  4 dark red
  [80, 180, 60], //  5 green
  [36, 110, 40], //  6 dark green
  [252, 220, 60], //  7 yellow
  [200, 150, 20], //  8 dark yellow
  [110, 220, 240], //  9 cyan
  [40, 120, 200], // 10 blue
  [255, 255, 255], // 11 white
  [150, 150, 160], // 12 grey
  [120, 80, 40], // 13 brown
  [255, 196, 40], // 14 gold
  [110, 30, 140], // 15 purple (cabinet trim)
  [70, 50, 90], // 16 reel separator
];

export const COLOR = {
  bg: 0,
  reel: 1,
  outline: 2,
  red: 3,
  darkRed: 4,
  gold: 14,
  trim: 15,
  separator: 16,
} as const;

const KEYS: Record<string, number> = {
  k: 2,
  r: 3,
  R: 4,
  g: 5,
  G: 6,
  y: 7,
  Y: 8,
  c: 9,
  b: 10,
  w: 11,
  s: 12,
  n: 13,
};

const SPRITES: Record<SlotSymbol, string[]> = {
  cherry: [
    "..........GG..",
    ".........GgG..",
    "........G..G..",
    ".......G...G..",
    "......G.....G.",
    ".....G......G.",
    "...kkGk...kkGk",
    "..krrrrk.krrrk",
    ".krwrrrRkrwrrk",
    ".krwrrrRkrwrRk",
    ".krrrrrRkrrrRk",
    ".kRrrrRRkRrRRk",
    "..kRRRRk.kRRk.",
    "...kkkk...kk..",
  ],
  lemon: [
    "..............",
    "........GG....",
    ".......GgG....",
    "....kkkkkk....",
    "..kkyyyyyykk..",
    ".kyywwyyyyyYk.",
    "kyywyyyyyyyyYk",
    "kyyyyyyyyyyyYk",
    "kyyyyyyyyyyYYk",
    ".kyyyyyyyyYYk.",
    "..kkYYYYYYkk..",
    "....kkkkkk....",
    "..............",
    "..............",
  ],
  corn: [
    "......kk......",
    ".....kyyk.....",
    "....kywyyk....",
    "....kyyyYk....",
    "...kywyyyYk...",
    "...kyyyyYYk...",
    "..GkywyyyYkG..",
    "..GkyyyyYYkG..",
    ".GgGkyyyYkGgG.",
    ".GggGkyYkGggG.",
    "..GggGkkGggG..",
    "...GggGGggG...",
    "....GGggGG....",
    "......GG......",
  ],
  bell: [
    "......kk......",
    ".....kYYk.....",
    "....kyyyyk....",
    "...kywyyyYk...",
    "...kywyyyYk...",
    "..kywyyyyyYk..",
    "..kywyyyyyYk..",
    "..kyyyyyyyYk..",
    ".kyyyyyyyyyYk.",
    "kyyyyyyyyyyyYk",
    "kYYYYYYYYYYYYk",
    ".kkkkkkkkkkkk.",
    ".....kYYk.....",
    "......kk......",
  ],
  diamond: [
    "..............",
    "...kkkkkkkk...",
    "..kcwccccbbk..",
    ".kcwccccccbbk.",
    "kkkkkkkkkkkkkk",
    ".kcwcccccccbk.",
    "..kcwccccccbk.",
    "...kcwcccccbk.",
    "....kcwcccbk..",
    ".....kcccbk...",
    "......kcbk....",
    ".......kk.....",
    "..............",
    "..............",
  ],
  seven: [
    "..............",
    ".kkkkkkkkkkkk.",
    ".krrrrrrrrrrk.",
    ".krwwwwwwwrRk.",
    ".kkkkkkkkrrRk.",
    ".......krrRk..",
    "......krrRk...",
    ".....krwRk....",
    "....krwRk.....",
    "....krwRk.....",
    "...krwRk......",
    "...krwRk......",
    "...kRRRk......",
    "...kkkkk......",
  ],
};

/** Sprite as a flat array of palette indices, -1 for transparent. */
export const SPRITE_PIXELS: Record<SlotSymbol, Int16Array> = Object.fromEntries(
  Object.entries(SPRITES).map(([symbol, rows]) => {
    const pixels = new Int16Array(SPRITE_SIZE * SPRITE_SIZE).fill(-1);
    rows.forEach((row, y) => {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const index = KEYS[row[x] ?? "."];
        if (index !== undefined) {
          pixels[y * SPRITE_SIZE + x] = index;
        }
      }
    });
    return [symbol, pixels];
  }),
) as Record<SlotSymbol, Int16Array>;
