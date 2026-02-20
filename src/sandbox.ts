export const MAX_CANVAS_WIDTH = 4096;
export const MAX_CANVAS_HEIGHT = 4096;
export const MAX_LOG_ENTRIES = 1000;
export const DEFAULT_TIMEOUT_MS = 5000;

export function clampDimensions(width: number, height: number, logs: string[]): { width: number; height: number } {
  let clamped = false;
  if (width > MAX_CANVAS_WIDTH) { width = MAX_CANVAS_WIDTH; clamped = true; }
  if (height > MAX_CANVAS_HEIGHT) { height = MAX_CANVAS_HEIGHT; clamped = true; }
  if (width < 1) width = 1;
  if (height < 1) height = 1;
  if (clamped) logs.push(`[p5-render] Canvas dimensions clamped to ${width}x${height} (max ${MAX_CANVAS_WIDTH}x${MAX_CANVAS_HEIGHT})`);
  return { width, height };
}

export function createConsoleCapture() {
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

export type SketchPhase = "preload" | "setup" | "draw" | "init";

export interface StructuredError {
  error: string;
  errorLine?: number;
  errorColumn?: number;
  errorStack?: string;
  phase?: SketchPhase;
  frameNumber?: number;
}

export function parseError(err: unknown, phase?: SketchPhase, frameNumber?: number): StructuredError {
  if (!(err instanceof Error)) return { error: String(err), phase, frameNumber };

  const result: StructuredError = { error: err.message, errorStack: err.stack, phase, frameNumber };

  if (err.stack) {
    for (const line of err.stack.split("\n")) {
      const match = line.match(/<anonymous>:(\d+):(\d+)/) || line.match(/eval.*?:(\d+):(\d+)/);
      if (match) {
        result.errorLine = parseInt(match[1], 10);
        result.errorColumn = parseInt(match[2], 10);
        break;
      }
    }
  }

  return result;
}

export async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error(`Timeout: ${label} exceeded ${timeoutMs}ms`)); }
    }, timeoutMs);

    fn().then(
      (result) => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } },
      (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } },
    );
  });
}
