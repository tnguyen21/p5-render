/**
 * Worker pool for isolated sketch rendering.
 *
 * Spawns N long-lived child processes from dist/worker.js. Each process
 * loads jsdom + skia-canvas + gl once and stays alive between renders,
 * avoiding the per-request native module loading that causes SIGSEGV.
 *
 * Uses child_process.fork() instead of worker_threads so that native
 * addon crashes (Rust panics in skia-canvas, segfaults in headless-gl)
 * only kill the individual subprocess — the parent process survives.
 *
 * WebGL sketches are automatically serialized (one at a time) because
 * headless-gl only supports a single active GL context per process.
 */

import { fork, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import type { RendererOptions, RenderResult } from "./renderer.js";
import type { SketchPhase } from "./sandbox.js";

function resolveWorkerPath(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  // When running from dist/
  const sameDir = resolve(dir, "worker.js");
  if (existsSync(sameDir)) return sameDir;
  // When running from src/ via tsx
  const distPath = resolve(dir, "..", "dist", "worker.js");
  if (existsSync(distPath)) return distPath;
  throw new Error("Cannot find compiled worker.js. Run 'bun run build' first.");
}

/** Detect if sketch code uses WebGL (createCanvas with WEBGL arg) */
function isWebGLSketch(code: string): boolean {
  return /createCanvas\s*\([^)]*WEBGL/i.test(code);
}

interface QueuedRequest {
  id: number;
  options: RendererOptions;
  resolve: (result: RenderResult) => void;
  timer: ReturnType<typeof setTimeout>;
  webgl: boolean;
}

interface PoolWorker {
  proc: ChildProcess;
  busy: boolean;
  currentRequest: QueuedRequest | null;
  ready: boolean;
  readyPromise: Promise<void>;
}

export class WorkerPool {
  private workers: PoolWorker[] = [];
  private queue: QueuedRequest[] = [];
  private nextId = 1;
  private workerPath: string;
  private defaultTimeout: number;
  private destroyed = false;
  /**
   * Dedicated worker for WebGL renders. headless-gl binds to the first
   * thread that creates a GL context — only that thread can create
   * subsequent contexts, so all WebGL work must go to the same worker.
   */
  private glWorker: PoolWorker | null = null;
  /** Queue for WebGL requests (serialized through glWorker) */
  private glQueue: QueuedRequest[] = [];

  constructor(opts: { size: number; timeout?: number }) {
    this.workerPath = resolveWorkerPath();
    this.defaultTimeout = opts.timeout ?? 10_000;
    for (let i = 0; i < opts.size; i++) {
      this.workers.push(this.spawnWorker());
    }
    // Designate the first worker for WebGL
    this.glWorker = this.workers[0];
  }

  private spawnWorker(): PoolWorker {
    const proc = fork(this.workerPath, [], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    let resolveReady: () => void;
    const readyPromise = new Promise<void>((r) => { resolveReady = r; });

    const pw: PoolWorker = { proc, busy: false, currentRequest: null, ready: false, readyPromise };

    proc.on("message", (msg: any) => {
      if (msg.type === "ready") {
        pw.ready = true;
        resolveReady!();
        this.dispatch();
        return;
      }
      if (msg.type === "result") {
        const req = pw.currentRequest;
        if (req && req.id === msg.id) {
          clearTimeout(req.timer);

          pw.busy = false;
          pw.currentRequest = null;
          const result = msg.result;
          // Decode base64 frames
          if (result.ok) {
            result.frames = (result.frames || []).map((s: string) => Buffer.from(s, "base64"));
          } else {
            result.partial_frames = (result.partial_frames || []).map((s: string) => Buffer.from(s, "base64"));
          }
          req.resolve(result);
          this.dispatch();
        }
      }
    });

    proc.on("error", (err) => {
      const req = pw.currentRequest;
      if (req) {
        clearTimeout(req.timer);
        req.resolve({ ok: false, error: err.message, logs: [], partial_frames: [] });
      }
      this.replaceWorker(pw);
    });

    proc.on("exit", (code, signal) => {
      if (this.destroyed) return;
      const req = pw.currentRequest;
      if (req) {
        clearTimeout(req.timer);
        const reason = signal
          ? `Worker killed by signal ${signal} (possible segfault or Rust panic)`
          : `Worker exited with code ${code}`;
        req.resolve({
          ok: false,
          error: reason,
          logs: [],
          partial_frames: [],
        });
      }
      this.replaceWorker(pw);
    });

    return pw;
  }

  private replaceWorker(pw: PoolWorker): void {
    if (this.destroyed) return;
    const idx = this.workers.indexOf(pw);
    if (idx === -1) return;
    const wasGlWorker = pw === this.glWorker;
    // Kill old process (ignore errors — it may already be dead)
    try { pw.proc.kill(); } catch {}
    const replacement = this.spawnWorker();
    this.workers[idx] = replacement;
    // If the GL worker crashed, the new one becomes the GL worker.
    // The previous process is gone, so the new one can create GL contexts.
    if (wasGlWorker) this.glWorker = replacement;
  }

  private dispatch(): void {
    // Dispatch WebGL queue: pinned to glWorker, one at a time
    if (this.glQueue.length > 0 && this.glWorker && this.glWorker.ready && !this.glWorker.busy) {
      const req = this.glQueue.shift()!;
      this.glWorker.busy = true;
      this.glWorker.currentRequest = req;
      this.glWorker.proc.send({ id: req.id, options: req.options });
    }

    // Dispatch non-WebGL queue: any available worker (including glWorker if idle)
    while (this.queue.length > 0) {
      const available = this.workers.find((w) => w.ready && !w.busy);
      if (!available) break;
      const req = this.queue.shift()!;
      available.busy = true;
      available.currentRequest = req;
      available.proc.send({ id: req.id, options: req.options });
    }
  }

  async render(options: RendererOptions): Promise<RenderResult> {
    if (this.destroyed) {
      return { ok: false, error: "Worker pool destroyed", logs: [], partial_frames: [] };
    }

    const timeout = options.timeout ?? this.defaultTimeout;
    const id = this.nextId++;
    const webgl = isWebGLSketch(options.code);

    return new Promise<RenderResult>((resolveResult) => {
      const timer = setTimeout(() => {
        // Find and kill the worker handling this request
        const pw = this.workers.find((w) => w.currentRequest?.id === id);
        if (pw) {
          pw.busy = false;
          pw.currentRequest = null;
          // Kill and replace — the exit handler will spawn a new one
          try { pw.proc.kill(); } catch {}
        } else {
          // Still in queue — remove it from whichever queue it's in
          const targetQueue = webgl ? this.glQueue : this.queue;
          const qIdx = targetQueue.findIndex((q) => q.id === id);
          if (qIdx !== -1) targetQueue.splice(qIdx, 1);
        }
        resolveResult({
          ok: false,
          error: `Timeout: sketch rendering exceeded ${timeout}ms`,
          phase: "draw" as SketchPhase,
          logs: [],
          partial_frames: [],
        });
        // A WebGL slot may have freed up
        this.dispatch();
      }, timeout);

      const req: QueuedRequest = { id, options, resolve: resolveResult, timer, webgl };
      if (webgl) {
        this.glQueue.push(req);
      } else {
        this.queue.push(req);
      }
      this.dispatch();
    });
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    // Clear pending queues
    for (const req of [...this.queue, ...this.glQueue]) {
      clearTimeout(req.timer);
      req.resolve({ ok: false, error: "Worker pool destroyed", logs: [], partial_frames: [] });
    }
    this.queue = [];
    this.glQueue = [];
    // Kill all worker processes
    for (const pw of this.workers) {
      if (pw.currentRequest) {
        clearTimeout(pw.currentRequest.timer);
        pw.currentRequest.resolve({ ok: false, error: "Worker pool destroyed", logs: [], partial_frames: [] });
      }
      try { pw.proc.kill(); } catch {}
    }
    this.workers = [];
  }
}

// Singleton pool management
let _pool: WorkerPool | null = null;

export function getPool(size: number, timeout?: number): WorkerPool {
  if (!_pool) {
    _pool = new WorkerPool({ size, timeout });
  }
  return _pool;
}

export async function destroyPool(): Promise<void> {
  if (_pool) {
    await _pool.destroy();
    _pool = null;
  }
}
