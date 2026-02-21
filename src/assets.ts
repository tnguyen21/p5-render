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
    // Return a stub font object with common methods sketches expect
    const stub = {
      font: { names: {}, glyphs: { glyphs: {} }, unitsPerEm: 1000 },
      textToPoints(str: string, x: number, y: number, size: number, opts?: any) { return []; },
      textBounds(str: string, x: number, y: number, size: number) { return { x, y, w: 0, h: 0 }; },
    };
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
    const stub = {
      getRowCount: () => 0, getColumnCount: () => 0,
      getRow: () => null, getRows: () => [], columns: [],
      getString: () => "", getNum: () => 0, getObject: () => ({}),
      findRow: () => null, findRows: () => [], matchRow: () => null, matchRows: () => [],
      getColumn: () => [], set: () => {}, setString: () => {}, setNum: () => {},
      addRow: () => {}, removeRow: () => {}, addColumn: () => {}, removeColumn: () => {},
    };
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

  // Patch loadShader to not hang — stub must have p5.Shader methods
  p.loadShader = function (vertPath: string, fragPath: string, successCallback?: Function, failureCallback?: Function) {
    const noop = () => stub;
    const stub: Record<string, any> = {
      setUniform: noop, ensureCompiledOnContext: noop,
      useProgram: noop, bindShader: noop, unbindShader: noop,
      bindTextures: noop, copyToContext: noop, setDefaultUniforms: noop,
      isStrokeShader: () => false, isLightShader: () => false,
      isTextureShader: () => false, isColorShader: () => false,
      isNormalShader: () => false, isTexLightShader: () => false,
      _vertSrc: "", _fragSrc: "", _glProgram: null,
      uniforms: {},
    };
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
