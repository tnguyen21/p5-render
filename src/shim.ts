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
 */
function patchCanvasElement(el: any, defaultWidth: number, defaultHeight: number): void {
  const skia = new Canvas(defaultWidth, defaultHeight);
  el._skiaCanvas = skia;

  // Sync width/height to skia-canvas
  Object.defineProperty(el, "width", {
    get: () => skia.width,
    set: (v: number) => { skia.width = v; },
    configurable: true,
  });
  Object.defineProperty(el, "height", {
    get: () => skia.height,
    set: (v: number) => { skia.height = v; },
    configurable: true,
  });

  // Route getContext to skia-canvas
  el.getContext = function (type: string, _attrs?: any) {
    if (type === "2d") {
      const ctx = skia.getContext("2d");
      Object.defineProperty(ctx, "canvas", {
        value: el,
        writable: false,
        configurable: true,
      });
      return ctx;
    }
    if (type === "webgl" || type === "webgl2") {
      throw new Error("WEBGL not supported in headless mode. Use P2D (default) renderer.");
    }
    return null;
  };
}
