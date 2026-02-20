import { loadImage as skiaLoadImage } from "skia-canvas";

export type AssetMap = Record<string, Buffer>;

export function patchAssetLoaders(p: any, assets: AssetMap): void {
  if (!assets || Object.keys(assets).length === 0) return;

  const originalLoadImage = p.loadImage?.bind(p);

  p.loadImage = function (path: string, successCallback?: (img: any) => void, failureCallback?: (err: any) => void) {
    if (!assets[path]) {
      if (originalLoadImage) return originalLoadImage(path, successCallback, failureCallback);
      throw new Error(`Cannot load image "${path}" in headless mode without providing it in the assets map.`);
    }

    // Create a p5.Image placeholder, load async, draw onto its canvas.
    // p5's preload wrapper already calls _incrementPreload(), so we only _decrementPreload() when done.
    const pImg = p.createImage(1, 1);

    skiaLoadImage(assets[path])
      .then((skiaImg: any) => {
        pImg.width = skiaImg.width;
        pImg.height = skiaImg.height;
        pImg.canvas.width = skiaImg.width;
        pImg.canvas.height = skiaImg.height;
        pImg.canvas.getContext("2d").drawImage(skiaImg, 0, 0);
        pImg.loadPixels();
        if (successCallback) successCallback(pImg);
        p._decrementPreload();
      })
      .catch((err: any) => {
        if (failureCallback) failureCallback(err);
        p._decrementPreload();
      });

    return pImg;
  };
}
