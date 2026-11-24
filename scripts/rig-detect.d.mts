interface Frame {
  m: Uint8Array;
  lum: Uint8Array;
  w: number;
  h: number;
}
export function loadFrames(names: string[], root?: string): Promise<Record<string, Frame>>;
export function rowsExtent(img: Frame, y0: number, y1: number): [number, number] | null;
export function detectHeadNeckX(img: Frame, bbox: readonly number[], donor: string): number;
export function detectTorsoNeck(img: Frame, bbox: readonly number[]): [number, number];
export function detectTorsoHipX(img: Frame, bbox: readonly number[]): number;
