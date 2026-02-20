/**
 * Benchmark runner for p5-render.
 *
 * For each .js file in bench/sketches/:
 * 1. Read the sketch code
 * 2. Cold run: measure time for first renderSketch() call
 * 3. Warm runs: call renderSketch() 20 times, collect timings
 * 4. Compute mean, p50, p99
 * 5. Record peak heap (process.memoryUsage().heapUsed)
 * 6. Record output PNG size
 *
 * Usage:
 *   npx tsx bench/runner.ts
 *   npx tsx bench/runner.ts --sketch noop
 *   npx tsx bench/runner.ts --save baseline.json
 *   npx tsx bench/runner.ts --compare baseline.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { BenchResult, BenchReport } from "./compare.js";
import { compareBenchmarks } from "./compare.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKETCHES_DIR = path.join(__dirname, "sketches");
const WARM_RUNS = 20;

// Sketches that need multi-frame rendering
const MULTI_FRAME_SKETCHES: Record<string, number> = {
  animation_60f: 60,
  animation_300f: 300,
};

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  sketch: string | null;
  savePath: string | null;
  comparePath: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { sketch: null, savePath: null, comparePath: null };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--sketch" && i + 1 < argv.length) {
      args.sketch = argv[++i];
    } else if (arg === "--save" && i + 1 < argv.length) {
      args.savePath = argv[++i];
    } else if (arg === "--compare" && i + 1 < argv.length) {
      args.comparePath = argv[++i];
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Benchmark a single sketch
// ---------------------------------------------------------------------------

async function benchmarkSketch(
  renderSketch: (opts: any) => Promise<any>,
  name: string,
  code: string,
): Promise<BenchResult> {
  const frames = MULTI_FRAME_SKETCHES[name] ?? 1;
  const opts = { code, frames, timeout: 30000 };

  // Force GC if available
  if (typeof globalThis.gc === "function") {
    globalThis.gc();
  }

  // Cold run
  const coldStart = performance.now();
  const coldResult = await renderSketch(opts);
  const coldMs = performance.now() - coldStart;

  if (!coldResult.ok) {
    process.stderr.write(`  WARNING: ${name} failed: ${coldResult.error}\n`);
  }

  // Warm runs
  const warmTimings: number[] = [];
  let peakHeap = process.memoryUsage().heapUsed;

  for (let i = 0; i < WARM_RUNS; i++) {
    const start = performance.now();
    await renderSketch(opts);
    warmTimings.push(performance.now() - start);

    const heap = process.memoryUsage().heapUsed;
    if (heap > peakHeap) peakHeap = heap;
  }

  warmTimings.sort((a, b) => a - b);

  const pngBytes = coldResult.ok && coldResult.frames.length > 0 ? coldResult.frames[0].length : 0;

  return {
    cold_ms: Math.round(coldMs * 100) / 100,
    warm_ms: Math.round(mean(warmTimings) * 100) / 100,
    warm_p50: Math.round(percentile(warmTimings, 50) * 100) / 100,
    warm_p99: Math.round(percentile(warmTimings, 99) * 100) / 100,
    peak_heap_mb: Math.round((peakHeap / 1024 / 1024) * 10) / 10,
    png_bytes: pngBytes,
  };
}

// ---------------------------------------------------------------------------
// Human-readable table
// ---------------------------------------------------------------------------

function printResultsTable(results: Record<string, BenchResult>): void {
  const COL_NAME = 22;
  const COL_NUM = 12;

  const pad = (s: string, w: number) => (s.length >= w ? s : s + " ".repeat(w - s.length));
  const rpad = (s: string, w: number) => (s.length >= w ? s : " ".repeat(w - s.length) + s);

  const header = [
    pad("Benchmark", COL_NAME),
    rpad("Cold (ms)", COL_NUM),
    rpad("Warm (ms)", COL_NUM),
    rpad("P50 (ms)", COL_NUM),
    rpad("P99 (ms)", COL_NUM),
    rpad("Heap (MB)", COL_NUM),
    rpad("PNG (B)", COL_NUM),
  ].join("  ");

  process.stderr.write("\n" + header + "\n");
  process.stderr.write("-".repeat(header.length) + "\n");

  for (const [name, r] of Object.entries(results).sort(([a], [b]) => a.localeCompare(b))) {
    const row = [
      pad(name, COL_NAME),
      rpad(r.cold_ms.toFixed(1), COL_NUM),
      rpad(r.warm_ms.toFixed(1), COL_NUM),
      rpad(r.warm_p50.toFixed(1), COL_NUM),
      rpad(r.warm_p99.toFixed(1), COL_NUM),
      rpad(r.peak_heap_mb.toFixed(1), COL_NUM),
      rpad(String(r.png_bytes), COL_NUM),
    ].join("  ");
    process.stderr.write(row + "\n");
  }

  process.stderr.write("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  // Dynamically import renderSketch. Try dist first, fall back to src via tsx.
  let renderSketch: (opts: any) => Promise<any>;
  try {
    const mod = await import("../dist/index.js");
    renderSketch = mod.renderSketch;
  } catch {
    try {
      const mod = await import("../src/index.js");
      renderSketch = mod.renderSketch;
    } catch (err) {
      process.stderr.write(`ERROR: Could not import renderSketch. Build the project first or run with tsx.\n`);
      process.stderr.write(`  ${err}\n`);
      process.exit(1);
    }
  }

  // Find sketch files
  let sketchFiles: string[];
  if (!fs.existsSync(SKETCHES_DIR)) {
    process.stderr.write(`No bench sketches directory found at: ${SKETCHES_DIR}\n`);
    process.stderr.write(`Create bench/sketches/ with benchmark .js files.\n`);
    process.exit(1);
  }

  sketchFiles = fs
    .readdirSync(SKETCHES_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort();

  if (args.sketch) {
    const pattern = args.sketch.toLowerCase();
    sketchFiles = sketchFiles.filter((f) => f.toLowerCase().includes(pattern));
    if (sketchFiles.length === 0) {
      process.stderr.write(`No sketch files matching "${args.sketch}" in ${SKETCHES_DIR}\n`);
      process.exit(1);
    }
  }

  if (sketchFiles.length === 0) {
    process.stderr.write(`No .js files found in ${SKETCHES_DIR}\n`);
    process.exit(1);
  }

  process.stderr.write(`Running ${sketchFiles.length} benchmark(s) with ${WARM_RUNS} warm runs each...\n\n`);

  // Run benchmarks
  const results: Record<string, BenchResult> = {};

  for (const file of sketchFiles) {
    const name = file.replace(/\.js$/, "");
    const code = fs.readFileSync(path.join(SKETCHES_DIR, file), "utf-8");
    process.stderr.write(`  ${name}...`);
    const result = await benchmarkSketch(renderSketch, name, code);
    results[name] = result;
    process.stderr.write(` cold=${result.cold_ms.toFixed(1)}ms warm=${result.warm_ms.toFixed(1)}ms\n`);
  }

  // Build report
  const report: BenchReport = {
    timestamp: new Date().toISOString(),
    node_version: process.version,
    platform: `${process.platform}-${process.arch}`,
    results,
  };

  // Print human-readable table to stderr
  printResultsTable(results);

  // Output JSON to stdout
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  // Save baseline if requested
  if (args.savePath) {
    const savePath = path.resolve(args.savePath);
    fs.writeFileSync(savePath, JSON.stringify(report, null, 2) + "\n");
    process.stderr.write(`Saved baseline to: ${savePath}\n`);
  }

  // Compare against baseline if requested
  if (args.comparePath) {
    const comparePath = path.resolve(args.comparePath);
    if (!fs.existsSync(comparePath)) {
      process.stderr.write(`Baseline file not found: ${comparePath}\n`);
      process.exit(1);
    }
    const baseline: BenchReport = JSON.parse(fs.readFileSync(comparePath, "utf-8"));
    const { hasRegressions } = compareBenchmarks(report, baseline);
    if (hasRegressions) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + "\n");
  }
  process.exit(1);
});
