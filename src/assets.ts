/**
 * Handle loadImage() and loadFont() from pre-provided buffers.
 *
 * When a sketch calls loadImage("cat.png"), we resolve it from the
 * assets map passed into renderSketch(), rather than hitting the network.
 */

import { loadImage as skiaLoadImage } from "skia-canvas";

export type AssetMap = Record<string, Buffer>;

/**
 * Create a patched loadFont function that resolves from the assets map.
 * For now, this is a stub that throws a clear error if the font isn't
 * in the assets map. Full font loading support can be added later.
 */
export function createFontLoader(assets: AssetMap) {
  return function loadFontFromAssets(path: string): any {
    const buffer = assets[path];
    if (!buffer) {
      throw new Error(`Font asset not found: "${path}". Available assets: [${Object.keys(assets).join(", ")}]`);
    }
    // TODO: register font with skia-canvas FontLibrary and return a font name
    return path;
  };
}

/**
 * Patch p5's asset loading functions on the given p5 instance.
 *
 * For loadImage: creates a real p5.Image via p.createImage(), loads the
 * buffer with skia-canvas, draws it onto the p5.Image's canvas, and
 * properly interacts with p5's preload counter so preload() works.
 */
export function patchAssetLoaders(p: any, assets: AssetMap): void {
  if (!assets || Object.keys(assets).length === 0) return;

  const originalLoadImage = p.loadImage?.bind(p);

  p.loadImage = function (path: string, successCallback?: (img: any) => void, failureCallback?: (err: any) => void) {
    if (!assets[path]) {
      // Fall through to original if not in assets
      if (originalLoadImage) {
        return originalLoadImage(path, successCallback, failureCallback);
      }
      throw new Error(`Cannot load image "${path}" in headless mode without providing it in the assets map.`);
    }

    // Create a 1x1 p5.Image placeholder (resized once loaded)
    // Note: p5's preload wrapper already calls _incrementPreload() for us,
    // so we only need to call _decrementPreload() when the image is ready.
    const pImg = p.createImage(1, 1);

    // Asynchronously load the buffer and populate the p5.Image
    skiaLoadImage(assets[path])
      .then((skiaImg: any) => {
        const w = skiaImg.width;
        const h = skiaImg.height;

        // Resize the p5.Image's underlying canvas
        pImg.width = w;
        pImg.height = h;
        if (pImg.canvas) {
          pImg.canvas.width = w;
          pImg.canvas.height = h;
        }

        // Draw the skia image onto the p5.Image's canvas
        const ctx = pImg.canvas?.getContext?.("2d");
        if (ctx) {
          // Unwrap to underlying skia canvas if needed (drawImage patch)
          ctx.drawImage(skiaImg, 0, 0);
        }

        // Sync p5.Image pixel state
        if (typeof pImg.loadPixels === "function") {
          pImg.loadPixels();
        }

        if (successCallback) successCallback(pImg);
        if (typeof p._decrementPreload === "function") {
          p._decrementPreload();
        }
      })
      .catch((err: any) => {
        if (failureCallback) failureCallback(err);
        if (typeof p._decrementPreload === "function") {
          p._decrementPreload();
        }
      });

    return pImg;
  };
}
