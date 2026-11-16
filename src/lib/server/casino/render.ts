// Renders a slot machine spin as an animated GIF.
// Everything is drawn into an indexed framebuffer, so there are no native
// dependencies: gifenc only has to LZW-encode the frames.

import * as gifenc from "gifenc";
import { randomSymbol, type SlotSymbol, type SpinOutcome } from "./slots";
import {
  BASE_PALETTE,
  COLOR,
  SPRITE_PIXELS,
  SPRITE_SIZE,
} from "./sprites";

// gifenc ships CommonJS only. Bundlers expose its functions as named
// exports; Node's own ESM loader only puts them on the default export.
const GIFEncoder =
  gifenc.GIFEncoder ??
  (gifenc as unknown as { default: typeof gifenc }).default.GIFEncoder;

const SCALE = 4;
const CELL = 64;
const SPRITE_OFFSET = (CELL - SPRITE_SIZE * SCALE) / 2;
const REEL_WIDTH = 72;
const REEL_GAP = 8;
const MARGIN = 16;
const ROWS = 3;
const REELS = 3;

const WIDTH = MARGIN * 2 + REEL_WIDTH * REELS + REEL_GAP * (REELS - 1);
const HEIGHT = MARGIN * 2 + CELL * ROWS;
const WINDOW_TOP = MARGIN;
const LINE_TOP = WINDOW_TOP + CELL;
const LINE_BOTTOM = LINE_TOP + CELL;

/** Frame on which each reel comes to rest. */
const STOP_FRAMES = [18, 26, 34];
/** How many cells each reel scrolls past before stopping. */
const SCROLL_CELLS = [14, 20, 26];
const SPIN_DELAY_MS = 40;
const FLASH_FRAMES = 8;
const FLASH_DELAY_MS = 150;
const HOLD_DELAY_MS = 8000;

/** How long the reels spin before the result is visible. */
export const SPIN_DURATION_MS =
  STOP_FRAMES[STOP_FRAMES.length - 1] * SPIN_DELAY_MS;

// Second half of the palette is a dimmed copy, used outside the payline.
const DIM = BASE_PALETTE.length;
const PALETTE: number[][] = [
  ...BASE_PALETTE,
  ...BASE_PALETTE.map(([r, g, b]) => [r * 0.55, g * 0.55, b * 0.55].map(Math.round)),
];
while (PALETTE.length < 64) {
  PALETTE.push([0, 0, 0]);
}

const reelLeft = (reel: number) => MARGIN + reel * (REEL_WIDTH + REEL_GAP);

const fillRect = (
  frame: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
) => {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(WIDTH, x + w);
  const y1 = Math.min(HEIGHT, y + h);
  for (let py = y0; py < y1; py++) {
    frame.fill(color, py * WIDTH + x0, py * WIDTH + x1);
  }
};

/** Draws a sprite with its top-left at (x, y), clipped to [clipTop, clipBottom). */
const drawSprite = (
  frame: Uint8Array,
  symbol: SlotSymbol,
  x: number,
  y: number,
  clipTop: number,
  clipBottom: number,
) => {
  const pixels = SPRITE_PIXELS[symbol];
  for (let sy = 0; sy < SPRITE_SIZE; sy++) {
    for (let sx = 0; sx < SPRITE_SIZE; sx++) {
      const color = pixels[sy * SPRITE_SIZE + sx];
      if (color < 0) continue;
      const top = Math.max(clipTop, y + sy * SCALE);
      const bottom = Math.min(clipBottom, y + (sy + 1) * SCALE);
      for (let py = top; py < bottom; py++) {
        const row = py * WIDTH + x + sx * SCALE;
        frame.fill(color, row, row + SCALE);
      }
    }
  }
};

const drawCabinet = (frame: Uint8Array) => {
  frame.fill(COLOR.bg);
  fillRect(frame, 4, 4, WIDTH - 8, HEIGHT - 8, COLOR.trim);
  fillRect(frame, 8, 8, WIDTH - 16, HEIGHT - 16, COLOR.bg);
  // Payline arrows on both sides.
  const mid = LINE_TOP + CELL / 2;
  for (let i = 0; i < 6; i++) {
    fillRect(frame, 8 + i, mid - 6 + i, 1, 12 - i * 2, COLOR.red);
    fillRect(frame, WIDTH - 9 - i, mid - 6 + i, 1, 12 - i * 2, COLOR.red);
  }
};

/**
 * Draws one reel. `strip[0..2]` are the final top, payline and bottom
 * symbols; `offset` is how many cells the reel still has to scroll.
 */
const drawReel = (
  frame: Uint8Array,
  reel: number,
  strip: SlotSymbol[],
  offset: number,
) => {
  const left = reelLeft(reel);
  const windowBottom = WINDOW_TOP + CELL * ROWS;
  fillRect(frame, left, WINDOW_TOP, REEL_WIDTH, CELL * ROWS, COLOR.reel);
  const first = Math.floor(offset) - 1;
  for (let j = Math.max(0, first); j <= first + ROWS + 1 && j < strip.length; j++) {
    // Higher strip indices sit above, so the reel appears to roll downward.
    const y = WINDOW_TOP + Math.round((ROWS - 1 - j + offset) * CELL);
    drawSprite(
      frame,
      strip[j],
      left + (REEL_WIDTH - SPRITE_SIZE * SCALE) / 2,
      y + SPRITE_OFFSET,
      WINDOW_TOP,
      windowBottom,
    );
  }
};

/** Dims everything inside the reel windows that is not on the payline. */
const dimOffLine = (frame: Uint8Array) => {
  for (let reel = 0; reel < REELS; reel++) {
    const left = reelLeft(reel);
    for (let y = WINDOW_TOP; y < WINDOW_TOP + CELL * ROWS; y++) {
      if (y >= LINE_TOP && y < LINE_BOTTOM) continue;
      for (let x = left; x < left + REEL_WIDTH; x++) {
        frame[y * WIDTH + x] += DIM;
      }
    }
  }
};

const drawPaylineBox = (frame: Uint8Array, color: number) => {
  const x = MARGIN - 4;
  const w = WIDTH - 2 * (MARGIN - 4);
  const y = LINE_TOP - 3;
  const h = CELL + 6;
  fillRect(frame, x, y, w, 3, color);
  fillRect(frame, x, y + h - 3, w, 3, color);
  fillRect(frame, x, y, 3, h, color);
  fillRect(frame, x + w - 3, y, 3, h, color);
};

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export const renderSpinGif = (
  outcome: SpinOutcome,
  rng: () => number = Math.random,
): Uint8Array => {
  const strips = outcome.line.map((symbol, reel) => {
    const strip: SlotSymbol[] = [randomSymbol(rng), symbol, randomSymbol(rng)];
    while (strip.length < SCROLL_CELLS[reel] + ROWS + 2) {
      strip.push(randomSymbol(rng));
    }
    return strip;
  });

  const gif = GIFEncoder();
  const frame = new Uint8Array(WIDTH * HEIGHT);
  let first = true;
  const write = (delay: number) => {
    gif.writeFrame(frame, WIDTH, HEIGHT, {
      palette: first ? PALETTE : undefined,
      first,
      delay,
      repeat: -1, // play once and stay on the result
    });
    first = false;
  };

  const drawState = (frameIndex: number) => {
    drawCabinet(frame);
    for (let reel = 0; reel < REELS; reel++) {
      const t = Math.min(frameIndex / STOP_FRAMES[reel], 1);
      drawReel(frame, reel, strips[reel], SCROLL_CELLS[reel] * (1 - easeOut(t)));
    }
    dimOffLine(frame);
  };

  const lastSpinFrame = STOP_FRAMES[STOP_FRAMES.length - 1];
  for (let f = 0; f < lastSpinFrame; f++) {
    drawState(f);
    write(SPIN_DELAY_MS);
  }

  if (outcome.multiplier > 0) {
    for (let f = 0; f < FLASH_FRAMES; f++) {
      drawState(lastSpinFrame);
      drawPaylineBox(frame, f % 2 === 0 ? COLOR.gold : COLOR.red);
      write(FLASH_DELAY_MS);
    }
  }
  drawState(lastSpinFrame);
  if (outcome.multiplier > 0) {
    drawPaylineBox(frame, COLOR.gold);
  }
  write(HOLD_DELAY_MS);

  gif.finish();
  return gif.bytes();
};
