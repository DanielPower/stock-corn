declare module "gifenc" {
  type Palette = number[][];
  type Encoder = {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: Palette;
        first?: boolean;
        transparent?: boolean;
        transparentIndex?: number;
        delay?: number;
        repeat?: number;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  };
  export function GIFEncoder(options?: {
    auto?: boolean;
    initialCapacity?: number;
  }): Encoder;
}
