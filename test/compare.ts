import { loadImage, Canvas } from "skia-canvas";

export interface ComparisonResult {
  similarity: number;
  maxDelta: number;
  diffPixelCount: number;
  totalPixels: number;
  meanAbsoluteError: number;
}

async function decodePng(buffer: Buffer) {
  const img = await loadImage(buffer);
  const canvas = new Canvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  return { width: img.width, height: img.height, data: imageData.data as Uint8ClampedArray };
}

export async function comparePngs(a: Buffer, b: Buffer, threshold = 2): Promise<ComparisonResult> {
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
      if (pixelMaxDelta > threshold) diffPixelCount++;
    }
  }

  const nonOverlapping = totalPixels - minWidth * minHeight;
  if (nonOverlapping > 0) {
    diffPixelCount += nonOverlapping;
    totalError += nonOverlapping * 255 * 4;
    if (maxDelta < 255) maxDelta = 255;
  }

  const meanAbsoluteError = totalError / (totalPixels * 4 * 255);

  return { similarity: 1 - meanAbsoluteError, maxDelta, diffPixelCount, totalPixels, meanAbsoluteError };
}
