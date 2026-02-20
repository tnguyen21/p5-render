/**
 * Core rendering logic that ties everything together.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { createEnvironment, type HeadlessEnvironment } from "./shim.js";
import { wrapGlobalSketch } from "./global-mode-adapter.js";
import { DeterministicClock } from "./clock.js";
import { patchAssetLoaders, type AssetMap } from "./assets.js";
import {
  clampDimensions,
  createConsoleCapture,
  parseError,
  withTimeout,
  type SketchPhase,
  DEFAULT_TIMEOUT_MS,
} from "./sandbox.js";

export interface RendererOptions {
  code: string;
  width?: number;
  height?: number;
  frames?: number;
  frameRate?: number;
  seed?: number;
  timeout?: number;
  assets?: AssetMap;
  /** When true, run the sketch in a worker thread so synchronous infinite loops can be terminated. */
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
  const p5Constructor = win.p5;
  if (!p5Constructor || typeof p5Constructor !== "function") {
    throw new Error("Failed to load p5.js: p5 constructor not found after evaluation");
  }
  return p5Constructor;
}

function findSkiaCanvas(p: any, document: any): any {
  if (p?._renderer?.canvas?._skiaCanvas) return p._renderer.canvas._skiaCanvas;
  if (p?._renderer?.elt?._skiaCanvas) return p._renderer.elt._skiaCanvas;
  if (p?.canvas?._skiaCanvas) return p.canvas._skiaCanvas;
  const el = document.querySelector?.("canvas");
  if (el?._skiaCanvas) return el._skiaCanvas;
  return null;
}

function captureFrame(p: any, document: any): Buffer | null {
  const skiaCanvas = findSkiaCanvas(p, document);
  if (skiaCanvas && typeof skiaCanvas.toBufferSync === "function") {
    return skiaCanvas.toBufferSync("png");
  }
  return null;
}

/** Yield to the event loop so setTimeout-based callbacks can fire. */
function yieldToEventLoop(ms: number = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function renderSketchInProcess(options: RendererOptions): Promise<RenderResult> {
  const {
    code,
    frames: frameCount = 1,
    frameRate = 60,
    seed,
    timeout = DEFAULT_TIMEOUT_MS,
    assets = {},
  } = options;

  let { width = 400, height = 400 } = options;

  const { logs, console: capturedConsole } = createConsoleCapture();
  const capturedFrames: Buffer[] = [];
  let env: HeadlessEnvironment | null = null;
  const startTime = Date.now();

  try {
    const result = await withTimeout(
      async () => {
        ({ width, height } = clampDimensions(width, height, logs));

        env = createEnvironment(width, height);
        const { window, document, stepFrame } = env;
        window.console = capturedConsole;

        const p5Constructor = loadP5IntoWindow(window);
        const { wrapped, isGlobal } = wrapGlobalSketch(code);
        const clock = new DeterministicClock(frameRate);

        // --- Parse sketch function ---
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
          const parsed = parseError(err, "init");
          return { ok: false as const, ...parsed, logs, partial_frames: capturedFrames };
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

        // --- State shared between sketch callbacks and main loop ---
        let setupDone = false;
        let drawCount = 0;
        let drawError: any = null;

        // --- Build the wrapper sketch function ---
        const wrappedSketchFn = function (p: any) {
          if (seed !== undefined) {
            window.Math.random = mulberry32(seed);
          }
          patchAssetLoaders(p, assets);
          clock.patchP5Instance(p);
          p.mouseX = width / 2;
          p.mouseY = height / 2;

          try {
            sketchFn(p);
          } catch (err) {
            drawError = { err, phase: "init" as SketchPhase };
            return;
          }

          // Force filter() to use the CPU (software) path. p5.js v1.11+
          // defaults useWebGL=true, which fails in headless environments.
          const origFilter = p.filter.bind(p);
          p.filter = function (operation: any, value?: any) {
            return origFilter(operation, value, false);
          };

          // Intercept setup
          const userSetup = p.setup ? p.setup.bind(p) : null;
          p.setup = function () {
            try {
              // Set pixelDensity before user setup so createCanvas uses it
              p.pixelDensity(1);
              if (seed !== undefined) {
                p.randomSeed(seed);
                p.noiseSeed(seed);
              }
              p.frameRate(frameRate);

              if (userSetup) {
                userSetup();
              } else {
                p.createCanvas(width, height);
              }

              // Stop the automatic loop; we step manually
              p.noLoop();
              setupDone = true;
            } catch (err) {
              drawError = { err, phase: "setup" as SketchPhase };
            }
          };

          // Intercept draw
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
            const frame = captureFrame(p, document);
            if (frame) {
              capturedFrames.push(frame);
            } else {
              logs.push(`[p5-render] Warning: could not capture frame ${drawCount}`);
            }
          };
        };

        // --- Create p5 instance ---
        let p5Instance: any;
        try {
          p5Instance = new p5Constructor(wrappedSketchFn, document.body);
        } catch (err) {
          const parsed = parseError(err, "init");
          return { ok: false as const, ...parsed, logs, partial_frames: capturedFrames };
        }

        if (drawError) {
          const parsed = parseError(drawError.err, drawError.phase, drawError.frameNumber);
          return { ok: false as const, ...parsed, logs, partial_frames: capturedFrames };
        }

        // --- Wait for p5 to initialize (it uses setTimeout internally) ---
        for (let i = 0; i < 50 && !setupDone && !drawError; i++) {
          stepFrame();
          await yieldToEventLoop(10);
        }

        if (drawError) {
          const parsed = parseError(drawError.err, drawError.phase, drawError.frameNumber);
          return { ok: false as const, ...parsed, logs, partial_frames: capturedFrames };
        }

        if (!setupDone) {
          return {
            ok: false as const,
            error: "Timed out waiting for setup() to complete",
            phase: "setup" as SketchPhase,
            logs,
            partial_frames: capturedFrames,
          };
        }

        // --- Step through requested frames via redraw() ---
        // Discard any frames captured during p5 init (p5 calls draw() once
        // automatically before noLoop takes effect). We want exactly the
        // number of frames the caller requested.
        capturedFrames.length = 0;
        drawCount = 0;

        for (let i = 0; i < frameCount && !drawError; i++) {
          try {
            p5Instance.redraw();
          } catch (err) {
            const parsed = parseError(err, "draw", i + 1);
            return { ok: false as const, ...parsed, logs, partial_frames: capturedFrames };
          }
        }

        if (drawError) {
          const parsed = parseError(drawError.err, drawError.phase, drawError.frameNumber);
          return { ok: false as const, ...parsed, logs, partial_frames: capturedFrames };
        }

        // If no draw() was defined (setup-only sketch), capture canvas now
        if (capturedFrames.length === 0) {
          const frame = captureFrame(p5Instance, document);
          if (frame) capturedFrames.push(frame);
        }

        // Report actual canvas dimensions (may be clamped from what the sketch requested)
        const skia = findSkiaCanvas(p5Instance, document);
        const actualWidth = skia?.width || p5Instance?.width || width;
        const actualHeight = skia?.height || p5Instance?.height || height;

        return {
          ok: true as const,
          frames: capturedFrames,
          width: actualWidth,
          height: actualHeight,
          duration_ms: Date.now() - startTime,
          logs,
        };
      },
      timeout,
      "sketch rendering"
    );

    return result;
  } catch (err) {
    const parsed = parseError(err);
    return { ok: false, ...parsed, logs, partial_frames: capturedFrames };
  } finally {
    if (env) {
      try {
        (env as HeadlessEnvironment).destroy();
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

/**
 * Resolve the compiled renderer module URL for the worker to import.
 * Always uses the dist/ directory since worker threads need proper .js files.
 */
function resolveRendererModuleUrl(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  // If we're running from dist/, the .js file is right here.
  // If we're running from src/ (vitest/tsx), go up one level to find dist/.
  const jsPath = resolve(dir, "renderer.js");
  if (existsSync(jsPath)) {
    return "file://" + jsPath;
  }
  const distPath = resolve(dir, "..", "dist", "renderer.js");
  if (existsSync(distPath)) {
    return "file://" + distPath;
  }
  throw new Error("Cannot find compiled renderer.js for worker thread. Run 'bun run build' first.");
}

/**
 * Run a sketch in a worker thread with a hard timeout.
 * The worker can be terminated to kill synchronous infinite loops.
 *
 * Uses a data-URL worker with dynamic import() so it works with both
 * compiled .js (production) and raw .ts (vitest/tsx development).
 */
async function renderSketchIsolated(options: RendererOptions): Promise<RenderResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const rendererUrl = resolveRendererModuleUrl();

  // Build a self-contained worker script that imports renderSketchInProcess
  const workerScript = `
    import { workerData, parentPort } from "node:worker_threads";
    const { renderSketchInProcess } = await import(${JSON.stringify(rendererUrl)});
    try {
      const result = await renderSketchInProcess(workerData);
      if (result.ok) {
        parentPort.postMessage({
          ...result,
          frames: result.frames.map(f => f.toString("base64")),
        });
      } else {
        parentPort.postMessage({
          ...result,
          partial_frames: result.partial_frames.map(f => f.toString("base64")),
        });
      }
    } catch (err) {
      parentPort.postMessage({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        logs: [],
        partial_frames: [],
      });
    }
  `;

  return new Promise<RenderResult>((resolve) => {
    const workerUrl = new URL(`data:text/javascript,${encodeURIComponent(workerScript)}`);
    const worker = new Worker(workerUrl, {
      workerData: options,
    });
    const timer = setTimeout(() => {
      worker.terminate().then(() => {
        resolve({
          ok: false,
          error: `Timeout: sketch rendering exceeded ${timeout}ms`,
          phase: "draw" as SketchPhase,
          logs: [],
          partial_frames: [],
        });
      });
    }, timeout);

    worker.on("message", (msg: any) => {
      clearTimeout(timer);
      if (msg.ok) {
        msg.frames = msg.frames.map((s: string) => Buffer.from(s, "base64"));
      } else {
        msg.partial_frames = (msg.partial_frames || []).map((s: string) => Buffer.from(s, "base64"));
      }
      resolve(msg);
    });

    worker.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        error: err.message,
        logs: [],
        partial_frames: [],
      });
    });

    worker.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        // Worker was terminated or crashed — already resolved via timeout or error handler
      }
    });
  });
}

/** Render a p5.js sketch. Uses in-process rendering by default, or a worker thread when `isolate: true`. */
export async function renderSketch(options: RendererOptions): Promise<RenderResult> {
  if (options.isolate) {
    return renderSketchIsolated(options);
  }
  return renderSketchInProcess(options);
}
