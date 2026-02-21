/**
 * jsdom + skia-canvas environment for headless p5.js rendering.
 *
 * Uses jsdom's real HTMLCanvasElement (full DOM fidelity) but swaps
 * getContext('2d') to return a skia-canvas context. WebGL contexts
 * are provided via headless-gl.
 */

import { JSDOM, VirtualConsole } from "jsdom";
import { Canvas } from "skia-canvas";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

// Lazy-load headless-gl to avoid breaking worker threads (native addons
// can't be loaded from data-URL workers used by isolate mode)
let _createGL: ((w: number, h: number, attrs?: any) => any) | null | false;
function getCreateGL(): ((w: number, h: number, attrs?: any) => any) | null {
  if (_createGL === undefined) {
    try {
      _createGL = nodeRequire("gl");
    } catch {
      _createGL = false; // mark as unavailable
    }
  }
  return _createGL || null;
}

// Cache WebGLRenderingContext constructor at module level so we don't
// leak a temp GL context on every createEnvironment() call.
let _WebGLRenderingContext: any;
function getWebGLRenderingContext(): any {
  if (_WebGLRenderingContext !== undefined) return _WebGLRenderingContext;
  const createGL = getCreateGL();
  if (createGL) {
    try {
      const tmpGl = createGL(1, 1, {});
      if (tmpGl) {
        _WebGLRenderingContext = Object.getPrototypeOf(tmpGl).constructor;
        // Destroy temp context immediately to free the GL resource
        const ext = tmpGl.getExtension("STACKGL_destroy_context");
        if (ext) ext.destroy();
        return _WebGLRenderingContext;
      }
    } catch {}
  }
  _WebGLRenderingContext = null;
  return null;
}

const MAX_DIM = 4096;

export interface HeadlessEnvironment {
  window: any;
  document: any;
  stepFrame: () => void;
  destroy: () => void;
}

export function createEnvironment(
  width = 400,
  height = 400,
  onJsdomError?: (msg: string) => void,
): HeadlessEnvironment {
  const virtualConsole = new VirtualConsole();
  if (onJsdomError) virtualConsole.on("jsdomError", (err: any) => onJsdomError(String(err?.message ?? err)));

  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body><main></main></body></html>`, {
    url: "http://localhost",
    pretendToBeVisual: true,
    runScripts: "dangerously",
    virtualConsole,
  });

  const window = dom.window as any;
  const document = window.document;

  const createdCanvases: any[] = [];
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function (tagName: string, options?: any): any {
    const el = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === "canvas") {
      patchCanvasElement(el, width, height);
      createdCanvases.push(el);
    }
    return el;
  };

  let rafCallbacks: Array<{ id: number; fn: (time: number) => void }> = [];
  let nextRafId = 1;

  window.requestAnimationFrame = (fn: (time: number) => void) => {
    const id = nextRafId++;
    rafCallbacks.push({ id, fn });
    return id;
  };
  window.cancelAnimationFrame = (id: number) => {
    rafCallbacks = rafCallbacks.filter((cb) => cb.id !== id);
  };

  function stepFrame() {
    const callbacks = rafCallbacks;
    rafCallbacks = [];
    const now = performance.now();
    for (const { fn } of callbacks) fn(now);
  }

  Object.defineProperty(window, "innerWidth", { value: width, writable: true, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, writable: true, configurable: true });
  document.hasFocus = () => true;
  window.screen = { width, height, availWidth: width, availHeight: height };
  window.devicePixelRatio = 1;

  // ImageData constructor needed by p5's CPU filter path
  const tmpCtx = new Canvas(1, 1).getContext("2d");
  window.ImageData = tmpCtx.getImageData(0, 0, 1, 1).constructor;

  // Expanded AudioContext stub for p5.sound compatibility
  const noopNode = { connect() { return this; }, disconnect() {}, addEventListener() {} };
  window.AudioContext = class {
    sampleRate = 44100;
    currentTime = 0;
    state = "running";
    destination = { ...noopNode, maxChannelCount: 2, numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2 };
    listener = { positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 } };
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, ...noopNode }; }
    createOscillator() { return { frequency: { value: 440, setValueAtTime() {} }, type: "sine", start() {}, stop() {}, ...noopNode }; }
    createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData() {}, getFloatFrequencyData() {}, getByteTimeDomainData() {}, getFloatTimeDomainData() {}, ...noopNode }; }
    createBiquadFilter() { return { frequency: { value: 350, setValueAtTime() {} }, Q: { value: 1 }, type: "lowpass", ...noopNode }; }
    createDelay() { return { delayTime: { value: 0, setValueAtTime() {} }, ...noopNode }; }
    createDynamicsCompressor() { return { threshold: { value: -24 }, knee: { value: 30 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 }, ...noopNode }; }
    createConvolver() { return { buffer: null, ...noopNode }; }
    createStereoPanner() { return { pan: { value: 0, setValueAtTime() {} }, ...noopNode }; }
    createMediaStreamSource() { return noopNode; }
    createScriptProcessor() { return { onaudioprocess: null, ...noopNode }; }
    createBufferSource() { return { buffer: null, playbackRate: { value: 1 }, loop: false, start() {}, stop() {}, ...noopNode }; }
    createBuffer(channels: number, length: number, rate: number) { return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => new Float32Array(length) }; }
    decodeAudioData(_buf: any, ok?: Function) { const b = this.createBuffer(1, 1, this.sampleRate); if (ok) ok(b); return Promise.resolve(b); }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  };
  window.webkitAudioContext = window.AudioContext;

  // Stub WebGLRenderingContext so p5's instanceof checks work
  const WebGLCtorCached = getWebGLRenderingContext();
  if (WebGLCtorCached) window.WebGLRenderingContext = WebGLCtorCached;

  // DOMPoint stub — jsdom doesn't provide it, p5 uses it for 3D transforms
  if (!window.DOMPoint) {
    window.DOMPoint = class DOMPoint {
      x: number; y: number; z: number; w: number;
      constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
      matrixTransform() { return new DOMPoint(this.x, this.y, this.z, this.w); }
      toJSON() { return { x: this.x, y: this.y, z: this.z, w: this.w }; }
    };
  }

  // DOMMatrix stub — jsdom doesn't provide it, p5 uses it in accessibility/outputs
  if (!window.DOMMatrix) {
    window.DOMMatrix = class DOMMatrix {
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      get a() { return this.m11; } get b() { return this.m12; }
      get c() { return this.m21; } get d() { return this.m22; }
      get e() { return this.m41; } get f() { return this.m42; }
      constructor(init?: any) {
        if (Array.isArray(init) && init.length === 16) {
          [this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,
           this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44] = init;
        }
      }
      multiply() { return new DOMMatrix(); }
      multiplySelf() { return this; }
      translate() { return new DOMMatrix(); }
      translateSelf() { return this; }
      scale() { return new DOMMatrix(); }
      scaleSelf() { return this; }
      scale3dSelf() { return this; }
      rotate() { return new DOMMatrix(); }
      rotateSelf() { return this; }
      rotateAxisAngleSelf() { return this; }
      rotateFromVectorSelf() { return this; }
      skewXSelf() { return this; }
      skewYSelf() { return this; }
      invertSelf() { return this; }
      inverse() { return new DOMMatrix(); }
      transformPoint(p?: any) { return { x: 0, y: 0, z: 0, w: 1 }; }
      toFloat64Array() { return new Float64Array([this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44]); }
      toFloat32Array() { return new Float32Array([this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44]); }
    };
  }

  const start = Date.now();
  window.performance = { now: () => Date.now() - start };

  // Suppress unhandled errors from bubbling to Node's stderr
  window.onerror = () => true;

  return {
    window,
    document,
    stepFrame,
    destroy() {
      rafCallbacks = [];
      // Destroy GL contexts to free headless-gl resources
      for (const el of createdCanvases) {
        const gl = el._glCtx;
        if (gl) {
          try {
            const ext = gl.getExtension("STACKGL_destroy_context");
            if (ext) ext.destroy();
          } catch {}
        }
      }
      createdCanvases.length = 0;
      dom.window.close();
    },
  };
}

/**
 * Patch a jsdom canvas element to route drawing through skia-canvas.
 *
 * We must NOT override ctx.canvas — skia-canvas native code accesses it
 * via a private WeakRef. We wrap drawImage to unwrap JSDOM canvas
 * elements to their underlying skia Canvas instead.
 */
function clamp(v: number): number {
  return Math.max(1, Math.min(v, MAX_DIM));
}

function patchCanvasElement(el: any, defaultWidth: number, defaultHeight: number): void {
  const skia = new Canvas(clamp(defaultWidth), clamp(defaultHeight));
  el._skiaCanvas = skia;

  Object.defineProperty(el, "width", {
    get: () => skia.width,
    set: (v: number) => { skia.width = clamp(v); },
    configurable: true,
  });
  Object.defineProperty(el, "height", {
    get: () => skia.height,
    set: (v: number) => { skia.height = clamp(v); },
    configurable: true,
  });

  let cachedCtx: any = null;
  let cachedGlCtx: any = null;

  // getBoundingClientRect — JSDOM returns all zeros (no layout engine),
  // which makes p5's getMousePos() divide by zero. Return dimensions
  // matching the canvas so mouse coordinates work correctly.
  el.getBoundingClientRect = function () {
    return {
      top: 0, left: 0, right: skia.width, bottom: skia.height,
      width: skia.width, height: skia.height, x: 0, y: 0,
      toJSON() { return this; },
    };
  };

  // scrollWidth/scrollHeight — also used by p5's mouse coordinate math
  Object.defineProperty(el, "scrollWidth", {
    get: () => skia.width,
    configurable: true,
  });
  Object.defineProperty(el, "scrollHeight", {
    get: () => skia.height,
    configurable: true,
  });

  el.getContext = function (type: string, attrs?: any) {
    if (type === "2d") {
      if (cachedCtx) return cachedCtx;
      const ctx = skia.getContext("2d");

      const origDrawImage = ctx.drawImage.bind(ctx) as Function;
      ctx.drawImage = function (source: any, ...args: any[]) {
        return origDrawImage(source?._skiaCanvas ?? source, ...args);
      } as typeof ctx.drawImage;

      cachedCtx = ctx;
      return ctx;
    }
    if (type === "webgl" || type === "experimental-webgl") {
      if (cachedGlCtx) return cachedGlCtx;
      const createGL = getCreateGL();
      if (!createGL) return null;
      try {
        const glCtx = createGL(skia.width, skia.height, attrs || {});
        if (!glCtx) return null;
        (glCtx as any).canvas = el;
        cachedGlCtx = glCtx;
        el._glCtx = glCtx;
        return glCtx;
      } catch {
        return null;
      }
    }
    // Return null for webgl2 — p5 tries webgl2 → webgl → experimental-webgl;
    // headless-gl only supports WebGL 1.0, so we let p5 fall through.
    return null;
  };
}
