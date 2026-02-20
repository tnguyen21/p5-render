/**
 * jsdom + skia-canvas environment for headless p5.js rendering.
 *
 * Uses jsdom's real HTMLCanvasElement (full DOM fidelity) but swaps
 * getContext('2d') to return a skia-canvas context.
 */

import { JSDOM } from "jsdom";
import { Canvas } from "skia-canvas";

const MAX_DIM = 4096;

export interface HeadlessEnvironment {
  window: any;
  document: any;
  stepFrame: () => void;
  destroy: () => void;
}

export function createEnvironment(width = 400, height = 400): HeadlessEnvironment {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
    url: "http://localhost",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });

  const window = dom.window as any;
  const document = window.document;

  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function (tagName: string, options?: any): any {
    const el = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === "canvas") patchCanvasElement(el, width, height);
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

  window.AudioContext = class { close() {} };

  const start = Date.now();
  window.performance = { now: () => Date.now() - start };

  return {
    window,
    document,
    stepFrame,
    destroy() { rafCallbacks = []; dom.window.close(); },
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

  el.getContext = function (type: string, _attrs?: any) {
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
    // Return null for webgl — p5 tries it for filter() and falls back to 2D
    return null;
  };
}
