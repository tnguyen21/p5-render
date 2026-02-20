/**
 * Handle loadImage() and loadFont() from pre-provided buffers.
 *
 * When a sketch calls loadImage("cat.png"), we resolve it from the
 * assets map passed into renderSketch(), rather than hitting the network.
 */

import { loadImage as skiaLoadImage } from "skia-canvas";

export type AssetMap = Record<string, Buffer>;

/**
 * Create a patched loadImage function that resolves from the assets map.
 * Returns a function that can be assigned to the p5 instance.
 */
export function createImageLoader(assets: AssetMap) {
  return async function loadImageFromAssets(path: string): Promise<any> {
    const buffer = assets[path];
    if (!buffer) {
      throw new Error(
        `Asset not found: "${path}". Available assets: [${Object.keys(assets).join(", ")}]`
      );
    }
    // skia-canvas loadImage accepts a Buffer
    const img = await skiaLoadImage(buffer);
    return img;
  };
}

/**
 * Create a patched loadFont function that resolves from the assets map.
 * For now, this is a stub that throws a clear error if the font isn't
 * in the assets map. Full font loading support can be added later.
 */
export function createFontLoader(assets: AssetMap) {
  return function loadFontFromAssets(path: string): any {
    const buffer = assets[path];
    if (!buffer) {
      throw new Error(
        `Font asset not found: "${path}". Available assets: [${Object.keys(assets).join(", ")}]`
      );
    }
    // TODO: register font with skia-canvas FontLibrary and return a font name
    // For now, return the path as a placeholder
    return path;
  };
}

/**
 * Patch p5's asset loading functions on the given p5 instance.
 * This replaces the default network-based loaders with our buffer-based ones.
 */
export function patchAssetLoaders(p: any, assets: AssetMap): void {
  if (!assets || Object.keys(assets).length === 0) return;

  const imageLoader = createImageLoader(assets);

  // Override p5's loadImage
  const originalLoadImage = p.loadImage?.bind(p);
  p.loadImage = function (path: string, successCallback?: (img: any) => void, failureCallback?: (err: any) => void) {
    // Check if the path is in our assets map
    if (assets[path]) {
      const promise = imageLoader(path);
      if (successCallback) {
        promise.then(successCallback).catch(failureCallback || (() => {}));
      }
      // p5's loadImage returns a p5.Image, but we return the skia Image.
      // This is a simplification; full compatibility would require wrapping.
      return promise;
    }
    // Fall through to original if not in assets (will likely fail in headless)
    if (originalLoadImage) {
      return originalLoadImage(path, successCallback, failureCallback);
    }
    throw new Error(`Cannot load image "${path}" in headless mode without providing it in the assets map.`);
  };
}
