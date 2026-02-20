/**
 * Sets up a jsdom + skia-canvas environment so p5.js can run headlessly.
 *
 * Key insight: use jsdom's real HTMLCanvasElement (full DOM fidelity) but
 * swap out getContext('2d') to return a skia-canvas context. This gives
 * us proper DOM methods (appendChild, style, classList, etc.) for free
 * while routing all actual drawing through skia-canvas.
 *
 * Requires runScripts: 'dangerously' so that window/document globals are
 * available inside eval'd p5.js code.
 */

import { JSDOM } from "jsdom";
import { Canvas } from "skia-canvas";

const MAX_DIM = 4096;

export interface HeadlessEnvironment {
  window: any;
  document: any;
  /** Manually trigger the next requestAnimationFrame callback */
  stepFrame: () => void;
  /** Destroy the environment to free resources */
  destroy: () => void;
}

export function createEnvironment(width: number = 400, height: number = 400): HeadlessEnvironment {
  const html = `<!DOCTYPE html><html><head></head><body></body></html>`;
  const dom = new JSDOM(html, {
    url: "http://localhost",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });

  const window = dom.window as any;
  const document = window.document;

  // --- Canvas interception ---
  // Use jsdom's real createElement (full DOM compliance), but patch canvas
  // elements to route getContext('2d') through skia-canvas.
  const originalCreateElement = document.createElement.bind(document);

  document.createElement = function (tagName: string, options?: any): any {
    const el = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === "canvas") {
      patchCanvasElement(el, width, height);
    }
    return el;
  };

  // --- requestAnimationFrame: manually steppable ---
  let rafCallbacks: Array<{ id: number; fn: (time: number) => void }> = [];
  let nextRafId = 1;

  window.requestAnimationFrame = function (fn: (time: number) => void): number {
    const id = nextRafId++;
    rafCallbacks.push({ id, fn });
    return id;
  };

  window.cancelAnimationFrame = function (id: number): void {
    rafCallbacks = rafCallbacks.filter((cb) => cb.id !== id);
  };

  function stepFrame(): void {
    const callbacks = rafCallbacks;
    rafCallbacks = [];
    const now = performance.now();
    for (const { fn } of callbacks) {
      fn(now);
    }
  }

  // --- Window/document stubs ---
  Object.defineProperty(window, "innerWidth", { value: width, writable: true, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, writable: true, configurable: true });
  document.hasFocus = () => true;

  if (!window.screen) {
    window.screen = { width, height, availWidth: width, availHeight: height };
  }
  if (window.devicePixelRatio === undefined) {
    window.devicePixelRatio = 1;
  }
  // Provide ImageData constructor (used by p5's CPU filter path)
  if (!window.ImageData) {
    const tmpCanvas = new Canvas(1, 1);
    const tmpCtx = tmpCanvas.getContext("2d");
    window.ImageData = tmpCtx.getImageData(0, 0, 1, 1).constructor;
  }

  if (!window.AudioContext && !window.webkitAudioContext) {
    window.AudioContext = class StubAudioContext {
      close() {}
    };
  }
  if (!window.performance) {
    const start = Date.now();
    window.performance = { now: () => Date.now() - start };
  }

  function destroy(): void {
    rafCallbacks = [];
    dom.window.close();
  }

  return { window, document, stepFrame, destroy };
}

/**
 * Patch a jsdom HTMLCanvasElement to use skia-canvas for rendering.
 *
 * The element retains all its DOM behavior (style, classList, parentNode,
 * appendChild, event listeners, etc.) — we only replace the rendering
 * surface and context.
 *
 * IMPORTANT: We must NOT override ctx.canvas on the skia context. The
 * skia-canvas native code (getImageData, drawImage, etc.) accesses
 * this.canvas via a private WeakRef to the skia Canvas. Overriding it
 * with the JSDOM element causes native downcast failures. Instead, we
 * leave ctx.canvas pointing to the skia Canvas and let p5.js use
 * p._renderer.canvas / p._renderer.elt for DOM operations.
 *
 * For drawImage: when p5 passes a JSDOM canvas element as source,
 * we unwrap it to the underlying skia Canvas.
 */
function clamp(v: number): number {
  return Math.max(1, Math.min(v, MAX_DIM));
}

function patchCanvasElement(el: any, defaultWidth: number, defaultHeight: number): void {
  const skia = new Canvas(clamp(defaultWidth), clamp(defaultHeight));
  el._skiaCanvas = skia;

  // Sync width/height to skia-canvas, clamping to prevent OOM
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

  // Route getContext to skia-canvas
  el.getContext = function (type: string, _attrs?: any) {
    if (type === "2d") {
      if (cachedCtx) return cachedCtx;

      const ctx = skia.getContext("2d");

      // Wrap drawImage to unwrap JSDOM canvas elements to their skia Canvas.
      // skia-canvas checks `image instanceof Canvas` which fails for JSDOM elements.
      const origDrawImage = ctx.drawImage.bind(ctx) as Function;
      ctx.drawImage = function (source: any, ...args: any[]) {
        if (source && source._skiaCanvas) {
          return origDrawImage(source._skiaCanvas, ...args);
        }
        return origDrawImage(source, ...args);
      } as typeof ctx.drawImage;

      cachedCtx = ctx;
      return ctx;
    }
    if (type === "webgl" || type === "webgl2") {
      // Return null instead of throwing. p5.js tries WebGL internally for
      // filter() operations and falls back to 2D when context creation fails.
      return null;
    }
    return null;
  };
}
