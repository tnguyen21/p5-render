import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Canvas } from "skia-canvas";
import { createEnvironment, type HeadlessEnvironment } from "./shim.js";
import { wrapGlobalSketch } from "./global-mode-adapter.js";
import { DeterministicClock } from "./clock.js";
import { patchAssetLoaders, type AssetMap } from "./assets.js";
import { patchSoundStubs } from "./sound-stubs.js";
import { clampDimensions, createConsoleCapture, parseError, withTimeout, type SketchPhase, DEFAULT_TIMEOUT_MS } from "./sandbox.js";

export interface RendererOptions {
  code: string;
  width?: number;
  height?: number;
  frames?: number;
  frameRate?: number;
  seed?: number;
  timeout?: number;
  assets?: AssetMap;
  /** Run N draw() calls before the capture window, discarding output. */
  warmup?: number;
  /** During warmup, dispatch synthetic mouse events to trigger p5 event handlers. */
  simulateInteraction?: boolean;
  /** Run in a worker thread so synchronous infinite loops can be terminated. */
  isolate?: boolean;
}

export interface RenderSuccess {
  ok: true;
  frames: Buffer[];
  width: number;
  height: number;
  duration_ms: number;
  logs: string[];
}

export interface RenderError {
  ok: false;
  error: string;
  errorLine?: number;
  errorColumn?: number;
  errorStack?: string;
  phase?: SketchPhase;
  frameNumber?: number;
  logs: string[];
  partial_frames: Buffer[];
}

export type RenderResult = RenderSuccess | RenderError;

let p5SourceCache: string | null = null;

function getP5Source(): string {
  if (p5SourceCache) return p5SourceCache;
  const candidates = [
    resolve(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "p5", "lib", "p5.min.js"),
    resolve(process.cwd(), "node_modules", "p5", "lib", "p5.min.js"),
  ];
  for (const candidate of candidates) {
    try {
      p5SourceCache = readFileSync(candidate, "utf-8");
      return p5SourceCache;
    } catch {
      // try next
    }
  }
  throw new Error(`Could not find p5.min.js. Searched: ${candidates.join(", ")}`);
}

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadP5IntoWindow(win: any): any {
  const p5Source = getP5Source();
  const wrappedSource =
    "(function() {\n" +
    "  var module = { exports: {} };\n" +
    "  var exports = module.exports;\n" +
    "  var define = undefined;\n" +
    p5Source +
    "\n  window.p5 = module.exports || window.p5;\n" +
    "})();\n";
  win.eval(wrappedSource);
  return win.p5;
}

function findSkiaCanvas(p: any, document: any): any {
  return p?._renderer?.canvas?._skiaCanvas
    ?? p?._renderer?.elt?._skiaCanvas
    ?? document.querySelector?.("canvas")?._skiaCanvas
    ?? null;
}

function captureFrame(p: any, document: any): Buffer | null {
  // WebGL path: read pixels from GL context (check first — skia canvas
  // exists on WebGL canvases too but has no associated 2D context)
  const gl = p?._renderer?.GL;
  if (gl) {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    flipVertical(pixels, w, h);
    const canvas = new Canvas(w, h);
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(w, h);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toBufferSync("png");
  }

  // 2D path: use skia-canvas directly
  const skiaCanvas = findSkiaCanvas(p, document);
  if (skiaCanvas) return skiaCanvas.toBufferSync("png");

  return null;
}

function flipVertical(pixels: Uint8Array, w: number, h: number): void {
  const rowSize = w * 4;
  const tmp = new Uint8Array(rowSize);
  for (let y = 0; y < h / 2; y++) {
    const top = y * rowSize;
    const bottom = (h - 1 - y) * rowSize;
    tmp.set(pixels.subarray(top, top + rowSize));
    pixels.copyWithin(top, bottom, bottom + rowSize);
    pixels.set(tmp, bottom);
  }
}

function yieldToEventLoop(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Dispatch synthetic mouse events during warmup frames.
 * Sweeps mouse across canvas in a Lissajous pattern and clicks periodically.
 */
function dispatchMouseInteraction(
  window: any,
  canvasWidth: number,
  canvasHeight: number,
  frameIndex: number,
  totalWarmupFrames: number,
): void {
  const t = totalWarmupFrames > 1 ? frameIndex / (totalWarmupFrames - 1) : 0.5;
  const clientX = canvasWidth * (0.5 + 0.4 * Math.sin(t * 2 * Math.PI));
  const clientY = canvasHeight * (0.5 + 0.4 * Math.cos(t * 3 * Math.PI));
  const eventInit = { clientX, clientY, bubbles: true };

  window.dispatchEvent(new window.MouseEvent("mousemove", eventInit));

  if (frameIndex % 15 === 0) {
    window.dispatchEvent(new window.MouseEvent("mousedown", eventInit));
    window.dispatchEvent(new window.MouseEvent("mouseup", eventInit));
    window.dispatchEvent(new window.MouseEvent("click", eventInit));
  }
}

export async function renderSketchInProcess(options: RendererOptions): Promise<RenderResult> {
  const { code, frames: frameCount = 1, frameRate = 60, seed, timeout = DEFAULT_TIMEOUT_MS, assets = {}, warmup = 0, simulateInteraction: doInteraction = false } = options;
  let { width = 400, height = 400 } = options;

  const { logs, console: capturedConsole } = createConsoleCapture();
  const capturedFrames: Buffer[] = [];
  let env: HeadlessEnvironment | null = null;
  const startTime = Date.now();

  try {
    const result = await withTimeout(
      async () => {
        ({ width, height } = clampDimensions(width, height, logs));
        env = createEnvironment(width, height, (msg) => logs.push(`[jsdom] ${msg}`));
        const { window, document, stepFrame } = env;
        window.console = capturedConsole;

        const p5Constructor = loadP5IntoWindow(window);
        const { wrapped, isGlobal } = wrapGlobalSketch(code);
        const clock = new DeterministicClock(frameRate);

        let sketchFn: any;
        try {
          if (isGlobal) {
            sketchFn = new Function("return " + wrapped)();
          } else {
            const trimmed = code.trim();
            if (/^\s*new\s+p5\s*\(/.test(trimmed)) {
              const fnCode = trimmed.replace(/^\s*new\s+p5\s*\(\s*/, "").replace(/\s*\)\s*;?\s*$/, "");
              sketchFn = new Function("return " + fnCode)();
            } else {
              sketchFn = new Function("return " + trimmed)();
            }
          }
        } catch (err) {
          return { ok: false as const, ...parseError(err, "init"), logs, partial_frames: capturedFrames };
        }

        if (typeof sketchFn !== "function") {
          return {
            ok: false as const,
            error: `Sketch code did not produce a function. Got ${typeof sketchFn}.`,
            phase: "init" as SketchPhase,
            logs,
            partial_frames: capturedFrames,
          };
        }

        let setupDone = false;
        let drawCount = 0;
        let drawError: any = null;
        let capturing = false;

        const wrappedSketchFn = function (p: any) {
          if (seed !== undefined) window.Math.random = mulberry32(seed);
          patchAssetLoaders(p, assets);
          patchSoundStubs(p, p5Constructor);
          clock.patchP5Instance(p);
          p.mouseX = width / 2;
          p.mouseY = height / 2;

          // Expose globals that global-mode sketches reference via bare names
          // (the with(p) wrapper only sees properties on p, not window)
          if (!p.p5) p.p5 = p5Constructor;
          if (!p.screen) p.screen = window.screen;
          if (!p.document) p.document = document;
          if (!p.window) p.window = window;
          // Some sketches call blur() as a standalone CSS filter shorthand
          if (!p.blur) p.blur = () => {};
          // Processing compat: println is console.log
          if (!p.println) p.println = (...args: any[]) => { capturedConsole.log(...args); };

          // Initialize random state early — sketches may call random() in
          // their top-level body before setup() runs
          const effectiveSeed = seed ?? (Math.random() * 4294967296) | 0;
          try { p.randomSeed(effectiveSeed); p.noiseSeed(effectiveSeed); } catch {}

          // Expose DOMMatrix for with(p) scope — jsdom doesn't provide it
          if (!p.DOMMatrix) p.DOMMatrix = window.DOMMatrix;

          // createCapture tries to access camera — stub it to prevent setup hang
          const origCreateCapture = p.createCapture?.bind(p);
          p.createCapture = function (...args: any[]) {
            // Return a stub video element with enough surface for p5 sketches
            const el = document.createElement("video");
            el.width = width;
            el.height = height;
            el.loadedmetadata = true;
            // p5 wraps the element in a p5.MediaElement — create one if possible
            try {
              const me = new p5Constructor.MediaElement(el, p);
              me.loadPixels = () => {};
              queueMicrotask(() => {
                const cb = args.find((a: any) => typeof a === "function");
                if (cb) cb(me);
              });
              return me;
            } catch {
              el.loadPixels = () => {};
              el.get = () => p.createImage(1, 1);
              el.pixels = [];
              return el;
            }
          };

          try {
            sketchFn(p);
          } catch (err) {
            drawError = { err, phase: "init" as SketchPhase };
            return;
          }

          // Force filter() to use the CPU path — p5 v1.11+ defaults to WebGL which fails headless
          const origFilter = p.filter.bind(p);
          p.filter = (operation: any, value?: any) => origFilter(operation, value, false);

          const userSetup = p.setup ? p.setup.bind(p) : null;
          p.setup = function () {
            try {
              p.pixelDensity(1);
              // Always init random state — p5's _lcg_random_state is
              // undefined until randomSeed() is called, but some sketches
              // use random() before ever calling randomSeed().
              const effectiveSeed = seed ?? (Math.random() * 4294967296) | 0;
              p.randomSeed(effectiveSeed);
              p.noiseSeed(effectiveSeed);
              p.frameRate(frameRate);
              if (userSetup) userSetup();
              else p.createCanvas(width, height);
              p.noLoop();
              setupDone = true;
            } catch (err) {
              drawError = { err, phase: "setup" as SketchPhase };
            }
          };

          const userDraw = p.draw ? p.draw.bind(p) : null;
          p.draw = function () {
            drawCount++;
            clock.tick();
            clock.patchFrame(p);
            try {
              if (userDraw) userDraw();
            } catch (err) {
              drawError = { err, phase: "draw" as SketchPhase, frameNumber: drawCount };
              return;
            }
            if (capturing) {
              const frame = captureFrame(p, document);
              if (frame) capturedFrames.push(frame);
              else logs.push(`[p5-render] Warning: could not capture frame ${drawCount}`);
            }
          };
        };

        let p5Instance: any;
        try {
          p5Instance = new p5Constructor(wrappedSketchFn, document.body);
        } catch (err) {
          return { ok: false as const, ...parseError(err, "init"), logs, partial_frames: capturedFrames };
        }

        if (drawError) {
          return { ok: false as const, ...parseError(drawError.err, drawError.phase, drawError.frameNumber), logs, partial_frames: capturedFrames };
        }

        // Wait for p5 to initialize (it uses setTimeout internally)
        for (let i = 0; i < 50 && !setupDone && !drawError; i++) {
          stepFrame();
          await yieldToEventLoop(10);
        }

        if (drawError) {
          return { ok: false as const, ...parseError(drawError.err, drawError.phase, drawError.frameNumber), logs, partial_frames: capturedFrames };
        }
        if (!setupDone) {
          return { ok: false as const, error: "Timed out waiting for setup() to complete", phase: "setup" as SketchPhase, logs, partial_frames: capturedFrames };
        }

        // Discard frames captured during p5 init
        capturedFrames.length = 0;
        drawCount = 0;

        // Warmup: run N draw() calls without capturing
        for (let i = 0; i < warmup && !drawError; i++) {
          if (doInteraction) {
            dispatchMouseInteraction(window, width, height, i, warmup);
          }
          try {
            p5Instance.redraw();
          } catch (err) {
            return { ok: false as const, ...parseError(err, "draw", drawCount), logs, partial_frames: capturedFrames };
          }
        }

        if (drawError) {
          return { ok: false as const, ...parseError(drawError.err, drawError.phase, drawError.frameNumber), logs, partial_frames: capturedFrames };
        }

        // Begin capturing
        capturing = true;

        for (let i = 0; i < frameCount && !drawError; i++) {
          try {
            p5Instance.redraw();
          } catch (err) {
            return { ok: false as const, ...parseError(err, "draw", i + 1), logs, partial_frames: capturedFrames };
          }
        }

        if (drawError) {
          return { ok: false as const, ...parseError(drawError.err, drawError.phase, drawError.frameNumber), logs, partial_frames: capturedFrames };
        }

        // Setup-only sketch: capture canvas now
        if (capturedFrames.length === 0) {
          const frame = captureFrame(p5Instance, document);
          if (frame) capturedFrames.push(frame);
        }

        const skia = findSkiaCanvas(p5Instance, document);
        return {
          ok: true as const,
          frames: capturedFrames,
          width: skia?.width || p5Instance?.width || width,
          height: skia?.height || p5Instance?.height || height,
          duration_ms: Date.now() - startTime,
          logs,
        };
      },
      timeout,
      "sketch rendering",
    );

    return result;
  } catch (err) {
    return { ok: false, ...parseError(err), logs, partial_frames: capturedFrames };
  } finally {
    if (env) {
      try { (env as HeadlessEnvironment).destroy(); } catch {}
    }
  }
}

/**
 * Run a sketch in an isolated worker thread via the worker pool.
 * Pool workers are long-lived, avoiding per-request native module loading
 * that causes SIGSEGV crashes during batch rendering.
 */
async function renderSketchIsolated(options: RendererOptions): Promise<RenderResult> {
  const { getPool } = await import("./pool.js");
  const pool = getPool(4);
  return pool.render(options);
}

export async function renderSketch(options: RendererOptions): Promise<RenderResult> {
  return options.isolate ? renderSketchIsolated(options) : renderSketchInProcess(options);
}
