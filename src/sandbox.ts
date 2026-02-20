/**
 * Sketch isolation and resource limits.
 *
 * Provides timeout enforcement, console capture, canvas size clamping,
 * and structured error collection. Single-process for simplicity
 * (no worker_threads in this first pass).
 */

export const MAX_CANVAS_WIDTH = 4096;
export const MAX_CANVAS_HEIGHT = 4096;
export const MAX_LOG_ENTRIES = 1000;
export const DEFAULT_TIMEOUT_MS = 5000;

/** Clamp canvas dimensions to the allowed maximum */
export function clampDimensions(
  width: number,
  height: number,
  logs: string[]
): { width: number; height: number } {
  let clamped = false;
  if (width > MAX_CANVAS_WIDTH) {
    width = MAX_CANVAS_WIDTH;
    clamped = true;
  }
  if (height > MAX_CANVAS_HEIGHT) {
    height = MAX_CANVAS_HEIGHT;
    clamped = true;
  }
  if (width < 1) width = 1;
  if (height < 1) height = 1;
  if (clamped) {
    logs.push(`[p5-render] Canvas dimensions clamped to ${width}x${height} (max ${MAX_CANVAS_WIDTH}x${MAX_CANVAS_HEIGHT})`);
  }
  return { width, height };
}

/**
 * Create a console capture object that intercepts log/warn/error
 * and stores them in an array (capped at MAX_LOG_ENTRIES).
 */
export function createConsoleCapture(): {
  logs: string[];
  console: { log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void; info: (...args: any[]) => void };
} {
  const logs: string[] = [];

  function capture(prefix: string, ...args: any[]) {
    if (logs.length >= MAX_LOG_ENTRIES) return;
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    logs.push(prefix ? `[${prefix}] ${msg}` : msg);
  }

  return {
    logs,
    console: {
      log: (...args: any[]) => capture("", ...args),
      warn: (...args: any[]) => capture("warn", ...args),
      error: (...args: any[]) => capture("error", ...args),
      info: (...args: any[]) => capture("info", ...args),
    },
  };
}

/** Phase of sketch execution where an error can occur */
export type SketchPhase = "preload" | "setup" | "draw" | "init";

export interface StructuredError {
  error: string;
  errorLine?: number;
  errorColumn?: number;
  errorStack?: string;
  phase?: SketchPhase;
  frameNumber?: number;
}

/**
 * Parse an Error object into a structured error with line/column info.
 * Attempts to find the user code line in the stack trace.
 */
export function parseError(err: unknown, phase?: SketchPhase, frameNumber?: number): StructuredError {
  if (!(err instanceof Error)) {
    return {
      error: String(err),
      phase,
      frameNumber,
    };
  }

  const result: StructuredError = {
    error: err.message,
    errorStack: err.stack,
    phase,
    frameNumber,
  };

  // Try to extract line/column from stack trace
  // Look for lines like "at eval (eval at ..., <anonymous>:3:5)"
  // or "at <anonymous>:3:5"
  if (err.stack) {
    const lines = err.stack.split("\n");
    for (const line of lines) {
      // Match patterns like <anonymous>:3:5 or eval:3:5
      const match = line.match(/<anonymous>:(\d+):(\d+)/);
      if (match) {
        result.errorLine = parseInt(match[1], 10);
        result.errorColumn = parseInt(match[2], 10);
        break;
      }
      // Also try: (eval at ..., <anonymous>:3:5)
      const match2 = line.match(/eval.*?:(\d+):(\d+)/);
      if (match2) {
        result.errorLine = parseInt(match2[1], 10);
        result.errorColumn = parseInt(match2[2], 10);
        break;
      }
    }
  }

  return result;
}

/**
 * Run an async function with a timeout. Returns the result or throws
 * a timeout error.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string = "operation"
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timeout: ${label} exceeded ${timeoutMs}ms`));
      }
    }, timeoutMs);

    fn().then(
      (result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    );
  });
}
