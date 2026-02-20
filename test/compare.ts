/**
 * Pixel comparison utility for PNG images.
 *
 * Decodes two PNG buffers using skia-canvas, compares pixel-by-pixel,
 * and returns a similarity score along with detailed difference metrics.
 */

import { loadImage, Canvas } from "skia-canvas";

export interface ComparisonResult {
  /** 0-1, where 1 = identical */
  similarity: number;
  /** Max per-pixel difference across any channel (0-255) */
  maxDelta: number;
  /** Number of pixels differing by more than the threshold */
  diffPixelCount: number;
  /** Total number of pixels compared */
  totalPixels: number;
  /** Mean absolute error across all channels, normalized to 0-1 */
  meanAbsoluteError: number;
}

/** Default per-channel threshold to consider a pixel "different" */
const DEFAULT_THRESHOLD = 2;

/**
 * Decode a PNG buffer into raw RGBA pixel data using skia-canvas.
 * Returns { width, height, data } where data is a Uint8ClampedArray of RGBA values.
 */
async function decodePng(buffer: Buffer): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const img = await loadImage(buffer);
  const canvas = new Canvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  return {
    width: img.width,
    height: img.height,
    data: imageData.data as Uint8ClampedArray,
  };
}

/**
 * Compare two PNG buffers pixel-by-pixel.
 *
 * If images have different dimensions, the comparison uses the overlapping
 * region and counts non-overlapping pixels as fully different.
 *
 * @param a - First PNG buffer
 * @param b - Second PNG buffer
 * @param threshold - Per-channel difference threshold to count as "different pixel" (default: 2)
 */
export async function comparePngs(a: Buffer, b: Buffer, threshold: number = DEFAULT_THRESHOLD): Promise<ComparisonResult> {
  const imgA = await decodePng(a);
  const imgB = await decodePng(b);

  const maxWidth = Math.max(imgA.width, imgB.width);
  const maxHeight = Math.max(imgA.height, imgB.height);
  const minWidth = Math.min(imgA.width, imgB.width);
  const minHeight = Math.min(imgA.height, imgB.height);

  const totalPixels = maxWidth * maxHeight;
  let totalError = 0;
  let maxDelta = 0;
  let diffPixelCount = 0;

  // Compare overlapping region
  for (let y = 0; y < minHeight; y++) {
    for (let x = 0; x < minWidth; x++) {
      const idxA = (y * imgA.width + x) * 4;
      const idxB = (y * imgB.width + x) * 4;

      let pixelMaxDelta = 0;
      let pixelError = 0;

      for (let c = 0; c < 4; c++) {
        const delta = Math.abs(imgA.data[idxA + c] - imgB.data[idxB + c]);
        pixelError += delta;
        if (delta > pixelMaxDelta) pixelMaxDelta = delta;
      }

      if (pixelMaxDelta > maxDelta) maxDelta = pixelMaxDelta;
      totalError += pixelError;

      if (pixelMaxDelta > threshold) {
        diffPixelCount++;
      }
    }
  }

  // Non-overlapping pixels count as maximum difference
  const nonOverlappingPixels = totalPixels - minWidth * minHeight;
  if (nonOverlappingPixels > 0) {
    diffPixelCount += nonOverlappingPixels;
    // Each non-overlapping pixel has max error of 255 * 4 channels
    totalError += nonOverlappingPixels * 255 * 4;
    if (maxDelta < 255) maxDelta = 255;
  }

  // Mean absolute error normalized to 0-1 (per channel, so divide by 4 channels * 255 max)
  const meanAbsoluteError = totalError / (totalPixels * 4 * 255);

  // Similarity is 1 - MAE
  const similarity = 1 - meanAbsoluteError;

  return {
    similarity,
    maxDelta,
    diffPixelCount,
    totalPixels,
    meanAbsoluteError,
  };
}
