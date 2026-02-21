import { loadImage as skiaLoadImage } from "skia-canvas";

export type AssetMap = Record<string, Buffer>;

export function patchAssetLoaders(p: any, assets: AssetMap): void {
  const originalLoadImage = p.loadImage?.bind(p);

  p.loadImage = function (path: string, successCallback?: (img: any) => void, failureCallback?: (err: any) => void) {
    if (assets[path]) {
      // Load from provided asset map
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
    }

    // No asset provided — return a 1x1 placeholder and decrement preload
    // so the sketch doesn't hang forever waiting for a network fetch
    const pImg = p.createImage(1, 1);
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCallback) successCallback(pImg);
    });
    return pImg;
  };

  // Patch loadFont to not hang on missing fonts
  const originalLoadFont = p.loadFont?.bind(p);
  p.loadFont = function (path: string, successCallback?: Function, failureCallback?: Function) {
    // Return a stub font object and decrement preload
    const stub = {};
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCallback) successCallback(stub);
    });
    return stub;
  };

  // Patch loadJSON to not hang on missing files
  p.loadJSON = function (path: string, successCallback?: Function, failureCallback?: Function) {
    const stub = {};
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCallback) successCallback(stub);
    });
    return stub;
  };

  // Patch loadStrings to not hang on missing files
  p.loadStrings = function (path: string, successCallback?: Function, failureCallback?: Function) {
    const stub: string[] = [];
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCallback) successCallback(stub);
    });
    return stub;
  };

  // Patch loadTable to not hang
  p.loadTable = function (path: string, ...args: any[]) {
    const successCallback = args.find((a: any) => typeof a === "function");
    const stub = { getRowCount: () => 0, getColumnCount: () => 0, getRow: () => null, getRows: () => [], columns: [] };
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCallback) successCallback(stub);
    });
    return stub;
  };

  // Patch loadModel to not hang
  p.loadModel = function (path: string, ...args: any[]) {
    const successCallback = args.find((a: any) => typeof a === "function");
    const stub = {};
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCallback) successCallback(stub);
    });
    return stub;
  };

  // Patch loadShader to not hang
  p.loadShader = function (vertPath: string, fragPath: string, successCallback?: Function, failureCallback?: Function) {
    const stub = {};
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCallback) successCallback(stub);
    });
    return stub;
  };

  // Patch loadBytes to not hang
  p.loadBytes = function (path: string, successCallback?: Function, failureCallback?: Function) {
    const stub = { bytes: new Uint8Array(0) };
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCallback) successCallback(stub);
    });
    return stub;
  };

  // Patch loadXML to not hang
  p.loadXML = function (path: string, successCallback?: Function, failureCallback?: Function) {
    const stub = {};
    queueMicrotask(() => {
      try { p._decrementPreload(); } catch {}
      if (successCallback) successCallback(stub);
    });
    return stub;
  };
}
